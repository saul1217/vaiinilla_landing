// Asistente de pedidos del cliente («Pregúntame qué pedir»), con paridad con Android
// (ui/assistant/CustomerAssistantScreen.kt). Solo existe con la bandera
// VITE_FEATURE_ASISTENTE_CLIENTE prendida y si la tienda lo tiene para clientes.
// No pide ni cobra nada: pone productos en el carrito y el cliente lo manda desde ahí.
import { useCallback, useEffect, useReducer, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/auth-context';
import { useBuyerSession } from '../context/buyer-session';
import { useCart } from '../context/cart-context';
import { api } from '../lib/api';
import { errorMessage, VaiinillaApiError } from '../lib/api-error';
import { canQuickAdd, planAssistantOrder } from '../lib/assistant-cart';
import { cartTotal, defaultOptionIds } from '../lib/cart';
import { productImageUrl } from '../lib/catalog-images';
import { clientSessionForPlace } from '../lib/client-session-for-place';
import { isFreshClientContext, readStoredClientContext } from '../lib/client-session';
import { showsCustomerAssistant } from '../lib/customer-assistant-flag';
import {
  askAssistant,
  assistantErrorMessage,
  assistantReducer,
  canSend,
  cleanGuestName,
  courtAvailability,
  initialAssistantState,
  isAssistantDisabled,
  latestOrderTurn,
  MAX_LETTERS,
  STARTERS,
  type AssistantCourtCard,
  type AssistantOrderProposal,
  type AssistantProductCard,
  type AssistantReply,
  type AssistantState,
  type AssistantTurn,
  type AssistantWaiterOffer,
} from '../lib/customer-assistant';
import { useHideFloatingCall } from '../lib/floating-call';
import { guestSession, readGuest } from '../lib/guest-session';
import { CALL_REASONS, createBuyerCallClient } from '../lib/mesero-api';
import { formatAmount } from '../lib/money';
import { peekResource, resourceKeys } from '../lib/resource-cache';
import { readSpace } from '../lib/space-session';
import type { CatalogResponse, PublicEstablishment } from '../types/api';
import { NotFoundPage } from './not-found-page';

export interface AssistantPageDeps {
  ask?: (token: string, turns: AssistantTurn[], establishmentId: string) => Promise<AssistantReply>;
  /** Token de cliente listo para este lugar (con cuenta o invitado). */
  token?: (place: PublicEstablishment) => Promise<string>;
  enterAsGuest?: (slug: string, name: string) => Promise<void>;
  callWaiter?: (token: string, espacioId: number, offer: AssistantWaiterOffer) => Promise<void>;
  loadPlace?: (slug: string) => Promise<{ place: PublicEstablishment; catalog: CatalogResponse }>;
  /** Fuerza la bandera en pruebas. */
  enabled?: boolean;
}

const defaultLoadPlace = async (slug: string) => {
  // api ya guarda los datos públicos un minuto (los mismos que usa el menú).
  const [place, catalog] = await Promise.all([api.getEstablishment(slug), api.getGuestCatalog(slug)]);
  return { place, catalog };
};

const defaultCallWaiter = async (token: string, espacioId: number, offer: AssistantWaiterOffer) => {
  await createBuyerCallClient(token).call(espacioId, offer.reason, null);
};

const defaultEnterAsGuest = async (slug: string, name: string) => {
  await guestSession(slug, name);
};

export function AssistantPage({ deps = {} }: { deps?: AssistantPageDeps }) {
  useHideFloatingCall();
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { context, openClientSession } = useBuyerSession();
  const { cart, addLine, updateQuantity, reset } = useCart();
  const [place, setPlace] = useState<PublicEstablishment | null>(
    () => peekResource<PublicEstablishment>(resourceKeys.establishment(slug)) ?? null,
  );
  const [catalog, setCatalog] = useState<CatalogResponse | null>(
    () => peekResource<CatalogResponse>(resourceKeys.catalog(slug)) ?? null,
  );
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [state, dispatch] = useReducer(assistantReducer, undefined, () => initialAssistantState());
  const stateRef = useRef<AssistantState>(state);
  stateRef.current = state;
  const [draft, setDraft] = useState('');
  const [guestName, setGuestName] = useState(() => readGuest()?.nombre ?? '');
  const [enteringName, setEnteringName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  /** Por turno: lo que no entró al carrito o cómo salió la llamada al mesero. */
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [switchCart, setSwitchCart] = useState<null | (() => void)>(null);
  const listEnd = useRef<HTMLDivElement>(null);
  const table = readSpace(slug);
  const enabled = showsCustomerAssistant(place, deps.enabled);
  const needsAccount = !user && place?.identificador_cliente_obligatorio === true;

  useEffect(() => {
    let active = true;
    (deps.loadPlace ?? defaultLoadPlace)(slug)
      .then((loaded) => {
        if (!active) return;
        setPlace(loaded.place);
        setCatalog(loaded.catalog);
        setLoadError(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        if (cause instanceof VaiinillaApiError && cause.status === 404) setMissing(true);
        else setLoadError(errorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [deps.loadPlace, slug]);

  // Otro negocio empieza plática nueva.
  useEffect(() => {
    dispatch({ type: 'restart' });
    setNotes({});
  }, [slug]);

  // El carrito quedó vacío (se mandó o se vació): el siguiente pedido no resta líneas ajenas.
  const cartHere = cart && cart.slug === slug ? cart.lines : [];
  useEffect(() => {
    if (cartHere.length === 0) dispatch({ type: 'forgetCartOrder' });
  }, [cartHere.length]);

  useEffect(() => {
    listEnd.current?.scrollIntoView?.({ block: 'end' });
  }, [state.turns.length, state.thinking, state.error, state.needsName]);

  const tokenFor = useCallback(
    async (target: PublicEstablishment): Promise<string> => {
      if (deps.token) return deps.token(target);
      const stored = readStoredClientContext()?.context ?? null;
      if (stored && stored.contexto.establecimiento_id === target.id && isFreshClientContext(stored)) {
        if (!user || stored.contexto.usuario_id === user.uid) return stored.access_token;
      }
      const session = await clientSessionForPlace({
        slug: target.slug,
        place: target,
        user: user ?? null,
        context: user && isFreshClientContext(context) ? context : null,
        openClientSession,
      });
      return session.access_token;
    },
    [context, deps, openClientSession, user],
  );

  const guestWithoutName = useCallback(() => !deps.token && !user && !readGuest(), [deps.token, user]);

  const ask = useCallback(async () => {
    const target = place;
    if (!target) return;
    const conversation = stateRef.current.conversation;
    if (guestWithoutName()) {
      dispatch({ type: 'needsName', conversation });
      return;
    }
    dispatch({ type: 'thinking', conversation });
    try {
      const token = await tokenFor(target);
      const reply = await (deps.ask ?? askAssistant)(token, stateRef.current.turns, target.id);
      dispatch({ type: 'reply', conversation, reply });
    } catch (cause) {
      dispatch({
        type: 'failed',
        conversation,
        message: assistantErrorMessage(cause),
        closed: isAssistantDisabled(cause),
      });
    }
  }, [deps.ask, guestWithoutName, place, tokenFor]);

  // El turno del cliente entra al estado y luego se pregunta con la plática ya al día.
  const pendingAsk = useRef(false);
  useEffect(() => {
    if (!pendingAsk.current) return;
    pendingAsk.current = false;
    void ask();
  }, [ask, state.turns.length]);

  function send(text: string) {
    const clean = text.trim();
    if (!clean || !canSend(stateRef.current) || !place) return;
    pendingAsk.current = true;
    dispatch({ type: 'send', text: clean });
    setDraft('');
  }

  function retry() {
    const current = stateRef.current;
    if (current.thinking || current.needsName || current.closed) return;
    if (current.turns[current.turns.length - 1]?.fromCustomer !== true) return;
    void ask();
  }

  async function submitName(event: FormEvent) {
    event.preventDefault();
    if (enteringName) return;
    const clean = cleanGuestName(guestName);
    if (!clean) {
      setNameError('Escribe tu nombre.');
      return;
    }
    setEnteringName(true);
    setNameError(null);
    const conversation = stateRef.current.conversation;
    try {
      await (deps.enterAsGuest ?? defaultEnterAsGuest)(slug, clean);
      if (conversation !== stateRef.current.conversation) return;
      dispatch({ type: 'nameAccepted' });
      if (stateRef.current.turns[stateRef.current.turns.length - 1]?.fromCustomer) void ask();
    } catch (cause) {
      setNameError(cause instanceof Error && cause.message ? cause.message : 'No pudimos registrarte. Intenta de nuevo.');
    } finally {
      setEnteringName(false);
    }
  }

  /** El carrito es de una sola tienda: agregar aquí con uno de otra se confirma antes. */
  function withCartHere(run: () => void) {
    if (cart && cart.slug !== slug && cart.lines.length > 0) {
      setSwitchCart(() => () => {
        reset();
        run();
      });
      return;
    }
    run();
  }

  const productsById = new Map((catalog?.productos ?? []).map((product) => [product.id, product]));
  const inCart = new Set(cartHere.map((line) => line.productId));

  function openProduct(card: AssistantProductCard) {
    void navigate(`/e/${slug}`, { state: { openProductId: card.productId } });
  }

  function addProduct(card: AssistantProductCard) {
    const product = productsById.get(card.productId);
    if (card.needsOptions || !canQuickAdd(product)) {
      openProduct(card);
      return;
    }
    if (!place) return;
    withCartHere(() => addLine(place.slug, place.nombre, product, defaultOptionIds(product), 1));
  }

  function addOrder(turn: number, order: AssistantOrderProposal) {
    if (!place) return;
    withCartHere(() => {
      // Tras vaciar un carrito ajeno no queda nada que reemplazar.
      const current = readCartLinesHere();
      const plan = planAssistantOrder({
        cartLines: current,
        products: catalog?.productos ?? [],
        lines: order.lines,
        replacing: current.length > 0 ? stateRef.current.cartOrder : [],
      });
      plan.updates.forEach((update) => updateQuantity(update.productId, update.optionIds, update.quantity, update.notes));
      plan.adds.forEach((add) => addLine(place.slug, place.nombre, add.product, add.optionIds, add.quantity, add.notes));
      const skipped = new Set(plan.skipped);
      dispatch({ type: 'orderInCart', turn, added: order.lines.filter((line) => !skipped.has(line.product.name)) });
      if (plan.skipped.length === 0) void navigate(`/e/${slug}/carrito`);
      else
        setNotes((prev) => ({
          ...prev,
          [turn]: `No agregué ${plan.skipped.join(', ')}: elige sus opciones en el menú o ya no hay.`,
        }));
    });
  }

  // El carrito de este negocio tal como está ahora (el de otro negocio no cuenta).
  const cartRef = useRef(cart);
  cartRef.current = cart;
  function readCartLinesHere() {
    const current = cartRef.current;
    return current && current.slug === slug ? current.lines : [];
  }

  async function callWaiter(turn: number, offer: AssistantWaiterOffer) {
    if (!table || !place) return;
    setNotes((prev) => ({ ...prev, [turn]: 'Llamando…' }));
    try {
      const token = await tokenFor(place);
      await (deps.callWaiter ?? defaultCallWaiter)(token, table.espacioId, offer);
      dispatch({ type: 'done', turn });
      setNotes((prev) => ({ ...prev, [turn]: 'Listo, ya le avisamos. Va para allá.' }));
    } catch (cause) {
      const message = cause instanceof Error && cause.message ? cause.message : 'No se pudo llamar. Usa el botón Mesero.';
      setNotes((prev) => ({ ...prev, [turn]: message }));
    }
  }

  if (missing) {
    return (
      <NotFoundPage
        title="No encontramos este lugar"
        lead="Revisa el enlace o elige otro lugar para pedir."
        cta={{ to: '/pedir', label: 'Elegir lugar' }}
      />
    );
  }

  // Bandera apagada o la tienda no lo tiene para clientes: no existe.
  if (place && !enabled) {
    return (
      <NotFoundPage
        title="El asistente no está disponible aquí"
        lead="Puedes elegir directo desde el menú."
        cta={{ to: `/e/${slug}`, label: 'Ver el menú' }}
      />
    );
  }

  const placeLabel = table?.nombre || null;
  const latest = latestOrderTurn(state);
  const sendable = canSend(state) && !needsAccount && Boolean(place);
  const total = cartHere.length > 0 ? cartTotal(cartHere) : null;
  const items = cartHere.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <main id="main-content" className="vai-assistant" aria-label="Asistente de pedidos">
      <header className="vai-assistant__head">
        <Link className="vai-assistant__round" to={`/e/${slug}`} aria-label="Regresar al menú">
          <BackIcon />
        </Link>
        <div className="vai-assistant__title">
          <strong>Asistente</strong>
          <span>{[place?.nombre, placeLabel].filter(Boolean).join(' · ') || 'Menú de hoy'}</span>
        </div>
        {state.turns.length > 0 ? (
          <button
            type="button"
            className="vai-assistant__round"
            aria-label="Empezar de nuevo"
            onClick={() => {
              dispatch({ type: 'restart' });
              setNotes({});
            }}
          >
            <RefreshIcon />
          </button>
        ) : (
          <span className="vai-assistant__round is-placeholder" aria-hidden="true" />
        )}
      </header>

      <div className="vai-assistant__list" aria-live="polite">
        {loadError ? <p className="alumno-error">{loadError}</p> : null}
        {state.turns.length === 0 ? (
          <section className="vai-assistant__welcome">
            <h1>
              {user?.displayName ? `Hola, ${user.displayName.split(' ')[0]}. ` : 'Hola. '}
              {placeLabel ? `Te ayudo a pedir para ${placeLabel}.` : 'Te ayudo a pedir.'}
            </h1>
            <p>Conozco el menú de hoy, lo que ya se acabó y los precios. Nada se pide hasta que tú lo confirmes.</p>
            <p className="vai-assistant__kicker">Para empezar</p>
            <div className="vai-assistant__chips">
              {STARTERS.map((starter) => (
                <button key={starter} type="button" className="vai-assistant__chip" disabled={!sendable} onClick={() => send(starter)}>
                  {starter}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {state.turns.map((turn, index) => (
          <div key={`${state.conversation}-${index}`} className="vai-assistant__turn">
            <Bubble text={turn.text} mine={turn.fromCustomer} />
            {turn.products && turn.products.length > 0 ? (
              <div className="vai-assistant__shelf" role="list" aria-label="Productos sugeridos">
                {turn.products.map((card) => (
                  <ProductCard
                    key={card.productId}
                    card={card}
                    added={inCart.has(card.productId)}
                    onOpen={() => openProduct(card)}
                    onAdd={() => addProduct(card)}
                  />
                ))}
              </div>
            ) : null}
            {(turn.courts ?? []).map((court) => (
              <CourtRow key={court.courtId} court={court} onRent={() => void navigate(`/e/${slug}/canchas`, { state: { courtId: court.courtId } })} />
            ))}
            {turn.order ? (
              <OrderCard
                order={turn.order}
                place={placeLabel}
                done={state.done.includes(index)}
                superseded={index !== latest}
                note={notes[index] ?? null}
                onAdd={() => addOrder(index, turn.order!)}
                onChange={() => setDraft('Quiero cambiar ')}
                cartHref={`/e/${slug}/carrito`}
              />
            ) : null}
            {turn.waiter && table ? (
              <WaiterCard
                offer={turn.waiter}
                done={state.done.includes(index)}
                note={notes[index] ?? null}
                onCall={() => void callWaiter(index, turn.waiter!)}
              />
            ) : null}
          </div>
        ))}

        {state.needsName ? (
          <form className="vai-assistant__card" onSubmit={(event) => void submitName(event)}>
            <strong>¿Cómo te llamas?</strong>
            <p className="alumno-muted">Con tu nombre te ubica el mesero. No se lo mandamos al asistente.</p>
            <label className="sr-only" htmlFor="assistant-name">Tu nombre</label>
            <input
              id="assistant-name"
              className="vai-assistant__input"
              value={guestName}
              maxLength={60}
              autoComplete="given-name"
              onChange={(event) => setGuestName(event.target.value)}
            />
            {nameError ? <p className="alumno-error">{nameError}</p> : null}
            <p className="vai-assistant__fine">Al seguir aceptas los Términos y el Aviso de privacidad de Vaiinilla.</p>
            <button className="alumno-btn alumno-btn--lime" type="submit" disabled={enteringName}>
              {enteringName ? 'Un momento…' : 'Seguir'}
            </button>
          </form>
        ) : state.thinking ? (
          <Bubble text="Escribiendo…" mine={false} muted />
        ) : state.error ? (
          <div className="vai-assistant__error" role="alert">
            <p>{state.error}</p>
            {!state.closed ? (
              <button type="button" className="vai-assistant__chip" onClick={retry}>
                Reintentar
              </button>
            ) : null}
          </div>
        ) : null}
        <div ref={listEnd} />
      </div>

      {needsAccount ? (
        <p className="vai-assistant__fine vai-assistant__fine--center">
          Aquí se pide con tu cuenta.{' '}
          <Link to={`/cuenta?next=/e/${slug}/asistente`}>Entra para platicar con el asistente</Link>
        </p>
      ) : state.turns.length === 0 ? (
        <p className="vai-assistant__fine vai-assistant__fine--center">
          Solo hablo del menú y de tu pedido aquí. Para lo demás, llama al mesero. Tus mensajes los procesa una IA de otra
          empresa: no compartas datos personales ni de salud.
        </p>
      ) : state.remaining <= 1 ? (
        <p className="vai-assistant__fine">Ya platicamos mucho. Empieza una plática nueva con el botón de arriba.</p>
      ) : null}

      {!state.needsName && !state.thinking && !state.error && state.options.length > 0 ? (
        <div className="vai-assistant__chips vai-assistant__chips--row">
          {state.options.map((option) => (
            <button key={option} type="button" className="vai-assistant__chip" disabled={!sendable} onClick={() => send(option)}>
              {option}
            </button>
          ))}
        </div>
      ) : null}

      {switchCart ? (
        <div className="vai-assistant__card vai-assistant__switch" role="alertdialog" aria-labelledby="assistant-switch">
          <strong id="assistant-switch">¿Cambiar de tienda?</strong>
          <p className="alumno-muted">
            Tu carrito tiene productos de {cart?.establishmentName}. Si agregas aquí, ese carrito se vacía.
          </p>
          <button
            className="alumno-btn alumno-btn--lime"
            type="button"
            onClick={() => {
              const run = switchCart;
              setSwitchCart(null);
              run();
            }}
          >
            Vaciar y agregar aquí
          </button>
          <button className="alumno-btn" type="button" onClick={() => setSwitchCart(null)}>
            Conservar mi carrito
          </button>
        </div>
      ) : null}

      {items > 0 ? (
        <Link
          className="vai-assistant__cartbar"
          to={`/e/${slug}/carrito`}
          aria-label={`Pedir ya, ${items === 1 ? '1 producto' : `${items} productos`}${total ? `, ${formatAmount(total)}` : ''}`}
        >
          <span>Pedir ya</span>
          <span>
            {items === 1 ? '1 producto' : `${items} productos`}
            {total ? ` · ${formatAmount(total)}` : ''}
          </span>
        </Link>
      ) : null}

      <form
        className="vai-assistant__composer"
        onSubmit={(event) => {
          event.preventDefault();
          send(draft);
        }}
      >
        <label className="sr-only" htmlFor="assistant-draft">Pregunta o pide lo que quieras</label>
        <input
          id="assistant-draft"
          className="vai-assistant__input"
          value={draft}
          maxLength={MAX_LETTERS}
          placeholder="Pregunta o pide lo que quieras…"
          autoComplete="off"
          disabled={!sendable && !state.thinking}
          onChange={(event) => setDraft(event.target.value.slice(0, MAX_LETTERS))}
        />
        <button type="submit" className="vai-assistant__send" aria-label="Enviar" disabled={!sendable || draft.trim() === ''}>
          <SendIcon />
        </button>
      </form>
    </main>
  );
}

function Bubble({ text, mine, muted = false }: { text: string; mine: boolean; muted?: boolean }) {
  return (
    <div className={`vai-assistant__bubble${mine ? ' is-mine' : ''}${muted ? ' is-muted' : ''}`}>
      {!mine ? <small>Asistente</small> : null}
      <p>{text}</p>
    </div>
  );
}

function ProductCard({
  card,
  added,
  onOpen,
  onAdd,
}: {
  card: AssistantProductCard;
  added: boolean;
  onOpen: () => void;
  onAdd: () => void;
}) {
  const thumb = productImageUrl(card.imageUrl);
  return (
    <div className={`vai-assistant__product${card.available ? '' : ' is-off'}`} role="listitem">
      <button type="button" className="vai-assistant__product-open" onClick={onOpen} aria-label={`Ver detalle de ${card.name}`}>
        {thumb ? <img src={thumb} alt="" width="120" height="84" loading="lazy" decoding="async" /> : <span className="vai-assistant__ph" aria-hidden="true" />}
        <strong>{card.name}</strong>
        <span>
          {formatAmount(card.price)}
          {card.minutes ? ` · ${card.minutes} min` : ''}
        </span>
      </button>
      {!card.available ? (
        <span className="vai-assistant__tag">Ya no hay</span>
      ) : added ? (
        <span className="vai-assistant__tag is-ok">Agregado ✓</span>
      ) : (
        <button
          type="button"
          className="vai-assistant__small"
          onClick={onAdd}
          aria-label={card.needsOptions ? `Elegir opciones de ${card.name}` : `Agregar ${card.name}`}
        >
          {card.needsOptions ? 'Elegir' : 'Agregar'}
        </button>
      )}
    </div>
  );
}

function CourtRow({ court, onRent }: { court: AssistantCourtCard; onRent: () => void }) {
  const rentable = court.pricePerHour != null;
  const details = [
    court.pricePerHour ? `${formatAmount(court.pricePerHour)} la hora` : null,
    court.capacity ? (court.capacity === 1 ? '1 persona' : `Hasta ${court.capacity} personas`) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="vai-assistant__card vai-assistant__court">
      <div>
        <strong>{court.name}</strong>
        <span>{courtAvailability(court)}</span>
        <span className="alumno-muted">{details || (rentable ? '' : 'Se renta en el lugar')}</span>
      </div>
      {rentable ? (
        <button type="button" className="vai-assistant__small" onClick={onRent} aria-label={`Rentar ${court.name}`}>
          Rentar
        </button>
      ) : null}
    </div>
  );
}

function OrderCard({
  order,
  place,
  done,
  superseded,
  note,
  onAdd,
  onChange,
  cartHref,
}: {
  order: AssistantOrderProposal;
  place: string | null;
  done: boolean;
  superseded: boolean;
  note: string | null;
  onAdd: () => void;
  onChange: () => void;
  cartHref: string;
}) {
  return (
    <section className="vai-assistant__card vai-assistant__order" aria-label="Pedido propuesto">
      <strong>{place ? `Tu pedido · ${place.charAt(0).toUpperCase()}${place.slice(1)}` : 'Tu pedido'}</strong>
      <ul>
        {order.lines.map((line, index) => (
          <li key={`${line.product.productId}-${index}`}>
            <span className="vai-assistant__qty">{line.quantity}×</span>
            <span>
              {line.product.name}
              {line.note ? <small>{line.note}</small> : null}
              {line.product.needsOptions ? <small>Elige sus opciones en el menú</small> : null}
            </span>
            <span>{formatAmount(line.product.price)}</span>
          </li>
        ))}
      </ul>
      {order.unavailable.length > 0 ? <p className="alumno-muted">Ya no hay: {order.unavailable.join(', ')}</p> : null}
      {order.toChoose.length > 0 ? (
        <p className="alumno-muted">Elige sus opciones arriba: {order.toChoose.join(', ')}</p>
      ) : null}
      {order.lines.length > 0 ? (
        <>
          <p className="vai-assistant__total">
            <span>Total</span>
            <strong>{formatAmount(order.total)}</strong>
          </p>
          <p className="vai-assistant__fine">Lo mandas a cocina desde tu carrito, con la forma de pago de siempre.</p>
        </>
      ) : null}
      {note ? <p className="vai-assistant__note">{note}</p> : null}
      {order.lines.length === 0 ? null : done ? (
        <Link className="alumno-btn alumno-btn--ink" to={cartHref}>
          Ver carrito
        </Link>
      ) : superseded ? (
        <p className="vai-assistant__fine">Ya hay una versión más nueva de tu pedido abajo.</p>
      ) : (
        <>
          <button type="button" className="alumno-btn alumno-btn--lime" onClick={onAdd}>
            Agregar al carrito
          </button>
          <button type="button" className="alumno-btn vai-assistant__ghost" onClick={onChange}>
            Cambiar algo
          </button>
        </>
      )}
    </section>
  );
}

function WaiterCard({
  offer,
  done,
  note,
  onCall,
}: {
  offer: AssistantWaiterOffer;
  done: boolean;
  note: string | null;
  onCall: () => void;
}) {
  const label = CALL_REASONS.find((reason) => reason.value === offer.reason)?.label ?? offer.reason;
  return (
    <section className="vai-assistant__card vai-assistant__waiter">
      <div>
        <strong>Llamar al mesero</strong>
        <span className="alumno-muted">Motivo: {offer.detail ?? label}</span>
        {note ? <span className="vai-assistant__note">{note}</span> : null}
      </div>
      {!done ? (
        <button type="button" className="vai-assistant__small" onClick={onCall} disabled={note === 'Llamando…'}>
          Llamar
        </button>
      ) : null}
    </section>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        d="M19 12a7 7 0 1 1-2.05-4.95M19 4v4h-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M4 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
