import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { AddChildSheet } from '../components/add-child-sheet';
import { AlumnoPageHeader } from '../components/alumno-brand';
import { AppShell } from '../components/app-shell';
import { ChildControlsSheet } from '../components/child-controls-sheet';
import { ChildReloadSheet } from '../components/child-reload-sheet';
import { ChildSecuritySection } from '../components/child-security-section';
import { LoadingSkeleton } from '../components/loading-skeleton';
import { WeekPlannerSheet } from '../components/week-planner-sheet';
import { useAuth } from '../context/auth-context';
import { useBuyerSession } from '../context/buyer-session';
import { useCart } from '../context/cart-context';
import { api } from '../lib/api';
import { errorMessage, VaiinillaApiError } from '../lib/api-error';
import { resolveClientSession } from '../lib/client-session';
import {
  ACCESS_LOST_CODES,
  allergensLine,
  blockedLine,
  canCancelScheduled,
  canViewDependent,
  dailyRemainingLabel,
  dayShortLabel,
  DependentContextSession,
  firstName,
  isConsentRequired,
  movementLabel,
  orderSummary,
  scheduledOrderPolicyText,
  shortDate,
  signedAmount,
  type ChildMenuCalendar,
  type Dependent,
  type PrivacyNotice,
  type StudentRequest,
} from '../lib/guardianship';
import { createIdempotencyKey } from '../lib/idempotency';
import { lastPlaceSlug } from '../lib/last-place';
import { formatAmount } from '../lib/money';
import { ORDER_STATUS_LABEL } from '../lib/order-labels';
import type { OrderDetail, WalletData } from '../types/api';

const MOVEMENTS_SHOWN = 15;
const ORDERS_SHOWN = 15;

/** El contexto de cliente del tutor en su escuela (el mismo que usa Mi saldo). */
function useGuardianSession() {
  const { user, ready } = useAuth();
  const { cart } = useCart();
  const { context, openClientSession } = useBuyerSession();
  const [token, setToken] = useState<string | null>(null);
  const [placeName, setPlaceName] = useState('');
  const [placeSlug, setPlaceSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready || !user) {
      // Al cerrar sesión no queda ningún token: sin el del tutor tampoco se puede pedir el del hijo.
      setToken(null);
      setPlaceName('');
      setError(null);
      setLoading(!ready);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const resolved = await resolveClientSession({
          user,
          context,
          preferredSlug: cart?.slug ?? lastPlaceSlug(),
          openClientSession,
        });
        if (!active) return;
        if (!resolved) {
          setError('Entra a la escuela de tus hijos para verlos aquí.');
          return;
        }
        setToken(resolved.context.access_token);
        setPlaceName(resolved.place?.nombre ?? '');
        setPlaceSlug(resolved.slug ?? resolved.place?.slug ?? null);
        setError(null);
      } catch (cause) {
        if (active) setError(errorMessage(cause));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [cart?.slug, context, openClientSession, ready, user]);

  return { user, ready, token, placeName, placeSlug, error, loading };
}

