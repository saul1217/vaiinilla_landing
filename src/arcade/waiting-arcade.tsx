// Android WaitingArcadeCard, with more life: lofi music and effects, particles,
// shake, slow-motion deaths, squash & stretch, and Vaini Skate as a fifth game.
// Shown under the first active order while the buyer waits.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { drawFrame, WELL } from './draw';
import { burst, createFx, popup, squash, stepFx, type Fx } from './fx';
import {
  ARCADE_KINDS,
  ApilaGame,
  BrincaGame,
  FlappyGame,
  GravedadGame,
  createGame,
  leaderboard,
  readScores,
  recordScore,
  type ArcadeEvent,
  type ArcadeGame,
  type ArcadeKind,
  type ArcadeStatus,
} from './games';
import { createSkateMode, type SkateMode } from './skate-mode';
import { arcadeSound, buzz } from './sound';

const STEP = 1 / 120;
const DYING_S = 0.55;
const CONFETTI = ['#b8d86b', '#f5f2e8', '#ffd36e', '#ff7ab8', '#7ab8ff'];

type Phase = ArcadeStatus | 'dying';

function lime() {
  return getComputedStyle(document.documentElement).getPropertyValue('--lime').trim() || '#b8d86b';
}

function speedOf(game: ArcadeGame) {
  if (game instanceof BrincaGame || game instanceof GravedadGame || game instanceof FlappyGame) return game.speed;
  return 0;
}

function mascotPos(game: ArcadeGame, height: number) {
  if (game instanceof FlappyGame) return { x: 70, y: game.y };
  if (game instanceof GravedadGame) return { x: 64, y: game.y };
  if (game instanceof BrincaGame) return { x: 70, y: game.y };
  if (game instanceof ApilaGame) return { x: game.pos + game.top().w / 2, y: game.topY(height) - game.blockH - 34 };
  return { x: 70, y: height / 2 };
}

function absorb(fx: Fx, events: ArcadeEvent[], game: ArcadeGame, accent: string) {
  const sound = arcadeSound();
  for (const e of events) {
    if (e.type === 'jump') {
      sound.play('jump');
      squash(fx, 0.78, 1.28);
      burst(fx, e.x, e.y + 15, 7, { speed: 70, spread: Math.PI * 0.7, angle: -Math.PI / 2, color: 'rgba(245,242,232,0.8)', gravity: 120, size: 3, life: 0.45 });
    } else if (e.type === 'flap') {
      sound.play('flap');
      squash(fx, 0.85, 1.2);
      burst(fx, e.x - 12, e.y + 6, 4, { speed: 60, spread: 0.9, angle: Math.PI * 0.8, color: 'rgba(245,242,232,0.7)', gravity: 60, size: 2.4, life: 0.4 });
    } else if (e.type === 'land') {
      sound.play('land');
      squash(fx, 1.3, 0.74);
      const up = game instanceof GravedadGame && game.gdir < 0 ? 1 : -1;
      burst(fx, e.x, e.y + (up < 0 ? 15 : -14), 9, { speed: 90, spread: Math.PI * 0.9, angle: up * Math.PI * 0.5, color: 'rgba(245,242,232,0.75)', gravity: -up * 180, size: 2.8, life: 0.4 });
    } else if (e.type === 'score') {
      sound.play('score');
      fx.scorePop = 1;
      const label = game instanceof BrincaGame ? `+${Math.floor(game.score / 10) * 10}` : '+1';
      popup(fx, label, e.x + 18, e.y - 30, accent);
      burst(fx, e.x, e.y, 8, { speed: 110, color: accent, gravity: 60, shape: 'spark', size: 3, life: 0.4 });
    } else if (e.type === 'perfect') {
      sound.play('perfect');
      fx.scorePop = 1;
      fx.flash = 0.25;
      fx.flashColor = accent;
      popup(fx, '¡PERFECTO!', e.x, e.y - 18, accent, true);
      burst(fx, e.x, e.y, 18, { speed: 180, colors: CONFETTI, gravity: 320, shape: 'square', size: 5, life: 0.9 });
      squash(fx, 1.25, 0.8);
    } else if (e.type === 'drop') {
      sound.play('drop');
      fx.scorePop = 1;
      fx.shake = Math.max(fx.shake, 4);
      squash(fx, 1.2, 0.82);
      if (e.cut && e.cut.w > 0.5) {
        fx.chunks.push({ x: e.cut.x, y: e.y, w: e.cut.w, h: 17, vy: -60, vx: e.cut.x < e.x ? -50 : 50, rot: 0, vr: e.cut.x < e.x ? -4 : 4 });
      }
      burst(fx, e.x, e.y + 18, 6, { speed: 70, spread: Math.PI, angle: -Math.PI / 2, color: 'rgba(245,242,232,0.7)', gravity: 200, size: 2.4, life: 0.35 });
    } else if (e.type === 'gravity') {
      sound.play('gravity');
      squash(fx, 0.8, 1.22);
      fx.ring = { x: e.x, y: e.y, t: 0 };
    }
  }
  events.length = 0;
}

