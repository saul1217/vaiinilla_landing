// Avisos en vivo del back por Server-Sent Events (vaiinilla_back docs/diseno-tiempo-real.md).
//
// "Avisar y releer": el canal solo dice QUÉ cambió (`pedido` con su id, `llamada`, `mesa`); cada
// pantalla relee con su ruta de siempre. Mientras el canal está abierto las pantallas dejan de
// preguntar cada 5 s y solo releen con un aviso, más una relectura de seguridad cada minuto. Si el
// canal no abre (back sin tiempo real: 404; red; token vencido), siguen preguntando como antes.
//
// Un solo canal por token y por pestaña, compartido por todas las pantallas que lo usan. Se usa
// fetch y no EventSource porque EventSource no deja mandar el header Authorization.
import { useEffect, useRef, useState } from 'react';
import { resolveApiUrl } from './env';

export type LiveEventType = 'pedido' | 'llamada' | 'mesa' | 'resync';

export interface LiveEvent {
  type: LiveEventType;
  /** `pedido`/`llamada`: `{ id, v }`; `mesa`: `{ espacio_id }`; `resync`: `{}`. */
  data: { id?: string; v?: number | null; espacio_id?: number | null };
}

/** De qué canal: el del cliente con sesión (`/eventos`) o el del enlace de seguimiento. */
export type LiveStreamRef =
  | { kind: 'cliente'; token: string }
  | { kind: 'seguimiento'; token: string };

/** Con el canal abierto, la relectura de seguridad (por si se perdió un aviso). */
export const LIVE_SAFETY_MS = 60_000;

const RETRY_MAX_MS = 30_000;
/** Si el back no tiene tiempo real (404), no se vuelve a intentar en este rato. */
const UNSUPPORTED_RETRY_MS = 5 * 60_000;
/** Con la pestaña oculta más de esto se cierra el canal; al volver se reabre y se relee todo. */
const HIDDEN_CLOSE_MS = 60_000;

type Listener = (event: LiveEvent) => void;
type StatusListener = (live: boolean) => void;

function enabled(): boolean {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return false;
  // En pruebas va apagado salvo que la prueba lo pida, para no meter peticiones a /eventos en los
  // mocks de fetch de cada pantalla.
  if (import.meta.env.MODE === 'test' && !(globalThis as { __LIVE_EVENTS_TEST__?: boolean }).__LIVE_EVENTS_TEST__)
    return false;
  return import.meta.env.VITE_TIEMPO_REAL !== 'false';
}

function streamPath(ref: LiveStreamRef): string {
  return ref.kind === 'cliente' ? '/eventos' : `/publico/seguimiento/${encodeURIComponent(ref.token)}/eventos`;
}

function streamKey(ref: LiveStreamRef): string {
  return `${ref.kind}:${ref.token}`;
}