/** `/cuenta/hijos`: Mis hijos con su saldo y lo que les queda hoy. */
export function ParentModePage() {
  const { user, ready, token, placeName, error: sessionError, loading: sessionLoading } = useGuardianSession();
  const [children, setChildren] = useState<Dependent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  // Sin `tutor_habilitado` (backend anterior) el tutor ya puede agregar hijos, como en Expo.
  const [parentUnlocked, setParentUnlocked] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!token) {
      setChildren(null);
      return;
    }
    let active = true;
    api
      .listDependents(token)
      .then((list) => {
        if (!active) return;
        setChildren(list);
        setError(null);
      })
      .catch((cause) => {
        if (active) setError(errorMessage(cause));
      });
    void Promise.resolve()
      .then(() => api.getOperationalStatus(token))
      .then((status) => {
        if (active) setParentUnlocked(status?.tutor_habilitado ?? true);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [token, reloadKey]);

  if (ready && !user) return <Navigate to="/cuenta?next=/cuenta/hijos" replace />;

  const shownError = sessionError ?? error;
  const needsConsent = (children ?? []).filter((child) => child.needsConsent);
  const loading = !shownError && (sessionLoading || (token !== null && children === null));

  return (
    <AppShell tab="wallet">
      <main id="main-content" className="alumno-main parent-mode">
        <AlumnoPageHeader
          kicker={placeName || 'Modo papás'}
          title="Mis hijos"
          back={{ to: '/cuenta/saldo', label: 'Mi saldo' }}
          lead="Su saldo, lo que les queda hoy y lo que han comprado."
        />
        {shownError ? <p className="alumno-error">{shownError}</p> : null}
        {loading ? <LoadingSkeleton shape="wallet" label="Buscando a tus hijos…" /> : null}
        {needsConsent.length > 0 && token ? (
          <ConsentCard
            token={token}
            names={needsConsent.map((child) => firstName(child.name))}
            onAccepted={(list) => setChildren(list)}
          />
        ) : null}
        {children && children.length === 0 ? (
          <section className="alumno-card parent-mode__empty">
            <h2>Aún no tienes hijos en esta escuela</h2>
            <p className="alumno-muted">
              Agrégalo con sus datos de la escuela o con su código. Cuando la escuela te apruebe, aquí verás su saldo y lo
              que compra.
            </p>
          </section>
        ) : null}
        {children && children.length > 0 ? (
          <ul className="parent-mode__children" aria-label="Tus hijos">
            {children.map((child) => (
              <li key={child.userId}>
                <ChildRow child={child} />
              </li>
            ))}
          </ul>
        ) : null}
        {token && children ? (
          <button className="alumno-btn alumno-btn--lime parent-mode__add" type="button" onClick={() => setAdding(true)}>
            Agregar a mi hijo
          </button>
        ) : null}
        {adding && token ? (
          <AddChildSheet
            token={token}
            parentUnlocked={parentUnlocked}
            onUnlocked={() => setParentUnlocked(true)}
            onAdded={() => setReloadKey((value) => value + 1)}
            onClosed={() => setAdding(false)}
          />
        ) : null}
      </main>
    </AppShell>
  );
}

function childMeta(child: Dependent): string {
  return [child.group ? `Grupo ${child.group}` : null, child.studentId].filter(Boolean).join(' · ');
}

function ChildRow({ child }: { child: Dependent }) {
  const meta = childMeta(child);
  if (child.state !== 'aprobada') {
    return (
      <div className="alumno-card parent-mode__child parent-mode__child--waiting" data-testid="child-row">
        <span className="parent-mode__child-name">
          <strong>{child.name}</strong>
          {meta ? <span className="alumno-muted">{meta}</span> : null}
        </span>
        <span className="alumno-muted">
          {child.state === 'pendiente' ? 'Esperando a la escuela' : 'No disponible por ahora'}
        </span>
      </div>
    );
  }
  if (!canViewDependent(child)) {
    // Aprobado pero sin el aviso vigente aceptado: ni saldo ni ficha hasta aceptarlo.
    return (
      <div className="alumno-card parent-mode__child parent-mode__child--waiting" data-testid="child-row">
        <span className="parent-mode__child-name">
          <strong>{child.name}</strong>
          {meta ? <span className="alumno-muted">{meta}</span> : null}
        </span>
        <span className="alumno-muted">Acepta el aviso de privacidad para ver sus datos</span>
      </div>
    );
  }
  const remaining = dailyRemainingLabel(child.controls);
  return (
    <Link
      className="alumno-card parent-mode__child"
      to={`/cuenta/hijos/${encodeURIComponent(child.userId)}`}
      data-testid="child-row"
      aria-label={`${child.name}, saldo ${formatAmount(child.balance ?? '0.00', 'always')}`}
    >
      <span className="parent-mode__child-name">
        <strong>{child.name}</strong>
        {meta ? <span className="alumno-muted">{meta}</span> : null}
      </span>
      <span className="parent-mode__child-money">
        <strong>{formatAmount(child.balance ?? '0.00', 'always')}</strong>
        <span className="alumno-muted">Hoy le quedan: {remaining ?? '—'}</span>
      </span>
    </Link>
  );
}

/**
 * El aviso de privacidad bloquea: mientras falte, los hijos que lo requieren no muestran datos ni se
 * abren. Un aviso en borrador se puede leer pero no aceptar.
 */
