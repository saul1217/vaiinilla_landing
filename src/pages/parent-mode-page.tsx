import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { AlumnoPageHeader } from '../components/alumno-brand';
import { AppShell } from '../components/app-shell';
import { LoadingSkeleton } from '../components/loading-skeleton';
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
  dailyRemainingLabel,
  DependentContextSession,
  firstName,
  movementLabel,
  orderSummary,
  shortDate,
  signedAmount,
  type Dependent,
  type PrivacyNotice,
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready || !user) {
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

  return { user, ready, token, placeName, error, loading };
}

/** `/cuenta/hijos`: Mis hijos con su saldo y lo que les queda hoy. */
export function ParentModePage() {
  const { user, ready, token, placeName, error: sessionError, loading: sessionLoading } = useGuardianSession();
  const [children, setChildren] = useState<Dependent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);

  useEffect(() => {
    if (!token) return;
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
    return () => {
      active = false;
    };
  }, [token]);

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
            open={consentOpen}
            onToggle={() => setConsentOpen((value) => !value)}
            onAccepted={(list) => {
              setChildren(list);
              setConsentOpen(false);
            }}
          />
        ) : null}
        {children && children.length === 0 ? (
          <section className="alumno-card parent-mode__empty">
            <h2>Aún no tienes hijos en esta escuela</h2>
            <p className="alumno-muted">
              Agrégalos desde la app de Vaiinilla en Cartera › Opciones avanzadas. Cuando la escuela te apruebe, aquí
              verás su saldo y lo que compran.
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

function ConsentCard({
  token,
  names,
  open,
  onToggle,
  onAccepted,
}: {
  token: string;
  names: string[];
  open: boolean;
  onToggle: () => void;
  onAccepted: (children: Dependent[]) => void;
}) {
  const [notice, setNotice] = useState<PrivacyNotice | null>(null);
  const [checked, setChecked] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key] = useState(createIdempotencyKey);

  const loadNotice = useCallback(async () => {
    try {
      setNotice(await api.getGuardianPrivacyNotice(token));
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, [token]);

  useEffect(() => {
    if (open && !notice) void loadNotice();
  }, [loadNotice, notice, open]);

  const accept = async () => {
    if (!notice) return;
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
      <p className="alumno-muted">No bloquea nada: puedes seguir viendo su saldo mientras lo lees.</p>
      <button type="button" className="alumno-btn" aria-expanded={open} onClick={onToggle}>
        {open ? 'Cerrar el aviso' : 'Leer el aviso'}
      </button>
      {open ? (
        <div className="parent-mode__notice">
          {notice ? (
            <>
              <h3>{notice.title}</h3>
              {notice.draft ? <p className="alumno-muted">Borrador: este aviso aún se está revisando.</p> : null}
              {notice.paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
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
          ) : error ? null : (
            <p className="alumno-muted">Cargando el aviso…</p>
          )}
        </div>
      ) : null}
      {error ? <p className="alumno-error">{error}</p> : null}
    </section>
  );
}

/** `/cuenta/hijos/:id`: la cuenta de un hijo vista con su contexto (saldo, movimientos y pedidos). */
export function ChildAccountPage() {
  const { id = '' } = useParams();
  const { user, ready, token, error: sessionError } = useGuardianSession();
  const [child, setChild] = useState<Dependent | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [orders, setOrders] = useState<OrderDetail[] | null>(null);
  const [ordersFailed, setOrdersFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessLost, setAccessLost] = useState(false);
  const [loading, setLoading] = useState(true);

  const session = useMemo(
    () => (token ? new DependentContextSession(() => api.issueDependentContext(token, id)) : null),
    [id, token],
  );

  useEffect(() => {
    if (!token || !session) return;
    let active = true;
    const lost = (cause: unknown) =>
      cause instanceof VaiinillaApiError && (ACCESS_LOST_CODES.has(cause.code) || cause.status === 404);
    void (async () => {
      setLoading(true);
      try {
        const list = await api.listDependents(token);
        const found = list.find((item) => item.userId === id) ?? null;
        if (!active) return;
        setChild(found);
        if (!found || found.state !== 'aprobada') {
          setAccessLost(true);
          return;
        }
        const [walletResult, ordersResult] = await Promise.allSettled([
          session.run((childToken) => api.getDependentWallet(childToken)),
          session.run((childToken) => api.listDependentOrders(childToken)),
        ]);
        if (!active) return;
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
      } catch (cause) {
        if (!active) return;
        if (lost(cause)) setAccessLost(true);
        else setError(errorMessage(cause));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, session, token]);

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
        {shownError && !accessLost ? <p className="alumno-error">{shownError}</p> : null}
        {loading && !wallet && !shownError && !accessLost ? (
          <LoadingSkeleton shape="wallet" label={`Abriendo la cuenta de ${firstName(name)}…`} />
        ) : null}
        {child && !accessLost && (wallet || !loading) ? (
          <ChildAccountView child={child} wallet={wallet} orders={orders} ordersFailed={ordersFailed} />
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
}: {
  child: Dependent;
  wallet: WalletData | null;
  orders: OrderDetail[] | null;
  ordersFailed: boolean;
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
        <p className="alumno-muted">Para recargar o cambiar sus controles usa la app de Vaiinilla.</p>
      </section>

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
