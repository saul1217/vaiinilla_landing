// Android WaitingArcadeCard: a dark card with four one-tap games shown under the
// first active order. Drawing mirrors drawArcadeFrame + drawVaiinillaMascotRunner.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
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
  type ArcadeGame,
  type ArcadeKind,
  type ArcadeStatus,
} from '../lib/waiting-arcade';

function svgPath(d: string): { d: string; path?: Path2D } {
  return { d };
}

const WELL = '#0a0a0c';
const CONTROL = '#232427';
const INK = '#f5f2e8';
const MASCOT_BOX = 44;
const FEET = 0.777;

const BODY = svgPath('M23.7 18.9Q25.3 17.1 26.19 17.91L29.39 20.85Q30.87 22.2 32.34 20.85L35.55 17.91Q36.43 17.1 37.32 17.91L40.53 20.85Q42 22.2 43.47 20.85L46.68 17.91Q47.56 17.1 48.45 17.91L51.66 20.85Q53.13 22.2 54.6 20.85L57.81 17.91Q58.7 17.1 59.07 18.24L59.64 19.94Q59.9 20.7 60.46 21.27L77.33 38.14Q77.9 38.7 77.9 39.5L77.9 67.3Q77.9 72.5 72.7 72.5L27.3 72.5Q22.1 72.5 22.1 67.3L22.1 25.9Q22.1 20.7 23.7 18.9Z');
const FOLD = svgPath('M59.9 20.7L59.9 33.1Q59.9 38.7 65.49 38.7L77.9 38.7Z');
const BAR_TOP = svgPath('M30 29.1a1.8 1.8 0 0 1 1.8-1.8h19.21a1.8 1.8 0 0 1 0 3.6H31.8A1.8 1.8 0 0 1 30 29.1Z');
const BAR_BOTTOM = svgPath('M29.85 36.15a1.65 1.65 0 0 1 1.65-1.65h12.09a1.65 1.65 0 0 1 0 3.3H31.5a1.65 1.65 0 0 1-1.65-1.65Z');
const EYE_LEFT = svgPath('M43.1 52.5C43.1 56.54 42.35 57.9 40.1 57.9C37.85 57.9 37.1 56.54 37.1 52.5C37.1 48.46 37.85 47.1 40.1 47.1C42.35 47.1 43.1 48.46 43.1 52.5Z');
const EYE_RIGHT = svgPath('M62.9 52.5C62.9 56.54 62.15 57.9 59.9 57.9C57.65 57.9 56.9 56.54 56.9 52.5C56.9 48.46 57.65 47.1 59.9 47.1C62.15 47.1 62.9 48.46 62.9 52.5Z');

// Path2D does not exist in jsdom; build on first draw.
function path(p: { d: string; path?: Path2D }) {
  p.path ??= new Path2D(p.d);
  return p.path;
}

function lime() {
  return getComputedStyle(document.documentElement).getPropertyValue('--lime').trim() || '#b8d86b';
}

function drawRunner(
  ctx: CanvasRenderingContext2D,
  feetX: number,
  feetY: number,
  box: number,
  runPhase: number,
  airborne: boolean,
  lean: number,
  upsideDown: boolean,
  accent: string,
) {
  const s = box / 100;
  ctx.save();
  ctx.translate(feetX - box * 0.5, feetY - box * FEET);
  if (upsideDown) {
    ctx.translate(0, box * 0.41 * 2);
    ctx.scale(1, -1);
  }
  ctx.translate(50 * s, 82 * s);
  ctx.rotate((lean * Math.PI) / 180);
  ctx.translate(-50 * s, -82 * s);
  ctx.scale(s, s);

  const swing = Math.sin(runPhase);
  const leftFoot: [number, number] = airborne ? [36.5, 72.4] : [39.75 + swing * 5.2, 77.65 - Math.max(0, -swing) * 4.6];
  const rightFoot: [number, number] = airborne ? [63.5, 71.4] : [60.25 - swing * 5.2, 77.65 - Math.max(0, swing) * 4.6];
  const arm = ((airborne ? -46 : swing * 30) * Math.PI) / 180;
  ctx.strokeStyle = INK;
  ctx.lineCap = 'round';

  const limb = (x: number, y: number, tx: number, ty: number, width: number, angle = 0) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(tx - x, ty - y);
    ctx.stroke();
    ctx.restore();
  };
  limb(24.1, 52.5, 16.49, 61.65, 7, -arm);
  limb(75.9, 52.5, 83.51, 61.65, 7, arm);
  limb(39.75, 70.5, leftFoot[0], leftFoot[1], 11.7);
  limb(60.25, 70.5, rightFoot[0], rightFoot[1], 11.7);

  ctx.fillStyle = INK;
  ctx.fill(path(BODY));
  ctx.fillStyle = accent;
  ctx.fill(path(FOLD));
  ctx.fill(path(BAR_TOP));
  ctx.fill(path(BAR_BOTTOM));
  ctx.fillStyle = WELL;
  const eye = airborne ? 1.14 : 1;
  for (const [p, cx] of [
    [EYE_LEFT, 40.1],
    [EYE_RIGHT, 59.9],
  ] as const) {
    ctx.save();
    ctx.translate(cx, 52.5);
    ctx.scale(1, eye);
    ctx.translate(-cx, -52.5);
    ctx.fill(path(p));
    ctx.restore();
  }
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, color: string) {
  if (w <= 0 || h <= 0) return;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
  ctx.fill();
}