/** Bloques SSE completos de un búfer; devuelve los eventos y lo que sobra. */
export function parseSseBlocks(buffer: string): { events: { event: string; data: string }[]; rest: string } {
  const events: { event: string; data: string }[] = [];
  const normalized = buffer.replace(/\r\n/g, '\n');
  const parts = normalized.split('\n\n');
  const rest = parts.pop() ?? '';
  for (const block of parts) {
    let event = 'message';
    const data: string[] = [];
    for (const line of block.split('\n')) {
      if (!line || line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const field = colon === -1 ? line : line.slice(0, colon);
      const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
      if (field === 'event') event = value;
      else if (field === 'data') data.push(value);
    }
    if (data.length || event !== 'message') events.push({ event, data: data.join('\n') });
  }
  return { events, rest };
}

class LiveStream {
  private listeners = new Set<Listener>();
  private statusListeners = new Set<StatusListener>();
  private controller: AbortController | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private hiddenTimer: ReturnType<typeof setTimeout> | null = null;
  private retryMs = 1000;
  private live = false;
  private everLive = false;
  private stopped = true;

  constructor(
    private readonly ref: LiveStreamRef,
    private readonly onEmpty: () => void,
  ) {}

  isLive(): boolean {
    return this.live;
  }

  subscribe(listener: Listener, status: StatusListener): () => void {
    this.listeners.add(listener);
    this.statusListeners.add(status);
    if (this.stopped) this.start();
    return () => {
      this.listeners.delete(listener);
      this.statusListeners.delete(status);
      if (this.listeners.size === 0) {
        this.stop();
        this.onEmpty();
      }
    };
  }

  private setLive(live: boolean) {
    if (this.live === live) return;
    this.live = live;
    for (const status of this.statusListeners) status(live);
  }

  private emit(event: LiveEvent) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Una pantalla que falla no corta el canal de las demás.
      }
    }
  }

  private readonly onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      if (this.hiddenTimer == null)
        this.hiddenTimer = setTimeout(() => {
          this.hiddenTimer = null;
          this.close();
        }, HIDDEN_CLOSE_MS);
      return;
    }
    if (this.hiddenTimer != null) {
      clearTimeout(this.hiddenTimer);
      this.hiddenTimer = null;
    }
    if (!this.controller && !this.stopped) {
      this.clearRetry();
      void this.open();
    }
  };

  private start() {
    this.stopped = false;
    document.addEventListener('visibilitychange', this.onVisibility);
    void this.open();
  }

  private stop() {
    this.stopped = true;
    document.removeEventListener('visibilitychange', this.onVisibility);
    if (this.hiddenTimer != null) clearTimeout(this.hiddenTimer);
    this.hiddenTimer = null;
    this.clearRetry();
    this.close();
  }

  private close() {
    this.controller?.abort();
    this.controller = null;
    this.setLive(false);
  }

  private clearRetry() {
    if (this.retryTimer != null) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private scheduleRetry(ms: number) {
    if (this.stopped) return;
    this.clearRetry();
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.open();
    }, ms);
  }

  private retryWithBackoff() {
    const wait = this.retryMs + Math.random() * 1000;
    this.retryMs = Math.min(this.retryMs * 2, RETRY_MAX_MS);
    this.scheduleRetry(wait);
  }

  private async open() {
    if (this.stopped || this.controller) return;
    if (document.visibilityState === 'hidden') return;
    const controller = new AbortController();
    this.controller = controller;
    let reopenNow = false;
    try {
      const headers = new Headers({ Accept: 'text/event-stream' });
      if (this.ref.kind === 'cliente') headers.set('Authorization', `Bearer ${this.ref.token}`);
      const response = await fetch(`${resolveApiUrl(import.meta.env.VITE_API_URL)}${streamPath(this.ref)}`, {
        headers,
        cache: 'no-store',
        signal: controller.signal,
      });
      if (response.status === 404) {
        // Back sin tiempo real (o enlace inexistente): las pantallas siguen preguntando.
        this.controller = null;
        this.scheduleRetry(UNSUPPORTED_RETRY_MS);
        return;
      }
      if (!response.ok || !response.body) {
        await response.body?.cancel().catch(() => undefined);
        this.controller = null;
        this.retryWithBackoff();
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSseBlocks(buffer);
        buffer = parsed.rest;
        for (const { event, data } of parsed.events) {
          if (event === 'listo') {
            this.retryMs = 1000;
            this.setLive(true);
            // Tras un hueco pudo cambiar algo sin aviso: que relean una vez.
            if (this.everLive) this.emit({ type: 'resync', data: {} });
            this.everLive = true;
          } else if (event === 'reconectar') {
            reopenNow = true;
          } else if (event === 'pedido' || event === 'llamada' || event === 'mesa' || event === 'resync') {
            let payload: LiveEvent['data'] = {};
            try {
              payload = data ? (JSON.parse(data) as LiveEvent['data']) : {};
            } catch {
              payload = {};
            }
            this.emit({ type: event, data: payload });
          }
        }
        if (reopenNow) break;
      }
      await reader.cancel().catch(() => undefined);
    } catch {
      // Red caída o abort: se reintenta abajo (el abort de close/stop no reintenta).
    }
    if (this.controller !== controller) return; // cerrado a propósito
    this.controller = null;
    this.setLive(false);
    if (reopenNow) {
      // El back cierra cada 5 min o al vencer el token: se reabre ya, con el token vigente.
      this.scheduleRetry(Math.random() * 1000);
    } else {
      this.retryWithBackoff();
    }
  }
}

const streams = new Map<string, LiveStream>();

function streamFor(ref: LiveStreamRef): LiveStream {
  const key = streamKey(ref);
  let stream = streams.get(key);
  if (!stream) {
    stream = new LiveStream(ref, () => streams.delete(key));
    streams.set(key, stream);
  }
  return stream;
}

/**
 * Escucha los canales indicados y llama `onSignal` con cada aviso que cumpla `matches` (y siempre
 * con `resync`). Devuelve si al menos un canal está abierto: con `true` la pantalla puede preguntar
 * cada `LIVE_SAFETY_MS` en vez de cada 5 s.
 */
export function useLiveSignal(
  refs: LiveStreamRef[],
  matches: (event: LiveEvent) => boolean,
  onSignal: (event: LiveEvent) => void,
): boolean {
  const [live, setLive] = useState(false);
  const matchRef = useRef(matches);
  const signalRef = useRef(onSignal);
  matchRef.current = matches;
  signalRef.current = onSignal;
  const key = refs.map(streamKey).sort().join('|');

  useEffect(() => {
    if (!key || !enabled()) {
      setLive(false);
      return;
    }
    const active = refs.map(streamFor);
    const update = () => setLive(active.some((stream) => stream.isLive()));
    const unsubscribes = active.map((stream) =>
      stream.subscribe((event) => {
        if (event.type === 'resync' || matchRef.current(event)) signalRef.current(event);
      }, update),
    );
    update();
    return () => {
      for (const unsubscribe of unsubscribes) unsubscribe();
    };
    // refs se identifica por `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return live;
}

/** Solo para pruebas: cierra y olvida todos los canales. */
export function resetLiveStreamsForTests() {
  for (const stream of streams.values()) {
    (stream as unknown as { stop: () => void }).stop();
  }
  streams.clear();
}