export function WaitingArcade() {
  const cardRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [kind, setKind] = useState<ArcadeKind>('brinca');
  const [status, setStatus] = useState<ArcadeStatus>('idle');
  const [score, setScore] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [muted, setMuted] = useState(() => arcadeSound().muted);
  const [full, setFull] = useState(false);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);

  const game = useRef<ArcadeGame>(createGame('brinca'));
  const skate = useRef<SkateMode | null>(null);
  const fx = useRef<Fx>(createFx());
  const phase = useRef<Phase>('idle');
  const dyingFor = useRef(0);
  const beatBest = useRef(false);
  const boardRef = useRef(boardOpen);
  const kindRef = useRef(kind);
  const size = useRef({ width: 336, height: 250 });
  const touchStartY = useRef(0);
  boardRef.current = boardOpen;
  kindRef.current = kind;

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
  }, [kind]);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext?.('2d');
    if (!canvas || !ctx) return;
    const sound = arcadeSound();
    const accent = lime();
    let raf = 0;
    let last = 0;
    let acc = 0;
    let runPhase = 0;
    let scroll = 0;
    let time = 0;
    let visible = true;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) return;
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      size.current = { width: rect.width, height: rect.height };
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (phase.current === 'idle' && kindRef.current !== 'skate') game.current.reset(rect.width, rect.height);
    };
    resize();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    ro?.observe(canvas);
    const io =
      typeof IntersectionObserver === 'function'
        ? new IntersectionObserver(([entry]) => {
            visible = entry?.isIntersecting ?? true;
            if (!visible) sound.pause();
          })
        : null;
    io?.observe(canvas);
    const onVisibility = () => {
      last = 0;
      acc = 0;
      if (document.hidden) sound.pause();
    };
    document.addEventListener('visibilitychange', onVisibility);

    const die = () => {
      const g = game.current;
      const final = Math.floor(g.score);
      const best = Math.max(0, ...readScores(g.kind));
      recordScore(g.kind, final);
      const beat = final > 0 && final > best;
      beatBest.current = beat;
      setNewBest(beat);
      phase.current = 'dying';
      dyingFor.current = 0;
      const f = fx.current;
      const at = mascotPos(g, size.current.height);
      f.shake = 12;
      f.flash = 0.55;
      f.flashColor = '#ffffff';
      f.trail = [];
      burst(f, at.x, at.y, 26, { speed: 220, colors: [accent, '#f5f2e8', '#ff7a6a'], gravity: 380, shape: 'square', size: 4, life: 0.8 });
      sound.play('hit');
      sound.resetCombo();
      buzz([30, 40, 60]);
    };

    const tick = (now: number) => {
      raf = window.requestAnimationFrame(tick);
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      if (!visible) return;
      time += dt;
      const { width, height } = size.current;

      if (kindRef.current === 'skate') {
        const mode = (skate.current ??= createSkateMode(matchMedia('(pointer: coarse)').matches));
        mode.frame(
          boardRef.current ? 0 : dt,
          sound,
          () => buzz(40),
          (final, best) => {
            recordScore('skate', final);
            setScore(final);
            if (best) window.setTimeout(() => sound.play('best'), 500);
          },
        );
        ctx.fillStyle = WELL;
        ctx.fillRect(0, 0, width, height);
        mode.paint(ctx, width, height);
        return;
      }

      const g = game.current;
      const f = fx.current;
      const ph = phase.current;
      const scale = ph === 'dying' ? 0.22 : 1;
      if ((ph === 'play' || ph === 'dying') && !boardRef.current) {
        acc += dt * scale;
        while (acc >= STEP) {
          acc -= STEP;
          if (phase.current !== 'play') break;
          runPhase += (STEP * (speedOf(g) || 175)) / 9;
          scroll += STEP * speedOf(g);
          const dead = g.step(STEP, width, height);
          absorb(f, g.events, g, accent);
          if (dead) die();
        }
        const next = Math.floor(g.score);
        setScore((prev) => (prev === next ? prev : next));
      } else if (ph === 'idle') {
        runPhase += dt * 6;
        scroll += dt * 20;
      }
      stepFx(f, dt * (ph === 'dying' ? 0.5 : 1));

      if (ph === 'dying') {
        dyingFor.current += dt;
        if (dyingFor.current >= DYING_S) {
          phase.current = 'dead';
          setStatus('dead');
          if (beatBest.current) {
            sound.play('best');
            burst(f, width / 2, height * 0.3, 40, { speed: 260, colors: CONFETTI, gravity: 300, shape: 'square', size: 5, life: 1.4, spread: Math.PI * 1.2 });
          } else sound.play('gameover');
        }
      }

      if ((g instanceof FlappyGame || g instanceof GravedadGame) && phase.current === 'play') {
        const at = mascotPos(g, height);
        f.trail.push({ x: at.x, y: g instanceof GravedadGame ? at.y + (g.gdir < 0 ? -30 : 0) : at.y });
        if (f.trail.length > 10) f.trail.shift();
      }

      drawFrame(ctx, { game: g, status: phase.current, width, height, runPhase, time, scroll, accent, fx: f });
    };
    raf = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(raf);
      ro?.disconnect();
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      sound.pause();
    };
  }, []);

  function start() {
    const { width, height } = size.current;
    game.current.reset(width, height);
    fx.current = createFx();
    game.current.tap();
    arcadeSound().resetCombo();
    phase.current = 'play';
    setScore(0);
    setNewBest(false);
    setBoardOpen(false);
    setStatus('play');
  }

  function press() {
    const sound = arcadeSound();
    sound.start();
    if (kind === 'skate') {
      skate.current?.down();
      return;
    }
    if (phase.current === 'dead' || phase.current === 'dying' || boardOpen) return;
    if (phase.current === 'idle') start();
    else game.current.tap();
  }

  function release() {
    if (kind === 'skate') {
      skate.current?.up();
      skate.current?.fall(false);
    }
  }

  function select(next: ArcadeKind) {
    arcadeSound().play('select');
    if (next === kind && status !== 'dead') return;
    if (next === 'skate') skate.current = null;
    else {
      game.current = createGame(next);
      game.current.reset(size.current.width, size.current.height);
    }
    fx.current = createFx();
    phase.current = 'idle';
    setKind(next);
    setStatus('idle');
    setScore(0);
    setNewBest(false);
    setBoardOpen(false);
  }

  function toggleMute() {
    const sound = arcadeSound();
    sound.start();
    setMuted(sound.toggleMute());
  }

  const info = ARCADE_KINDS.find((item) => item.kind === kind) ?? { kind, label: 'Brinca', hint: 'Toca para brincar' };
  const isSkate = kind === 'skate';
  const best = Math.max(score, ...readScores(kind), 0);
  const rows = boardOpen ? leaderboard(kind) : [];

  return (
    <section ref={cardRef} className={full ? 'alumno-arcade is-full' : 'alumno-arcade'} aria-label="Mini juegos">
      <div className="alumno-arcade__head">
        <div className="alumno-arcade__tabs" role="tablist" ref={tabsRef}>
          {pill ? <span className="alumno-arcade__pill" style={{ '--x': `${pill.x}px`, '--w': `${pill.w}px` } as CSSProperties} /> : null}
          {ARCADE_KINDS.map((item) => (
            <button key={item.kind} type="button" role="tab" aria-selected={item.kind === kind} onClick={() => select(item.kind)}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className={isSkate ? 'alumno-arcade__well is-skate' : 'alumno-arcade__well'}>
        <canvas
          ref={canvasRef}
          className="alumno-arcade__canvas"
          onPointerDown={(event) => {
            event.preventDefault();
            try {
              event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
              // synthetic or already-released pointer: the tap still counts
            }
            touchStartY.current = event.clientY;
            press();
          }}
          onPointerMove={(event) => {
            if (isSkate && event.buttons && event.clientY - touchStartY.current > 40) skate.current?.fall(true);
          }}
          onPointerUp={release}
          onPointerCancel={release}
          onKeyDown={(event) => {
            if (event.repeat) return;
            if (event.key === ' ' || event.key === 'Enter' || event.key === 'ArrowUp') {
              event.preventDefault();
              press();
            }
            if (event.key === 'ArrowDown' && isSkate) skate.current?.fall(true);
          }}
          onKeyUp={(event) => {
            if (event.key === ' ' || event.key === 'Enter' || event.key === 'ArrowUp' || event.key === 'ArrowDown') release();
          }}
          tabIndex={0}
          aria-label={`${info.label}. ${info.hint}`}
        />
        {!isSkate && status === 'idle' && !boardOpen ? <p className="alumno-arcade__hint">{info.hint}</p> : null}
        {!isSkate ? (
          <span key={score} className="alumno-arcade__score" aria-live="off">
            {score}
          </span>
        ) : null}

        {!isSkate && status === 'dead' && !boardOpen ? (
          <div className="alumno-arcade__over" role="status">
            {newBest ? <span className="alumno-arcade__badge">¡Nuevo récord!</span> : null}
            <strong>Se acabó</strong>
            <p>
              {score} {score === 1 ? 'punto' : 'puntos'} · tu mejor: {best}
            </p>
            <button className="alumno-arcade__retry" type="button" onClick={start}>
              Otra vez
            </button>
            <button className="alumno-arcade__link" type="button" onClick={() => setBoardOpen(true)}>
              Ver leaderboard
            </button>
          </div>
        ) : null}

        {boardOpen ? (
          <div className="alumno-arcade__board">
            <strong>Leaderboard</strong>
            <p>
              {info.label} · top {Math.min(7, rows.length)}
            </p>
            <ol>
              {rows.map((row, index) => (
                <li key={`${row.name}-${index}`} className={row.me ? 'is-me' : undefined} style={{ '--i': index } as CSSProperties}>
                  <span>{index + 1}</span>
                  <b>{row.name}</b>
                  <em>{row.points}</em>
                </li>
              ))}
            </ol>
            <button className="alumno-arcade__link" type="button" onClick={() => setBoardOpen(false)}>
              Seguir jugando
            </button>
          </div>
        ) : null}
      </div>
      <div className="alumno-arcade__foot">
        <p>{isSkate ? 'Toca: saltar · en el aire: kickflip · desliza abajo: caer' : 'Mini juegos mientras va tu pedido'}</p>
      <div className="alumno-arcade__tools">
        <button type="button" onClick={toggleMute} aria-label={muted ? 'Activar sonido' : 'Silenciar'} aria-pressed={!muted}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9v6h4l5 4V5L8 9H4Z" />
            {muted ? <path d="m17 9 5 6m0-6-5 6" /> : <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />}
          </svg>
        </button>
        <button
          type="button"
          className={boardOpen ? 'is-on' : undefined}
          onClick={() => setBoardOpen((open) => !open)}
          aria-label="Leaderboard"
          aria-pressed={boardOpen}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 4h8v5a4 4 0 0 1-8 0V4Zm0 2H5v1a3 3 0 0 0 3 3m8-4h3v1a3 3 0 0 1-3 3m-4 3v4m-3 3h6m-5-3h4" />
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
