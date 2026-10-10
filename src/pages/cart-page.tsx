import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlumnoPageHeader } from '../components/alumno-brand';
import { AppShell } from '../components/app-shell';
import { MenuPeek } from '../components/menu-peek';
import { useAuth } from '../context/auth-context';
import { firebaseIdToken } from '../lib/firebase';
import { markVerificationSent } from '../lib/verification';
import { useBuyerSession } from '../context/buyer-session';
import { useCart } from '../context/cart-context';
import { api } from '../lib/api';
import { errorMessage, VaiinillaApiError } from '../lib/api-error';
import { canAcceptOrders, canPayAtEnd, cardFee, cartTotal, toCreateOrderInput, unitFor } from '../lib/cart';
import { leftoverPeekProducts, peekCatalogProducts, productImageUrl } from '../lib/catalog-images';
import { forgetIdempotencyKey, idempotencyKeyFor, orderFingerprint } from '../lib/idempotency';
import { formatAmount, linePreview, moneyToCents } from '../lib/money';
import { piecesLabel, splitPieces } from '../lib/product-pieces';
import { resolveClientSession } from '../lib/client-session';
import { lastPlaceSlug } from '../lib/last-place';
import { orderHistoryHeadline } from '../lib/order-labels';
import { rememberPickupQrToken } from '../lib/pickup-qr';
import { activeRentalSpace, forgetSpace, readSpace, rememberSpace } from '../lib/space-session';
import { deliveredAtLabel, spaceNoun } from '../lib/space-words';
import { readPendingStripeOrderId, savePendingStripeOrderId } from '../lib/stripe-pending';
import { isStripeCheckoutEnabled, offersCardPayment, STRIPE_UNAVAILABLE_COPY } from '../lib/stripe-public';
import { rememberStripeCheckoutSession, stripeSessionFromCreatedOrder } from '../lib/stripe-session';
import { readGuest } from '../lib/guest-session';
import { clientSessionForPlace } from '../lib/client-session-for-place';
import { currentScannedTable, joinedScannedTable } from '../lib/scanned-table';
import { rememberGuestOrder, trackingPath } from '../lib/guest-orders';
import type { SpaceSession } from '../lib/space-session';
import type {
  LegalVersions,
  CartLine,
  CatalogProduct,
  OperationalStatus,
  OrderDetail,
  PaymentMethod,
  PublicEstablishment,
  WalletData,
} from '../types/api';
import { LoadingSkeleton } from '../components/loading-skeleton';
import { MotionSheet } from '../components/motion-sheet';