function dashedGround(ctx: CanvasRenderingContext2D, width: number, y: number) {
  ctx.strokeStyle = 'rgba(245, 242, 232, 0.28)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let x = 10; x < width - 10; x += 30) {
    ctx.moveTo(x, y);
    ctx.lineTo(Math.min(x + 14, width - 10), y);
  }
  ctx.stroke();
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  game: ArcadeGame,
  status: ArcadeStatus,
  width: number,
  height: number,
  runPhase: number,
  time: number,
  accent: string,
) {
  ctx.clearRect(0, 0, width, height);
  const box = MASCOT_BOX;

  if (game instanceof FlappyGame) {
    dashedGround(ctx, width, height - 24);
    for (const c of game.columns) {
      roundRect(ctx, c.x, -6, 46, c.gapTop + 6, 10, CONTROL);
      roundRect(ctx, c.x, c.gapTop + c.gap, 46, height - c.gapTop - c.gap - 18, 10, CONTROL);
      ctx.fillStyle = accent;
      ctx.fillRect(c.x + 5, c.gapTop - 6, 36, 5);
      ctx.fillRect(c.x + 5, c.gapTop + c.gap + 1, 36, 5);
    }
    const tilt = status === 'idle' ? 0 : Math.max(-29, Math.min(52, (game.vy / 600) * 57.2958));
    const bob = status === 'idle' ? Math.sin(time / 300) * 6 : 0;
    drawRunner(ctx, 70, game.y + bob + box * FEET * 0.5, box, runPhase, true, tilt, false, accent);
  } else if (game instanceof BrincaGame) {
    const gy = game.floorY(height) + 15;
    dashedGround(ctx, width, gy);
    for (const o of game.obstacles) {
      roundRect(ctx, o.x, gy - o.h, o.w, o.h, 4, INK);
      ctx.fillStyle = accent;
      ctx.fillRect(o.x + 2, gy - (o.h - 3), o.w - 4, 3);
    }
    const tilt = Math.max(-30, Math.min(30, (game.vy / 1400) * 57.2958));
    drawRunner(ctx, 70, game.y + 15, box, runPhase, game.y < game.floorY(height) - 0.5, tilt, false, accent);
  } else if (game instanceof ApilaGame) {
    dashedGround(ctx, width, height - 22);
    game.stack.forEach((b, i) => {
      const by = height - 46 - i * game.blockH + game.cam;
      if (by <= height + 20) roundRect(ctx, b.x, by, b.w, game.blockH - 3, 4, i % 5 === 4 ? accent : INK);
    });
    if (game.fall) roundRect(ctx, game.fall.x, game.fall.y, game.fall.w, game.blockH - 3, 4, INK);
    const top = game.stack[game.stack.length - 1] ?? { x: 0, w: 150 };
    if (status !== 'idle') {
      const my = game.topY(height) - game.blockH - 24;
      roundRect(ctx, game.pos, my, top.w, game.blockH - 3, 4, game.stack.length % 5 === 4 ? accent : INK);
      drawRunner(ctx, game.pos + top.w / 2, my, box * 0.8, runPhase, true, 0, false, accent);
    } else {
      drawRunner(ctx, width / 2, game.topY(height) - game.blockH + 4, box * 0.85, runPhase, true, 0, false, accent);
    }
  } else if (game instanceof GravedadGame) {
    const ceil = game.ceilY() - 16;
    const floor = game.floorY(height) + 15;
    ctx.strokeStyle = CONTROL;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(10, ceil);
    ctx.lineTo(width - 10, ceil);
    ctx.stroke();
    dashedGround(ctx, width, floor);
    ctx.fillStyle = 'rgba(245, 242, 232, 0.86)';
    for (const o of game.obstacles) {
      const base = o.side > 0 ? floor : ceil;
      const n = Math.max(2, Math.floor(o.w / 14));
      const tip = o.side > 0 ? base - 20 : base + 20;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x0 = o.x + (o.w * i) / n;
        ctx.moveTo(x0, base);
        ctx.lineTo(x0 + o.w / n / 2, tip);
        ctx.lineTo(x0 + o.w / n, base);
      }
      ctx.fill();
    }
    const onCeil = game.gdir < 0;
    drawRunner(ctx, 70, game.y + (onCeil ? -14 : 15), box, runPhase, false, 0, onCeil, accent);
  }
}