function ConsentCard({
  token,
  names,
  onAccepted,
}: {
  token: string;
  names: string[];
  onAccepted: (children: Dependent[]) => void;
}) {
  const [notice, setNotice] = useState<PrivacyNotice | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [checked, setChecked] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key] = useState(createIdempotencyKey);

  const loadNotice = useCallback(async () => {
    try {
      const next = await api.getGuardianPrivacyNotice(token);
      setNotice(next);
      setError(next ? null : 'No pudimos leer el aviso de privacidad. Intenta de nuevo más tarde.');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoaded(true);
    }
  }, [token]);

  useEffect(() => {
    void loadNotice();
  }, [loadNotice]);

  const accept = async () => {
    if (!notice || notice.draft) return;
    setSending(true);
    try {
      onAccepted(await api.acceptGuardianPrivacyNotice(token, notice.version, key));
    } catch (cause) {
      // Otra versión vigente: se recarga el aviso y se desmarca la casilla.
      if (cause instanceof VaiinillaApiError && cause.code === 'CONSENT_REQUIRED') {
        setChecked(false);
        setNotice(null);
        await loadNotice();
      }
      setError(errorMessage(cause));
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="alumno-card parent-mode__consent" aria-labelledby="parent-consent-title">
      <h2 id="parent-consent-title">Falta tu permiso para los datos de {names.join(', ')}</h2>
      <p className="alumno-muted">Para ver su saldo y lo que compran, primero lee y acepta el aviso de privacidad.</p>
      <div className="parent-mode__notice">
        {notice ? (
          <>
            <h3>{notice.title}</h3>
            {notice.paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
            {notice.draft ? (
              <p className="alumno-muted" role="status">
                Este aviso todavía es un borrador y aún no se puede aceptar. Vuelve más tarde.
              </p>
            ) : (
              <>
                <label className="parent-mode__check">
                  <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} />
                  Soy su mamá, papá o tutor y acepto el aviso de privacidad, también para sus alergias.
                </label>
                <button
                  type="button"
                  className="alumno-btn alumno-btn--lime"
                  disabled={!checked || sending}
                  onClick={() => void accept()}
                >
                  {sending ? 'Guardando…' : 'Aceptar'}
                </button>
              </>
            )}
          </>
        ) : loaded ? null : (
          <p className="alumno-muted">Cargando el aviso…</p>
        )}
      </div>
      {error ? <p className="alumno-error">{error}</p> : null}
    </section>
  );
}