export function CartPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { cart, updateQuantity, removeLine, reset } = useCart();
  const { user, ready } = useAuth();
  const { context, openClientSession } = useBuyerSession();
  const openClientSessionRef = useRef(openClientSession);
  openClientSessionRef.current = openClientSession;
  const [place, setPlace] = useState<PublicEstablishment | null>(null);
  const [status, setStatus] = useState<OperationalStatus | null>(null);
  const [operationalError, setOperationalError] = useState<string | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [payment, setPayment] = useState<PaymentMethod>('efectivo');
  const [payAtEnd, setPayAtEnd] = useState(() => readSpace(slug)?.pagaAlFinal === true);
  const [notes, setNotes] = useState('');
  const [clientId, setClientId] = useState(
    () => sessionStorage.getItem(`vaiinilla.buyer.client-id.${slug}`) ?? '',
  );
  const [error, setError] = useState<string | null>(null);
  const [emailBlocked, setEmailBlocked] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const confirming = useRef(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [previousOrders, setPreviousOrders] = useState<OrderDetail[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const menuPeek = useMemo(() => peekCatalogProducts(catalogProducts), [catalogProducts]);
  const [spaceVersion, setSpaceVersion] = useState(0);
  const scanned = useMemo(() => readSpace(slug), [slug, spaceVersion]);
  // Sin QR escaneado, una renta en curso en este negocio hace de mesa: la comida va a la cancha.
  const [rentalSpace, setRentalSpace] = useState<SpaceSession | null>(null);
  const space = scanned ?? rentalSpace;
  const [forHere, setForHere] = useState(Boolean(space));
  useEffect(() => {
    if (rentalSpace && !scanned) setForHere(true);
  }, [rentalSpace, scanned]);
  const handleLeaveSpace = () => {
    forgetSpace();
    setForHere(false);
    setTableAlias(null);
    setSpaceVersion((v) => v + 1);
  };
  // Compra sin cuenta: quien no entra pide con solo su nombre, salvo donde el negocio
  // exige un identificador (matrícula), que necesita cuenta.
  const guest = !user;
  // Cuenta a medias (sin alta o sin verificar) que paga en caja: confirma como
  // invitado y sus pedidos se reclaman solos al verificarla.
  const [fallbackGuest, setFallbackGuest] = useState(false);
  const guestLike = guest || fallbackGuest;
  // Sin cuenta no hay sesión para leer el estado operativo: lo dice la ficha pública.
  // El fallback a invitado (cuenta sin verificar) sigue la regla de invitado.
  const tabAllowed = !guestLike
    ? canPayAtEnd(status, forHere && Boolean(space))
    : forHere && Boolean(space) && place?.permite_pago_al_final === true;
  const useTab = payAtEnd && tabAllowed && payment === 'efectivo';
  const stripeEnabled = isStripeCheckoutEnabled();
  const cardOffered = offersCardPayment(place);
  const pendingStripeOrderId = readPendingStripeOrderId();
  const guestBlocked = guest && place?.identificador_cliente_obligatorio === true;
  const canCheckout = !guestBlocked;
  const [guestName, setGuestName] = useState(() => readGuest()?.nombre ?? '');
  // En mesa con participante vigente no se pide nombre: el pedido ya va a su nombre.
  const qrToken = scanned?.qrToken ?? null;
  const [tableAlias, setTableAlias] = useState<string | null>(null);
  useEffect(() => {
    // Sin identidad de participante no hay nada que confirmar: no se consulta la mesa.
    if (!qrToken || !scanned || !joinedScannedTable(scanned)) {
      setTableAlias(null);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const client = await clientSessionForPlace({
          slug,
          place,
          user: user ?? null,
          context,
          openClientSession: openClientSessionRef.current,
        });
        if (!active) return;
        const activeTable = await currentScannedTable(client.access_token, scanned);
        if (!active) return;
        // currentScannedTable limpia la identidad local si cambió la sesión. En ese
        // caso, no reutilizamos una identidad que el backend aún no confirmó.
        if (!activeTable || !joinedScannedTable(scanned)) {
          setTableAlias(null);
          if (!activeTable) {
            setForHere(false);
            setSpaceVersion((v) => v + 1);
          }
          return;
        }
        const table = await api.tableSession(client.access_token, qrToken);
        if (!active) return;
        // Solo el servidor confirma quién está unido. El displayName de la cuenta
        // no atribuye pedidos a un participante temporal.
        setTableAlias(
          table.sesion_id === activeTable.sesion_id && Number(table.espacio.id) === Number(scanned.espacioId)
            ? table.yo?.alias ?? null
            : null,
        );
      } catch {
        if (active) setTableAlias(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [context, qrToken, scanned, slug, user, place]);
  const guestNameValid = tableAlias ? true : guestName.trim().length >= 2;
  const whoHref =
    qrToken != null ? `/e/${slug}/m/${encodeURIComponent(qrToken)}/quien?next=${encodeURIComponent(`/e/${slug}/carrito`)}` : null;
  const [legal, setLegal] = useState<LegalVersions | null>(null);
  useEffect(() => {
    if (!guest || legal) return;
    void Promise.resolve()
      .then(() => api.getLegalVersions())
      .then((next) => setLegal(next ?? null))
      .catch(() => undefined);
  }, [guest, legal]);

  const lines = useMemo(() => (cart?.slug === slug ? cart.lines : []), [cart, slug]);
  const leftoverPeek = useMemo(
    () => leftoverPeekProducts(catalogProducts, lines.map((line) => line.productId)),
    [catalogProducts, lines],
  );
  // Solo la tarjeta lleva la comisión: el total y la validación de saldo siguen al método.
  const total = useMemo(() => cartTotal(lines, payment), [lines, payment]);
  // Desglose de la comisión: el total con tarjeta se ve igual, pero se dice por qué subió.
  const fee = useMemo(() => (payment === 'stripe' ? cardFee(lines) : null), [lines, payment]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      api.getEstablishment(slug),
      api.getGuestCatalog(slug).catch(() => ({ categorias: [], productos: [] })),
    ])
      .then(([next, catalog]) => {
        const products = Array.isArray(catalog?.productos) ? catalog.productos : [];
        if (!active) return;
        setCatalogProducts(products);
        setPlace(next);
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!context || !place || context.contexto.establecimiento_id !== place.id) {
      setStatus(null);
      setWallet(null);
      setOperationalError(null);
      return;
    }
    let active = true;
    setStatus(null);
    setOperationalError(null);
    void Promise.all([
      api.getOperationalStatus(context.access_token),
      api.getMyWallet(context.access_token).catch(() => null),
      api.listReservations(context.access_token).catch(() => []),
    ])
      .then(([nextStatus, nextWallet, rentals]) => {
        if (!active) return;
        setRentalSpace(activeRentalSpace(slug, rentals, Date.now()));
        setStatus(nextStatus);
        setWallet(nextWallet);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setStatus(null);
        setOperationalError(errorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [context, place, slug]);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      setPreviousOrders([]);
      setHistoryLoading(false);
      setHistoryError(null);
      return;
    }
    let active = true;
    setHistoryLoading(true);
    setHistoryError(null);
    const run = async () => {
      try {
        const resolved = await resolveClientSession({
          user,
          context,
          preferredSlug: slug || lastPlaceSlug(),
          openClientSession: openClientSessionRef.current,
        });
        if (!resolved) {
          if (active) setPreviousOrders([]);
          return;
        }
        const result = await api.listOrders(resolved.context.access_token);
        if (!active) return;
        const next = result.orders.filter((item) => item.estado === 'entregado').slice(0, 8);
        setPreviousOrders((current) => {
          if (
            current.length === next.length &&
            current.every((item, index) => item.id === next[index]?.id && item.estado === next[index]?.estado)
          ) {
            return current;
          }
          return next;
        });
        setHistoryError(null);
      } catch (cause) {
        if (active) {
          setPreviousOrders([]);
          setHistoryError(errorMessage(cause));
        }
      } finally {
        if (active) setHistoryLoading(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [context, place, ready, slug, user]);

  const hasMatchingContext = Boolean(
    context && place && context.contexto.establecimiento_id === place.id,
  );
  const operationalVerificationPending = hasMatchingContext && !status && !operationalError;
  const blocker =
    lines.length === 0
      ? null
      : status
        ? canAcceptOrders(status)
          ? null
          : 'El establecimiento no está recibiendo pedidos en este momento.'
        : operationalError
          ? 'No pudimos verificar si el establecimiento está recibiendo pedidos.'
          : null;

  const insufficientBalance =
    payment === 'saldo' &&
    total &&
    wallet &&
    (moneyToCents(wallet.wallet.saldo) ?? 0n) < (moneyToCents(total) ?? 0n);

  async function confirm(retried = false) {
    // Un solo pedido a la vez: un segundo toque mientras se crea no abre otro.
    if (confirming.current && !retried) return;
    setError(null);
    setEmailBlocked(false);
    if (!place || lines.length === 0 || !total) return;
    if (guestBlocked) {
      void navigate(`/cuenta?next=/e/${slug}/carrito`);
      return;
    }
    if (guestLike && !guestNameValid && !qrToken) {
      setError('Escribe tu nombre para que sepan de quién es el pedido.');
      return;
    }
    if (guestLike && payment === 'saldo') {
      setError('El saldo Vaiinilla es de tu cuenta: paga en caja o con tarjeta.');
      return;
    }
    if (payment === 'stripe' && !stripeEnabled) {
      setError(STRIPE_UNAVAILABLE_COPY);
      return;
    }
    const pendingId = readPendingStripeOrderId();
    if (pendingId) {
      setError('Tienes un pago Stripe pendiente. Resuélvelo antes de crear otro pedido.');
      return;
    }
    confirming.current = true;
    setSubmitting(true);
    try {
      const storedId = clientId || sessionStorage.getItem(`vaiinilla.buyer.client-id.${slug}`) || undefined;
      const asGuest = !user || fallbackGuest;
      let session;
      try {
        // Invitado (con nombre, o anónimo en mesa con participante) o registrado:
        // una sola función para no duplicar la resolución de sesión.
        // En mesa con participante el nombre temporal vive en el participante, no en
        // el invitado: se reusa la llave anónima del dispositivo (la misma con que se
        // unió a la mesa) y nunca se manda el alias como nombre.
        session = await clientSessionForPlace({
          slug,
          place,
          user: asGuest ? null : user,
          context: asGuest ? null : context,
          openClientSession,
          guestName: tableAlias ? undefined : asGuest ? guestName : undefined,
          clientId: storedId,
        });
      } catch (cause) {
          // Cuenta a medias (sin alta o correo sin verificar) que paga en caja:
          // no se le rebota a /cuenta; confirma como invitado y reclama después.
          const code = cause instanceof VaiinillaApiError ? cause.code : null;
          const cashLike = payment !== 'saldo' && payment !== 'stripe';
          const pending =
            code === 'IDENTITY_NOT_REGISTERED' || (code === 'EMAIL_NOT_VERIFIED' && retried);
          if (pending && cashLike && !fallbackGuest) {
            setFallbackGuest(true);
            if (!guestName.trim()) {
              const suggested = user?.displayName?.trim() ?? '';
              if (suggested) setGuestName(suggested);
            }
            setError(
              'Tu cuenta aún no está verificada, pero en caja sí puedes pedir: confirma como invitado y tus pedidos pasarán a tu cuenta al verificarla.',
            );
            confirming.current = false;
            setSubmitting(false);
            return;
          }
          throw cause;
        }
      const operational = await api.getOperationalStatus(session.access_token);
      setStatus(operational);
      if (!canAcceptOrders(operational)) {
        throw new Error('El establecimiento no está recibiendo pedidos en este momento.');
      }
      // Si aún no se sabía de la renta (se paga antes de que llegue), se busca aquí.
      let target = space;
      let here = forHere;
      if (!target) {
        const rentals = await api.listReservations(session.access_token).catch(() => []);
        target = activeRentalSpace(slug, rentals, Date.now());
        here = Boolean(target);
        if (target) setRentalSpace(target);
      }
      const destination = here && target ? 'en_espacio' : 'para_llevar';
      if (useTab && !canPayAtEnd(operational, destination === 'en_espacio')) {
        throw new Error('Este negocio ya no permite pagar al final. Elige otra forma de pago.');
      }
      if (destination === 'en_espacio' && target?.tipo === 'mesa' && qrToken && whoHref) {
        // El estado local solo sirve para presentar la UI. Antes de crear el pedido
        // confirmamos en backend que esta identidad sigue en la mesa abierta. Sin
        // identidad se pide unirse; con la mesa liberada no se pide nada ni se reabre.
        if (!joinedScannedTable(target)) {
          void navigate(whoHref);
          return;
        }
        if (!(await currentScannedTable(session.access_token, target))) {
          setForHere(false);
          setSpaceVersion((v) => v + 1);
          throw new Error('Tu mesa ya no está abierta. Escanea el QR de la mesa para pedir.');
        }
        // /mesas/actual confirma que la sesión sigue abierta; este endpoint confirma
        // que el backend reconoce al participante local antes de crear el pedido.
        const table = await api.tableSession(session.access_token, qrToken);
        if (!table.yo || Number(table.espacio.id) !== Number(target.espacioId)) {
          void navigate(whoHref);
          return;
        }
      }
      const payload = toCreateOrderInput(
        lines,
        payment,
        notes,
        destination,
        destination === 'en_espacio' && target ? target.espacioId : null,
        useTab,
      );
      const fingerprint = orderFingerprint(payload);
      const key = idempotencyKeyFor(fingerprint);
      const order = await api.createOrder(session.access_token, payload, key);
      rememberPickupQrToken(order.id, order.qr_token);
      if (payment === 'stripe') {
        const stripeSession = stripeSessionFromCreatedOrder(order);
        rememberStripeCheckoutSession(order.id, stripeSession);
        // Sin cuenta el pago se termina en el enlace de seguimiento, no en Mis pedidos.
        if (user) savePendingStripeOrderId(order.id);
      }
      reset();
      // La mesa se conserva para pedir otra ronda sin volver a escanear.
      if (destination === 'en_espacio' && target) rememberSpace({ ...target, pagaAlFinal: useTab });
      forgetIdempotencyKey(fingerprint);
      // La tarjeta se cobra en la pantalla del pedido (espera la confirmación de Stripe);
      // el resto va a Mis pedidos, con el arcade y el pedido nuevo ya abierto.
      if ((!user || fallbackGuest) && order.seguimiento_token) {
        // Sin cuenta, el enlace se guarda como respaldo; el pedido vive en Mis pedidos.
        rememberGuestOrder({
          token: order.seguimiento_token,
          slug,
          folio: order.folio,
          placeName: place.nombre,
          createdAt: Date.now(),
        });
        // Solo la tarjeta se termina en el seguimiento; lo demás abre Mis pedidos igual
        // que un registrado (el pedido se expande por su token). El fallback (cuenta a
        // medias) también va al seguimiento: su pedido aún no vive en la cuenta.
        if (payment === 'stripe' || fallbackGuest) {
          void navigate(`${trackingPath(order.seguimiento_token)}?nuevo=1`);
          return;
        }
        void navigate(`/cuenta/pedidos?nuevo=${order.seguimiento_token}`);
        return;
      }
      void navigate(payment === 'stripe' ? `/cuenta/pedidos/${order.id}` : `/cuenta/pedidos?nuevo=${order.id}`);
    } catch (cause) {
      if (cause instanceof VaiinillaApiError && cause.code === 'IDENTITY_NOT_REGISTERED') {
        void navigate(`/cuenta?next=/e/${slug}/carrito`);
        return;
      }
      if (cause instanceof VaiinillaApiError && cause.code === 'EMAIL_NOT_VERIFIED' && user && !retried) {
        // Acaba de verificar en el correo pero el token trae el claim viejo (vive
        // hasta una hora): se fuerza uno fresco y se reintenta una vez en silencio.
        try {
          await user.getIdToken(true);
        } catch {
          // Sigue al reenvío con el error original.
        }
        // Se espera el reintento: el botón sigue bloqueado hasta que termine.
        await confirm(true);
        return;
      }
      setEmailBlocked(cause instanceof VaiinillaApiError && cause.code === 'EMAIL_NOT_VERIFIED');
      setError(errorMessage(cause));
    } finally {
      if (!retried) confirming.current = false;
      setSubmitting(false);
    }
  }

  async function resendVerification() {
    if (!user || verifyBusy) return;
    setVerifyBusy(true);
    setVerifyNotice(null);
    try {
      await api.sendVerificationEmail(await firebaseIdToken(user));
      markVerificationSent();
      setVerifyNotice('Listo, revisa tu bandeja (y el spam). Después vuelve a continuar.');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setVerifyBusy(false);
    }
  }

  return (
    <AppShell tab="cart">
      <main id="main-content" className="alumno-main">
        <AlumnoPageHeader kicker="Revisa y confirma" title="Tu pedido" />
        {error ? <p className="alumno-error">{error}</p> : null}
        {emailBlocked && user ? (
          <p className="alumno-banner">
            Sin verificar no puedes usar saldo ni tarjeta: elige pago en caja o verifica tu correo.{' '}
            <button
              className="alumno-link"
              type="button"
              disabled={verifyBusy}
              onClick={() => void resendVerification()}
            >
              {verifyBusy ? 'Enviando…' : 'Reenviar correo de verificación'}
            </button>
            {verifyNotice ? <> {verifyNotice}</> : null}
          </p>
        ) : null}
        {blocker ? <p className="alumno-banner alumno-banner--coral">{blocker}</p> : null}
        {pendingStripeOrderId ? (
          <p className="alumno-banner">
            Tienes un pago Stripe pendiente.{' '}
            <Link to={`/cuenta/pedidos/${pendingStripeOrderId}`}>Revisar pago pendiente</Link>
          </p>
        ) : null}
        {lines.length === 0 ? (
          <CartEmptyView
            slug={slug}
            previousOrders={previousOrders}
            historyLoading={Boolean(user) && historyLoading}
            historyError={historyError}
            menuPeek={menuPeek}
          />
        ) : (
          <CartFilledView
            lines={lines}
            payment={payment}
            onUpdateQuantity={updateQuantity}
            onRemoveLine={removeLine}
            forHere={forHere}
            space={space}
            onToggleDestination={() => {
              if (space) setForHere((value) => !value);
            }}
            onLeaveSpace={handleLeaveSpace}
            place={place}
            clientId={clientId}
            onClientIdChange={setClientId}
            notes={notes}
            onNotesChange={setNotes}
            total={total}
            slug={slug}
            menuPeek={leftoverPeek}
            payLabel={
              canCheckout
                ? operationalVerificationPending
                  ? 'Verificando…'
                  : 'Continuar'
                : 'Crea tu cuenta para pedir aquí'
            }
            payDisabled={
              !ready ||
              operationalVerificationPending ||
              Boolean(blocker) ||
              Boolean(pendingStripeOrderId)
            }
            onPay={() =>
              canCheckout ? setSheetOpen(true) : void navigate(`/cuenta?next=/e/${slug}/carrito`)
            }
          />
        )}
      </main>
      {sheetOpen ? (
        <MotionSheet className="alumno-sheet alumno-codesheet alumno-paysheet" labelledBy="pay-title" onClosed={() => setSheetOpen(false)}>
          {(close, dragHandle) => (
            <div className="alumno-codesheet__panel">
              <div className="alumno-codesheet__grab" {...dragHandle}>
                <span aria-hidden="true" />
              </div>
              <div className="alumno-paysheet__head">
                <h2 id="pay-title">¿Cómo quieres pagar?</h2>
                <button type="button" className="alumno-paysheet__close" onClick={close} aria-label="Cerrar">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
                </button>
              </div>
              <p className="alumno-paysheet__total">Total {total ? formatAmount(total) : '—'}</p>
              {fee ? (
                <p className="alumno-muted alumno-paysheet__fee">
                  Incluye comisión por tarjeta {formatAmount(fee)}.
                </p>
              ) : null}
              {whoHref && !tableAlias ? (
                <p className="alumno-guest-checkout__who">
                  Para pedir en esta mesa, primero elige quién eres.{' '}
                  <Link to={whoHref}>Elegir participante</Link>
                </p>
              ) : tableAlias && whoHref ? (
                <p className="alumno-guest-checkout__who">
                  Pides como {tableAlias} · <Link to={whoHref}>Cambiar</Link>
                </p>
              ) : guestLike && !whoHref ? (
                <div className="alumno-guest-checkout">
                  <label className="alumno-field">
                    <span>Tu nombre</span>
                    <input
                      value={guestName}
                      onChange={(event) => setGuestName(event.target.value)}
                      autoComplete="given-name"
                      maxLength={60}
                      placeholder="Para que sepan de quién es el pedido"
                    />
                  </label>
                  <p className="alumno-muted alumno-guest-checkout__note">
                    {fallbackGuest ? (
                      <>
                        Tu cuenta aún no está verificada: pides como invitado. Al
                        verificarla, este pedido pasará a tu cuenta solo.
                      </>
                    ) : (
                      <>
                        Sin cuenta: solo tu nombre. Al confirmar te damos un enlace para seguir tu pedido.{' '}
                        <Link to={`/cuenta?next=/e/${slug}/carrito`}>¿Tienes cuenta? Entra</Link>
                      </>
                    )}
                  </p>
                </div>
              ) : null}
              {tabAllowed && space ? (
                <PayOption
                  selected={useTab}
                  icon="tab"
                  title="Pagar al final"
                  badge="Cuenta"
                  subtitle={`Pide ahora y paga todo junto al irte de tu ${spaceNoun(space.tipo)}.`}
                  onSelect={() => {
                    setPayment('efectivo');
                    setPayAtEnd(true);
                  }}
                />
              ) : null}
              <PayOption
                selected={payment === 'efectivo' && !useTab}
                icon="cash"
                title="Pago en caja"
                badge="Efectivo"
                subtitle="Pagas en caja cuando el pedido esté listo."
                onSelect={() => {
                  setPayment('efectivo');
                  setPayAtEnd(false);
                }}
              />
              {user ? (
                <PayOption
                  selected={payment === 'saldo'}
                  icon="wallet"
                  title="Saldo Vaiinilla"
                  badge="Saldo"
                  subtitle={
                    insufficientBalance && wallet
                      ? `Saldo insuficiente · Disponible: ${formatAmount(wallet.wallet.saldo)}`
                      : wallet
                        ? `Disponible: ${formatAmount(wallet.wallet.saldo)}`
                        : 'Entra a tu cuenta para ver el saldo.'
                  }
                  onSelect={() => {
                    setPayment('saldo');
                    setPayAtEnd(false);
                  }}
                />
              ) : null}
              {/* Oculta hasta que el dueño active la tarjeta en su panel (el flujo queda intacto). */}
              {/* Sin cuenta, por ahora solo caja o pagar al final: la tarjeta aún no termina de cobrar. */}
              {cardOffered && !guestLike ? (
              <PayOption
                selected={payment === 'stripe'}
                icon="card"
                title="Pago con Stripe"
                badge="Stripe"
                subtitle={stripeEnabled ? 'Tarjeta de débito o crédito · Pago seguro con Stripe.' : STRIPE_UNAVAILABLE_COPY}
                disabled={!stripeEnabled}
                onSelect={() => {
                  if (!stripeEnabled) return;
                  setPayment('stripe');
                  setPayAtEnd(false);
                }}
              />
              ) : null}
              {error ? <p className="alumno-error">{error}</p> : null}
              {insufficientBalance ? (
                <p className="alumno-error">
                  No tienes saldo suficiente para este pedido.{' '}
                  <Link to="/cuenta/saldo">Ver mi saldo y cómo recargar en caja</Link>
                </p>
              ) : null}
              {guestLike ? (
                <p className="alumno-muted alumno-guest-checkout__legal">
                  Al pedir aceptas los{' '}
                  <a href={legal?.terminos_url ?? '/terminos'} target="_blank" rel="noreferrer">Términos</a> y el{' '}
                  <a href={legal?.privacidad_url ?? '/privacidad'} target="_blank" rel="noreferrer">Aviso de privacidad</a>.
                </p>
              ) : null}
              <button
                className="alumno-btn alumno-btn--lime alumno-paysheet__cta"
                type="button"
                disabled={
                  submitting ||
                  Boolean(insufficientBalance) ||
                  Boolean(pendingStripeOrderId) ||
                  (guestLike && !guestNameValid)
                }
                onClick={() => void confirm()}
              >
                {submitting ? 'Confirmando…' : `Continuar con ${useTab ? 'pagar al final' : PAY_LABEL[payment]}`}
              </button>
            </div>
          )}
        </MotionSheet>
      ) : null}
    </AppShell>
  );
}

export function CartFilledView({
  lines,
  onUpdateQuantity,
  onRemoveLine,
  forHere,
  space,
  onToggleDestination,
  onLeaveSpace,
  place,
  clientId,
  onClientIdChange,
  notes,
  onNotesChange,
  total,
  payLabel,
  payDisabled,
  onPay,
  slug,
  menuPeek = [],
  payment,
}: {
  lines: CartLine[];
  payment: PaymentMethod;
  onUpdateQuantity: (productId: number, optionIds: number[], quantity: number, notes?: string) => void;
  onRemoveLine: (productId: number, optionIds: number[], notes?: string) => void;
  forHere: boolean;
  space: SpaceSession | null;
  onToggleDestination: () => void;
  onLeaveSpace?: () => void;
  place: PublicEstablishment | null;
  clientId: string;
  onClientIdChange: (value: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  total: string | null;
  payLabel: string;
  payDisabled: boolean;
  onPay: () => void;
  slug?: string;
  menuPeek?: CatalogProduct[];
}) {
  return (
    <div className="alumno-cart-layout">
      <div className="alumno-cart-layout__lines alumno-arrive">
        {lines.map((line) => {
          const thumb = productImageUrl(line.imageUrl);
          const lineTotal = linePreview(unitFor(line, payment), line.quantity);
          const { pieces } = splitPieces(line.productName);
          return (
            <div className="alumno-line" key={`${line.productId}-${line.optionIds.join(',')}-${line.notes || ''}`}>
              {thumb ? (
                <img className="alumno-line__thumb" src={thumb} alt="" />
              ) : (
                <div className="alumno-line__thumb alumno-line__thumb--vaini" aria-hidden="true">
                  <img src="/vaini/cutout-frente.png" alt="" />
                </div>
              )}
              <div className="alumno-line__copy">
                <strong>
                  {splitPieces(line.productName).name}
                  {pieces ? <span className="alumno-pieces"> · {piecesLabel(pieces)}</span> : null}
                </strong>
                {line.notes ? <p className="alumno-muted alumno-line__notes" style={{ margin: '0.15rem 0', fontSize: '0.85rem' }}>{line.notes}</p> : null}
                <p>{formatAmount(unitFor(line, payment))} c/u</p>
                <div className="alumno-qty">
                  <button
                    type="button"
                    aria-label={`Quitar una ${splitPieces(line.productName).name}`}
                    onClick={() => onUpdateQuantity(line.productId, line.optionIds, line.quantity - 1, line.notes)}
                  >
                    −
                  </button>
                  <span key={line.quantity} className="alumno-ticker">{line.quantity}</span>
                  <button
                    type="button"
                    aria-label={`Agregar una ${splitPieces(line.productName).name}`}
                    onClick={() => onUpdateQuantity(line.productId, line.optionIds, line.quantity + 1, line.notes)}
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="alumno-line__side">
                <span className="alumno-line__price">{lineTotal ? formatAmount(lineTotal) : '—'}</span>
                <button
                  className="alumno-line__remove"
                  type="button"
                  onClick={() => onRemoveLine(line.productId, line.optionIds, line.notes)}
                >
                  Quitar
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <aside className="alumno-cart-layout__side">
        <div className="alumno-cart-layout__checkout">
          <button type="button" className="alumno-card" onClick={onToggleDestination}>
            <h2>{forHere && space ? space.nombre : 'Para llevar'}</h2>
            <p className="alumno-muted">
              {forHere && space
                ? space.tipo === 'cancha'
                  ? `El pedido se entrega en tu cancha (se te llevará a tu ${space.nombre}). Toca para cambiar a para llevar.`
                  : `${deliveredAtLabel(space?.tipo)}. Toca para cambiar a para llevar.`
                : space
                  ? `Toca para pedir en ${space.nombre}.`
                  : 'Recoges en mostrador cuando esté listo.'}
            </p>
          </button>
          {space && onLeaveSpace ? (
            <button
              type="button"
              className="alumno-btn alumno-btn--ghost alumno-cart__leave-space"
              onClick={onLeaveSpace}
              style={{ marginTop: '-0.5rem', marginBottom: '0.75rem', width: '100%' }}
            >
              Salir de {space.nombre}
            </button>
          ) : null}
          {place?.identificador_cliente_obligatorio ? (
            <label className="alumno-field">
              {place.identificador_cliente_etiqueta}
              <input
                value={clientId}
                onChange={(event) => onClientIdChange(event.target.value)}
                required
                autoComplete="off"
              />
            </label>
          ) : null}
          <label className="alumno-field">
            Nota para cocina
            <textarea value={notes} onChange={(event) => onNotesChange(event.target.value)} rows={2} />
          </label>
          <div className="alumno-cart-layout__pay">
            <p className="alumno-cart-layout__total">
              <strong>Total {total ? formatAmount(total) : '—'}</strong>
            </p>
            <div className="alumno-sticky-pay">
              <button className="alumno-btn alumno-btn--lime" type="button" disabled={payDisabled} onClick={onPay}>
                <span>{payLabel}</span>
                {total ? (
                  <span className="alumno-sticky-pay__total" aria-hidden="true">
                    <span key={total} className="alumno-ticker">{formatAmount(total)}</span>
                  </span>
                ) : null}
              </button>
            </div>
          </div>
        </div>
      </aside>
      {slug ? (
        <MenuPeek slug={slug} products={menuPeek} headingId="filled-menu-peek" emptyMode="compact" />
      ) : null}
    </div>
  );
}

export function CartEmptyView({
  slug,
  previousOrders,
  menuPeek,
  historyLoading = false,
  historyError = null,
}: {
  slug: string;
  previousOrders: OrderDetail[];
  menuPeek: CatalogProduct[];
  historyLoading?: boolean;
  historyError?: string | null;
}) {
  const showHistory = previousOrders.length > 0;
  const showHistorySection = historyLoading || Boolean(historyError) || showHistory;
  const showPeek = menuPeek.length > 0 || !showHistory;
  const showRail = showHistorySection || showPeek;

  return (
    <div className="alumno-cart-empty">
      <div className="alumno-empty">
        <div className="alumno-antojo" aria-hidden="true">
          <span className="alumno-antojo__deco alumno-antojo__deco--note">
            <NoteIcon />
          </span>
          <img
            className="alumno-antojo__hug"
            src="/vaini/mascot-question.webp"
            alt=""
            width={216}
            height={216}
            decoding="async"
            fetchPriority="high"
          />
          <span className="alumno-antojo__deco alumno-antojo__deco--cup">
            <CupIcon />
          </span>
          <span className="alumno-antojo__deco alumno-antojo__deco--spark">✦</span>
        </div>
        <div className="alumno-empty__copy">
          <h2>¿Qué se te antoja?</h2>
          <p className="alumno-lead">Pide algo del menú y aparece aquí.</p>
          <Link className="alumno-btn alumno-btn--lime" to={`/e/${slug}`}>
            Ver menú
          </Link>
        </div>
      </div>
      {showRail ? (
        <div className="alumno-cart-empty__rail">
          {showHistorySection ? (
            <section
              className="alumno-history"
              {...(showHistory
                ? { 'aria-labelledby': 'prev-orders' }
                : { 'aria-label': 'Pedidos anteriores' })}
            >
              {showHistory ? (
                <h2 className="alumno-section-label" id="prev-orders">
                  Pedidos anteriores
                </h2>
              ) : null}
              {historyLoading ? <LoadingSkeleton shape="rows" label="Cargando pedidos anteriores…" /> : null}
              {historyError ? <p className="alumno-error">{historyError}</p> : null}
              {showHistory ? (
                <div className="alumno-history-list">
                  {previousOrders.map((order) => (
                    <Link className="alumno-history-row" key={order.id} to={`/cuenta/pedidos/${order.id}`}>
                      <span>
                        <strong>{orderHistoryHeadline(order)}</strong>
                        <p>#{order.folio} · Entregado</p>
                      </span>
                      <span className="alumno-history-row__price">{formatAmount(order.total)}</span>
                      <span className="alumno-history-row__chev" aria-hidden="true">
                        {'>'}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}
          {showPeek ? <MenuPeek slug={slug} products={menuPeek} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function NoteIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7 3h8l5 5v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm8 1.8V9h4.2L15 4.8ZM8 12h8v1.6H8V12Zm0 4h8v1.6H8V16Z"
      />
    </svg>
  );
}

function CupIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 10h13v4.5A4.5 4.5 0 0 1 12.5 19h-4A4.5 4.5 0 0 1 4 14.5V10Zm13 1.2h1.6A2.4 2.4 0 0 1 21 13.6 2.4 2.4 0 0 1 18.6 16H17v-1.6h1.6a.8.8 0 0 0 .8-.8.8.8 0 0 0-.8-.8H17V11.2ZM7 4.5c.6.7 1 1.6 1 2.6S7.6 8.7 7 9.4c-.6-.7-1-1.6-1-2.3s.4-1.9 1-2.6Zm3.2 0c.6.7 1 1.6 1 2.6s-.4 1.6-1 2.3c-.6-.7-1-1.6-1-2.3s.4-1.9 1-2.6Z"
      />
    </svg>
  );
}

const PAY_LABEL: Record<string, string> = { efectivo: 'pago en caja', saldo: 'saldo', stripe: 'Stripe' };

const PAY_ICONS = {
  cash: 'M3 7h18v10H3zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM6 10v4m12-4v4',
  wallet: 'M4 7h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4zM4 7l11-3v3m1 6h2',
  card: 'M3 6h18v12H3zM3 10h18M7 15h4',
  tab: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6',
} as const;

// Android PaymentMethodCardOption: icon tile, title + badge, subtitle and a radio mark.
function PayOption({
  selected,
  icon,
  title,
  badge,
  subtitle,
  disabled = false,
  onSelect,
}: {
  selected: boolean;
  icon: keyof typeof PAY_ICONS;
  title: string;
  badge: string;
  subtitle: string;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={selected ? 'alumno-payopt is-on' : 'alumno-payopt'}
      disabled={disabled}
      onClick={onSelect}
    >
      <span className="alumno-payopt__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d={PAY_ICONS[icon]} /></svg>
      </span>
      <span className="alumno-payopt__copy">
        <span className="alumno-payopt__title">
          <strong>{title}</strong>
          <span className="alumno-payopt__badge">{badge}</span>
        </span>
        <span className="alumno-payopt__sub">{subtitle}</span>
      </span>
      <span className="alumno-payopt__radio" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="m6 12.5 4 4 8-9" /></svg>
      </span>
    </button>
  );
}
