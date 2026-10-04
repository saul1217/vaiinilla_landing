// Mini juegos mientras va el pedido: los cinco juegos de Vaini (Vuela, Skate, Apila,
// Gravedad y Galaxia), iguales a los de Android e iOS. El motor dibuja en un canvas
// de 480×270 píxeles (src/arcade/vaini); esta tarjeta pone pestañas, sonido y
// pantalla completa. Shown under the first active order while the buyer waits.
// Cerrado hasta que lo piden: el motor y su canvas solo existen mientras se juega.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { onMotionChange } from '../lib/motion-activity';
import { ARCADE_GAMES, mountArcade, type ArcadeHandle, type ArcadeKey } from './vaini/engine.mjs';

export function WaitingArcade() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button className="alumno-arcade-launch" type="button" onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9h12a4 4 0 0 1 4 4v1a3 3 0 0 1-5.4 1.8L15 14H9l-1.6 1.8A3 3 0 0 1 2 14v-1a4 4 0 0 1 4-4Z" />
          <path d="M7 11.5v3M5.5 13h3M15.5 12.5h.01M17.5 14h.01" />
        </svg>
        <span>Arcade</span>
        <small>Juega mientras esperas</small>
      </button>
    );
  }
  return <ArcadeCard onClose={() => setOpen(false)} />;
}

function ArcadeCard({ onClose }: { onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const engine = useRef<ArcadeHandle | null>(null);
  const [key, setKey] = useState<ArcadeKey>('flappy');
  const [muted, setMuted] = useState(false);
  const [full, setFull] = useState(false);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    // jsdom has no 2D context: the card still renders its chrome.
    if (!canvas || typeof ImageData === 'undefined' || !canvas.getContext?.('2d')) return;
    engine.current = mountArcade(canvas, { game: 'flappy' });
    const stopListening = onMotionChange((busy) => engine.current?.setQuiet(busy));
    return () => {
      stopListening();
      engine.current?.destroy();
      engine.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const tabs = tabsRef.current;
    if (!tabs) return;
    const measure = () => {
      const active = tabs.querySelector<HTMLElement>('[aria-selected="true"]');
      if (active) setPill({ x: active.offsetLeft, w: active.offsetWidth });
    };
    measure();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    ro?.observe(tabs);
    return () => ro?.disconnect();
  }, [key]);

  // Full screen is a CSS takeover (works on iOS too); lock page scroll meanwhile.
  useEffect(() => {
    if (!full) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFull(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [full]);

  function select(next: ArcadeKey) {
    setKey(next);
    engine.current?.load(next);
    canvasRef.current?.focus({ preventScroll: true });
  }

  function toggleMute() {
    const now = engine.current?.toggleMute();
    if (typeof now === 'boolean') setMuted(now);
  }

  const info = ARCADE_GAMES.find((game) => game.key === key) ?? { key, label: 'Vuela', tag: 'Toca para volar' };

  return (
    <section className={full ? 'alumno-arcade is-full' : 'alumno-arcade'} aria-label="Mini juegos">
      <div className="alumno-arcade__head">
        <div className="alumno-arcade__tabs" role="tablist" ref={tabsRef}>
          {pill ? <span className="alumno-arcade__pill" style={{ '--x': `${pill.x}px`, '--w': `${pill.w}px` } as CSSProperties} /> : null}
          {ARCADE_GAMES.map((game) => (
            <button key={game.key} type="button" role="tab" aria-selected={game.key === key} onClick={() => select(game.key)}>
              {game.label}
            </button>
          ))}
        </div>
      </div>

      <div className="alumno-arcade__well is-skate">
        <canvas ref={canvasRef} className="alumno-arcade__canvas" tabIndex={0} aria-label={`${info.label}. ${info.tag}`} />
      </div>
      <div className="alumno-arcade__foot">
        <p>{info.tag}</p>
        <div className="alumno-arcade__tools">
          <button type="button" onClick={toggleMute} aria-label={muted ? 'Activar sonido' : 'Silenciar'} aria-pressed={!muted}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 9v6h4l5 4V5L8 9H4Z" />
              {muted ? <path d="m17 9 5 6m0-6-5 6" /> : <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />}
            </svg>
          </button>
          <button type="button" onClick={onClose} aria-label="Cerrar arcade">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
          <button type="button" onClick={() => setFull((value) => !value)} aria-label={full ? 'Salir de pantalla completa' : 'Pantalla completa'} aria-pressed={full}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {full ? <path d="M9 4v5H4m11-5v5h5M9 20v-5H4m11 5v-5h5" /> : <path d="M4 9V4h5m6 0h5v5M4 15v5h5m6 0h5v-5" />}
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