/** `/cuenta/hijos/:id`: la cuenta de un hijo vista con su contexto (saldo, movimientos y pedidos). */
export function ChildAccountPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user, ready, token, placeSlug, error: sessionError } = useGuardianSession();
  const [child, setChild] = useState<Dependent | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [orders, setOrders] = useState<OrderDetail[] | null>(null);
  const [ordersFailed, setOrdersFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessLost, setAccessLost] = useState(false);
  const [consentMissing, setConsentMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<StudentRequest[]>([]);
  const [calendar, setCalendar] = useState<ChildMenuCalendar | null>(null);
  const [childToken, setChildToken] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'reload' | 'week' | 'controls' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [cancelling, setCancelling] = useState<OrderDetail | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);

  const session = useMemo(
    () => (token ? new DependentContextSession(() => api.issueDependentContext(token, id)) : null),
    [id, token],
  );

  useEffect(() => {
    if (!token || !session) {
      // Sin sesión del tutor (por ejemplo, al cerrar sesión) no queda nada del hijo en pantalla.
      setChild(null);
      setWallet(null);
      setOrders(null);
      return;
    }
    let active = true;
    const lost = (cause: unknown) =>
      cause instanceof VaiinillaApiError && (ACCESS_LOST_CODES.has(cause.code) || cause.status === 404);
    void (async () => {
      setLoading(true);
      // Cada carga empieza limpia: un primer intento con la sesión de otro negocio no deja la ficha bloqueada.
      setAccessLost(false);
      setConsentMissing(false);
      try {
        const list = await api.listDependents(token);
        const found = list.find((item) => item.userId === id) ?? null;
        if (!active) return;
        setChild(found);
        if (!found || found.state !== 'aprobada') {
          setAccessLost(true);
          return;
        }
        // Sin el aviso vigente aceptado no se pide el contexto del hijo.
        if (found.needsConsent) {
          setConsentMissing(true);
          return;
        }
        const [walletResult, ordersResult] = await Promise.allSettled([
          session.run((childToken) => api.getDependentWallet(childToken)),
          session.run((childToken) => api.listDependentOrders(childToken)),
        ]);
        if (!active) return;
        if ([walletResult, ordersResult].some((result) => result.status === 'rejected' && isConsentRequired(result.reason))) {
          setConsentMissing(true);
          session.clear();
          return;
        }
        if (walletResult.status === 'fulfilled') {
          setWallet(walletResult.value);
          setError(null);
        } else if (lost(walletResult.reason)) {
          setAccessLost(true);
        } else {
          setError(errorMessage(walletResult.reason));
        }
        if (ordersResult.status === 'fulfilled') {
          setOrders(ordersResult.value);
          setOrdersFailed(false);
        } else if (!lost(ordersResult.reason)) {
          setOrdersFailed(true);
        }
        // Lo que no bloquea la ficha: sus solicitudes a la escuela, el menú por día y el token para recargarle.
        void Promise.resolve()
          .then(() => api.listStudentRequests(token, id))
          .then((list) => {
            if (active) setRequests(list ?? []);
          })
          .catch(() => undefined);
        void session
          .run((childToken) => api.getDependentMenuCalendar(childToken))
          .then((next) => {
            if (active) setCalendar(next ?? null);
          })
          .catch(() => undefined);
        void session
          .validToken()
          .then((next) => {
            if (active) setChildToken(next);
          })
          .catch(() => undefined);
      } catch (cause) {
        if (!active) return;
        if (isConsentRequired(cause)) setConsentMissing(true);
        else if (lost(cause)) setAccessLost(true);
        else setError(errorMessage(cause));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      session.clear();
    };
  }, [id, session, token, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);

  const cancelScheduled = async () => {
    if (!cancelling || !session || cancelBusy) return;
    setCancelBusy(true);
    setCancelError(null);
    try {
      await session.run((childToken) => api.cancelDependentOrder(childToken, cancelling, createIdempotencyKey()));
      setCancelling(null);
      setNotice('Cancelamos lo apartado. El saldo regresa a su cuenta.');
      refresh();
    } catch (cause) {
      setCancelError(errorMessage(cause));
    } finally {
      setCancelBusy(false);
    }
  };

  if (ready && !user) return <Navigate to={`/cuenta?next=/cuenta/hijos/${encodeURIComponent(id)}`} replace />;

  const name = child?.name ?? 'Tu hijo';
  const shownError = sessionError ?? error;

  return (
    <AppShell tab="wallet">
      <main id="main-content" className="alumno-main parent-mode">
        <AlumnoPageHeader
          kicker={child ? childMeta(child) || 'Modo papás' : 'Modo papás'}
          title={name}
          back={{ to: '/cuenta/hijos', label: 'Mis hijos' }}
        />
        {accessLost ? (
          <p className="alumno-error" role="alert">
            Ya no puedes ver la cuenta de {firstName(name)}. Si crees que es un error, habla con la escuela.
          </p>
        ) : null}
        {consentMissing && !accessLost ? (
          <p className="alumno-error" role="alert">
            Para ver la cuenta de {firstName(name)} primero acepta el aviso de privacidad en{' '}
            <Link to="/cuenta/hijos">Mis hijos</Link>.
          </p>
        ) : null}
        {shownError && !accessLost && !consentMissing ? <p className="alumno-error">{shownError}</p> : null}
        {loading && !wallet && !shownError && !accessLost && !consentMissing ? (
          <LoadingSkeleton shape="wallet" label={`Abriendo la cuenta de ${firstName(name)}…`} />
        ) : null}
        {notice ? (
          <p className="alumno-banner parent-mode__notice-banner" role="status">
            {notice}
          </p>
        ) : null}
        {child && canViewDependent(child) && !accessLost && !consentMissing && (wallet || !loading) ? (
          <>
            <div className="parent-mode__actions" role="group" aria-label={`Acciones para ${firstName(name)}`}>
              <button className="alumno-btn alumno-btn--lime" type="button" disabled={!wallet || !childToken} onClick={() => setSheet('reload')}>
                Recargar
              </button>
              <button className="alumno-btn alumno-btn--ghost" type="button" onClick={() => setSheet('week')}>
                Apartar
              </button>
              <button className="alumno-btn alumno-btn--ghost" type="button" onClick={() => setSheet('controls')}>
                Controles
              </button>
            </div>
            <ChildAccountView
              child={child}
              wallet={wallet}
              orders={orders}
              ordersFailed={ordersFailed}
              scheduled={
                <ScheduledSection
                  orders={orders}
                  calendar={calendar}
                  onCancel={(order) => {
                    setCancelError(null);
                    setCancelling(order);
                  }}
                />
              }
            />
            {cancelling ? (
              <div className="parent-sheet__confirm" role="alertdialog" aria-label="¿Cancelar lo apartado?">
                <p>
                  <strong>¿Cancelar lo apartado?</strong> {orderSummary(cancelling) || `Pedido #${cancelling.folio}`}. El saldo
                  regresa a su cuenta.
                </p>
                {cancelError ? (
                  <p className="alumno-error" role="alert">
                    {cancelError}
                  </p>
                ) : null}
                <button className="alumno-btn alumno-btn--danger" type="button" disabled={cancelBusy} onClick={() => void cancelScheduled()}>
                  {cancelBusy ? 'Cancelando…' : 'Sí, cancelar'}
                </button>
                <button className="alumno-btn alumno-btn--ghost" type="button" disabled={cancelBusy} onClick={() => setCancelling(null)}>
                  No
                </button>
              </div>
            ) : null}
            {token ? (
              <ChildSecuritySection
                token={token}
                child={child}
                balance={wallet?.wallet.saldo ?? child.balance ?? '0.00'}
                requests={requests}
                onChildChanged={setChild}
                onRequestsChanged={setRequests}
                onNotice={setNotice}
              />
            ) : null}
          </>
        ) : null}
        {sheet === 'reload' && child && wallet && childToken && session ? (
          <ChildReloadSheet
            child={child}
            childToken={childToken}
            wallet={wallet}
            client={{
              start: (amount, key) => session.run((next) => api.startDependentCardReload(next, amount, key)),
              status: (reloadId) => session.run((next) => api.getDependentCardReload(next, reloadId)),
            }}
            onSettled={refresh}
            onClosed={() => setSheet(null)}
          />
        ) : null}
        {sheet === 'week' && child && session ? (
          <WeekPlannerSheet
            child={child}
            placeSlug={placeSlug}
            loadCalendar={() => session.run((next) => api.getDependentMenuCalendar(next))}
            reserve={(days, key) => session.run((next) => api.reserveDependentWeek(next, days, key))}
            onReserved={(count) => {
              setNotice(count === 1 ? 'Listo, apartamos 1 día.' : `Listo, apartamos ${count} días.`);
              refresh();
            }}
            onClosed={() => setSheet(null)}
          />
        ) : null}
        {sheet === 'controls' && child && token ? (
          <ChildControlsSheet
            token={token}
            child={child}
            placeSlug={placeSlug}
            onSaved={(updated) => {
              setChild(updated);
              setNotice('Guardamos sus controles.');
            }}
            onUnlinked={() => navigate('/cuenta/hijos', { replace: true })}
            onClosed={() => setSheet(null)}
          />
        ) : null}
      </main>
    </AppShell>
  );
}

export function ChildAccountView({
  child,
  wallet,
  orders,
  ordersFailed,
  scheduled,
}: {
  child: Dependent;
  wallet: WalletData | null;
  orders: OrderDetail[] | null;
  ordersFailed: boolean;
  /** «Su comida apartada», entre los controles y los movimientos como en Expo. */
  scheduled?: ReactNode;
}) {
  const balance = wallet?.wallet.saldo ?? child.balance ?? '0.00';
  const controls = child.controls;
  const movements = wallet?.movimientos ?? null;
  const principal = child.guardians.find((guardian) => guardian.isPrincipal);
  return (
    <>
      <section className="alumno-wallet-hero parent-mode__hero" aria-labelledby="child-balance">
        <p className="alumno-muted" id="child-balance">
          Saldo de {firstName(child.name)}
        </p>
        <p className="alumno-wallet-balance" data-testid="child-balance">
          {formatAmount(balance, 'always')}
        </p>
        <dl className="parent-mode__today">
          <div>
            <dt>Hoy le quedan</dt>
            <dd>{dailyRemainingLabel(controls) ?? '—'}</dd>
          </div>
          <div>
            <dt>Gastó hoy</dt>
            <dd>{controls?.spentToday ? formatAmount(controls.spentToday) : '—'}</dd>
          </div>
          <div>
            <dt>Límite diario</dt>
            <dd>{controls?.dailyLimit ? formatAmount(controls.dailyLimit) : 'Sin límite'}</dd>
          </div>
        </dl>
      </section>

      <section className="alumno-card parent-mode__controls" aria-label="Controles">
        <dl>
          <div>
            <dt>Alergias</dt>
            <dd>{allergensLine(controls)}</dd>
          </div>
          <div>
            <dt>No puede comprar</dt>
            <dd>{blockedLine(controls)}</dd>
          </div>
        </dl>
        {!child.isPrincipal && principal ? (
          <p className="alumno-muted">Los controles los pone {firstName(principal.name)}.</p>
        ) : null}
      </section>

      {scheduled}

      <section className="alumno-wallet-rest" aria-labelledby="child-moves">
        <h2 className="alumno-section-label" id="child-moves">
          Últimos movimientos
        </h2>
        {movements === null ? (
          <p className="alumno-muted">No pudimos traer sus movimientos.</p>
        ) : movements.length === 0 ? (
          <p className="alumno-muted">Aquí verás sus recargas y lo que compre con saldo.</p>
        ) : (
          <ul className="alumno-moves parent-mode__moves">
            {movements.slice(0, MOVEMENTS_SHOWN).map((movement) => (
              <li key={movement.id}>
                <span>
                  <strong>{movementLabel(movement)}</strong>
                  <span className="alumno-muted">
                    {[shortDate(movement.creado_en), `Saldo después: ${formatAmount(movement.saldo_posterior)}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <strong>{signedAmount(movement.monto)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="alumno-wallet-rest" aria-labelledby="child-orders">
        <h2 className="alumno-section-label" id="child-orders">
          Lo que pidió
        </h2>
        {ordersFailed ? (
          <p className="alumno-muted">No pudimos traer sus pedidos.</p>
        ) : orders === null ? null : orders.length === 0 ? (
          <p className="alumno-muted">Todavía no tiene pedidos.</p>
        ) : (
          <ul className="alumno-moves parent-mode__orders">
            {orders.slice(0, ORDERS_SHOWN).map((order) => (
              <li key={order.id}>
                <span>
                  <strong>{orderSummary(order) || `Pedido #${order.folio}`}</strong>
                  <span className="alumno-muted">
                    {[`#${order.folio}`, ORDER_STATUS_LABEL[order.estado] ?? order.estado, shortDate(order.creado_en)]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <strong>{formatAmount(order.total, 'always')}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function schoolToday(calendar: ChildMenuCalendar | null): string {
  return calendar?.schedule.today || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
}

/** «Su comida apartada»: los pedidos de la escuela con día de entrega de hoy en adelante. */
function ScheduledSection({
  orders,
  calendar,
  onCancel,
}: {
  orders: OrderDetail[] | null;
  calendar: ChildMenuCalendar | null;
  onCancel: (order: OrderDetail) => void;
}) {
  const today = schoolToday(calendar);
  const cancelCutoff = calendar?.schedule.cancelCutoff ?? null;
  const scheduled = (orders ?? [])
    .filter((order) => {
      const delivery = order.fecha_entrega?.slice(0, 10);
      return delivery && delivery >= today && order.estado !== 'cancelado';
    })
    .sort((a, b) => (a.fecha_entrega ?? '').localeCompare(b.fecha_entrega ?? ''));
  return (
    <section className="alumno-wallet-rest" aria-labelledby="child-scheduled">
      <h2 className="alumno-section-label" id="child-scheduled">
        Su comida apartada
      </h2>
      {scheduled.length === 0 ? (
        <p className="alumno-muted">Todavía no tiene comidas apartadas.</p>
      ) : (
        <>
          <ul className="alumno-moves parent-mode__orders">
            {scheduled.map((order) => (
              <li key={order.id}>
                <span>
                  <strong>{orderSummary(order) || `Pedido #${order.folio}`}</strong>
                  <span className="alumno-muted">
                    {[dayLabel(order.fecha_entrega ?? '', today), order.franja_entrega, formatAmount(order.total, 'always')]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                {canCancelScheduled(order, today, cancelCutoff) ? (
                  <button className="alumno-link parent-sheet__danger-link" type="button" onClick={() => onCancel(order)}>
                    Cancelar
                  </button>
                ) : (
                  <span className="alumno-muted">{ORDER_STATUS_LABEL[order.estado] ?? order.estado}</span>
                )}
              </li>
            ))}
          </ul>
          <p className="alumno-muted">{scheduledOrderPolicyText(cancelCutoff)}</p>
        </>
      )}
    </section>
  );
}

function dayLabel(date: string, today: string): string {
  const day = date.slice(0, 10);
  if (!day) return '';
  return dayShortLabel(day, today);
}