export function WaitingArcade() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [kind, setKind] = useState<ArcadeKind>('brinca');
  const [status, setStatus] = useState<ArcadeStatus>('idle');
  const [score, setScore] = useState(0);
  const [boardOpen, setBoardOpen] = useState(false);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);
  const game = useRef<ArcadeGame>(createGame('brinca'));
  const statusRef = useRef(status);
  const boardRef = useRef(boardOpen);
  const size = useRef({ width: 336, height: 250 });
  statusRef.current = status;
  boardRef.current = boardOpen;

  // Sliding selector pill (same trick as the bottom nav).
  useLayoutEffect(() => {
    const tabs = tabsRef.current;
    const active = tabs?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (tabs && active) setPill({ x: active.offsetLeft, w: active.offsetWidth });
  }, [kind]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext?.('2d');
    if (!canvas || !ctx) return;
    const accent = lime();
    let frame = 0;
    let last = 0;
    let runPhase = 0;
    let visible = true;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      size.current = { width: rect.width, height: rect.height };
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (statusRef.current === 'idle') game.current.reset(rect.width, rect.height);
    };
    resize();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    ro?.observe(canvas);
    const io =
      typeof IntersectionObserver === 'function'
        ? new IntersectionObserver(([entry]) => {
            visible = entry?.isIntersecting ?? true;
          })
        : null;
    io?.observe(canvas);

    const tick = (now: number) => {
      frame = window.requestAnimationFrame(tick);
      const dt = last ? Math.min(0.033, (now - last) / 1000) : 0;
      last = now;
      if (!visible) return;
      const { width, height } = size.current;
      const g = game.current;
      if (statusRef.current === 'play' && !boardRef.current && dt > 0) {
        const speed = g instanceof BrincaGame || g instanceof GravedadGame ? g.speed : 175;
        runPhase += (dt * speed) / 9;
        const dead = g.step(dt, width, height);
        const next = Math.floor(g.score);
        setScore((prev) => (prev === next ? prev : next));
        if (dead) {
          recordScore(g.kind, next);
          setStatus('dead');
        }
      }
      drawFrame(ctx, g, statusRef.current, width, height, runPhase, now, accent);
    };
    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
      ro?.disconnect();
      io?.disconnect();
    };
  }, []);

  function start() {
    const { width, height } = size.current;
    game.current.reset(width, height);
    game.current.tap();
    setScore(0);
    setBoardOpen(false);
    setStatus('play');
  }

  function primary() {
    if (status === 'dead' || boardOpen) return;
    if (status === 'idle') start();
    else game.current.tap();
  }

  function select(next: ArcadeKind) {
    if (next === kind && status !== 'dead') return;
    game.current = createGame(next);
    game.current.reset(size.current.width, size.current.height);
    setKind(next);
    setStatus('idle');
    setScore(0);
    setBoardOpen(false);
  }

  const info = ARCADE_KINDS.find((item) => item.kind === kind) ?? { kind, label: 'Brinca', hint: 'Toca para brincar' };
  const best = Math.max(score, ...readScores(kind), 0);
  const rows = boardOpen ? leaderboard(kind) : [];

  return (
    <section className="alumno-arcade" aria-label="Mini juegos">
      <div className="alumno-arcade__head">
        <div className="alumno-arcade__tabs" role="tablist" ref={tabsRef}>
          {pill ? <span className="alumno-arcade__pill" style={{ '--x': `${pill.x}px`, '--w': `${pill.w}px` } as CSSProperties} /> : null}
          {ARCADE_KINDS.map((item) => (
            <button key={item.kind} type="button" role="tab" aria-selected={item.kind === kind} onClick={() => select(item.kind)}>
              {item.label}
            </button>
          ))}
        </div>
        <button
          className={boardOpen ? 'alumno-arcade__trophy is-on' : 'alumno-arcade__trophy'}
          type="button"
          aria-label="Leaderboard"
          aria-pressed={boardOpen}
          onClick={() => setBoardOpen((open) => !open)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 4h8v5a4 4 0 0 1-8 0V4Zm0 2H5v1a3 3 0 0 0 3 3m8-4h3v1a3 3 0 0 1-3 3m-4 3v4m-3 3h6m-5-3h4" />
          </svg>
        </button>
      </div>

      <div className="alumno-arcade__well">
        <canvas
          ref={canvasRef}
          className="alumno-arcade__canvas"
          onPointerDown={(event) => {
            event.preventDefault();
            primary();
          }}
          onKeyDown={(event) => {
            if (event.key === ' ' || event.key === 'Enter') {
              event.preventDefault();
              primary();
            }
          }}
          tabIndex={0}
          aria-label={`${info.label}. ${info.hint}`}
        />
        {status === 'idle' && !boardOpen ? <p className="alumno-arcade__hint">{info.hint}</p> : null}
        <span key={score} className="alumno-arcade__score" aria-live="off">
          {score}
        </span>

        {status === 'dead' && !boardOpen ? (
          <div className="alumno-arcade__over" role="status">
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
      <p className="alumno-arcade__foot">Mini juegos mientras va tu pedido</p>
    </section>
  );
}
