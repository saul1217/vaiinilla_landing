// Vaini Arcade engine (the prototype's main.mjs as a mountable module): fixed-step
// loop, title → playing → over, effects and sound, drawn into a 480×270 canvas.
import { W, H, createCanvas, PAL, createFx, burst, dashes, popup, stepFx } from "./kit.mjs";
import { createSound } from "./sound.mjs";
import { GAMES, renderFrame } from "./games.mjs";
import * as flappy from "./games/flappy.rules.mjs";
import * as gravedad from "./games/gravedad.rules.mjs";
import * as galaxia from "./games/galaxia.rules.mjs";

const STEP = 1 / 120;
// Sin jugar (título o fin de juego) basta con pocos cuadros: el motor pinta cada píxel
// en JavaScript, y a 60 cuadros por segundo competía con la interfaz y gastaba batería.
const IDLE_FRAME_MS = 1000 / 12;
// Después de perder, el estallido sigue fluido este tiempo antes de bajar de ritmo.
const OVER_SMOOTH_S = 1;
const KILL_COLORS = { dona: ["#ff9db0", "#ffffff", "#d99a55"], taza: ["#d9714a", "#ffffff", "#5a3a26"], cruasan: ["#e8a040", "#f8c860", "#ffffff"] };

export const ARCADE_GAMES = Object.entries(GAMES).map(([key, g]) => ({ key, label: g.label, tag: g.tag }));

const bestOf = (k) => { try { return +localStorage.getItem("vaini-arcade-best-" + k) || 0; } catch { return 0; } };
const saveBest = (k, v) => { try { localStorage.setItem("vaini-arcade-best-" + k, String(v)); } catch { /* private mode */ } };
const seed = () => 1 + Math.floor(Math.random() * 9999);

export function mountArcade(canvas, { game = "flappy" } = {}) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  canvas.width = W; canvas.height = H;
  const touch = matchMedia?.("(pointer: coarse)").matches ?? false;
  const cv = createCanvas();
  const image = new ImageData(cv.data, W, H);
  const sound = createSound();
  let key = GAMES[game] ? game : "flappy";
  let s, fx, screen, screenTime, newBest, frameDt = 1 / 60;
  let visible = true, raf = 0, last = performance.now(), acc = 0, downY = 0;
  let quiet = false, lastDraw = 0;
  const idle = () => screen === "title" || (screen === "over" && screenTime > OVER_SMOOTH_S);

  function load(k) {
    key = GAMES[k] ? k : key;
    s = GAMES[key].rules.create(seed());
    fx = createFx();
    screen = "title"; screenTime = 0; newBest = false;
    render(); lastDraw = performance.now();
  }

  function restart() {
    s = GAMES[key].rules.create(seed());
    fx = createFx();
    screen = "playing"; screenTime = 0; newBest = false;
    GAMES[key].rules.tap(s);
  }

  function onEvent(e) {
    const k = key + ":" + e.type;
    if (e.type === "level" || (key === "galaxia" && e.type === "wave")) {
      sound.play(e.type === "wave" ? "wave" : "level");
      return;
    }
    switch (k) {
      case "flappy:flap": sound.play("flap"); dashes(fx, 108, s.y + 14, -1); break;
      case "flappy:score": sound.play("score"); break;
      case "flappy:hit": case "apila:hit": case "gravedad:hit":
        sound.play("hit"); fx.shake = 0.6;
        burst(fx, key === "flappy" ? flappy.K.X : 240, s.y ?? 150, 12, { col: [PAL.cream, PAL.lime, PAL.gold], speed: 90, life: 0.6, up: 40, grav: 220 });
        if (navigator.vibrate && touch) navigator.vibrate(60);
        break;
      case "skate:hit": case "skate:bail": sound.play("hit"); fx.shake = 0.4; if (navigator.vibrate && touch) navigator.vibrate(40); break;
      case "skate:jump": case "skate:flip": case "skate:land": sound.play(e.type); break;
      case "skate:star": sound.play("score"); break;
      case "apila:release": sound.play("release"); break;
      case "apila:place": sound.play("place"); burst(fx, e.x, e.y + 16 + s.cam, 6, { col: "#f2e6d0", speed: 40, life: 0.3, grav: 60 }); break;
      case "apila:grow": popup(fx, "+ANCHO", 240, 130, PAL.limeHi); break;
      case "apila:perfect":
        sound.play("perfect");
        burst(fx, e.x, e.y + 8 + s.cam, 14, { col: [PAL.gold, "#ffffff", PAL.limeHi], speed: 90, life: 0.5, grav: 0, size: 1 });
        popup(fx, e.combo > 1 ? "PERFECTO x" + e.combo : "¡PERFECTO!", e.x, e.y - 8 + s.cam, PAL.gold);
        break;
      case "gravedad:flip": sound.play("flip"); burst(fx, gravedad.K.X, s.y, 8, { col: ["#ffffff", PAL.limeHi], speed: 70, life: 0.3, grav: 0 }); break;
      case "gravedad:land": sound.play("land"); burst(fx, gravedad.K.X, e.dir > 0 ? gravedad.K.FLOOR : gravedad.K.CEIL, 5, { col: PAL.gold, speed: 60, life: 0.25, grav: e.dir > 0 ? 120 : -120 }); break;
      case "gravedad:score": sound.play("score"); break;
      case "galaxia:shoot": if (Math.random() < 0.5) sound.play("shoot"); break;
      case "galaxia:hitEnemy": sound.play("hitEnemy"); break;
      case "galaxia:kill": sound.play("kill"); burst(fx, e.x, e.y, 10, { col: KILL_COLORS[e.kind], speed: 80, life: 0.45, grav: 90, size: 1 }); popup(fx, "+" + e.pts, e.x, e.y - 6, PAL.gold); break;
      case "galaxia:hurt": sound.play("hurt"); fx.shake = 0.7; burst(fx, s.x, galaxia.K.SHIP_Y, 14, { col: [PAL.cream, PAL.lime, "#ff9a3a"], speed: 90, life: 0.6, grav: 60 }); if (navigator.vibrate && touch) navigator.vibrate(60); break;
      case "galaxia:power": sound.play("power"); popup(fx, "¡DISPARO x" + e.n + "!", s.x, galaxia.K.SHIP_Y - 44, PAL.limeHi); break;
      case "galaxia:life": sound.play("life"); popup(fx, "+VIDA", s.x, galaxia.K.SHIP_Y - 44, "#ff8aa0"); break;
      case "galaxia:bossFire": sound.play("shoot"); break;
      case "galaxia:bossDown": sound.play("bossDown"); fx.shake = 0.8; burst(fx, e.x, e.y, 34, { col: ["#ffffff", "#ffe45c", "#ff8a5a", "#3a3a4a"], speed: 150, life: 0.9, grav: 60, size: 1 }); popup(fx, "¡CAFETERA FUERA! +500", 240, 90, PAL.gold); break;
      case "galaxia:hit": sound.play("hit"); fx.shake = 0.8; break;
    }
  }

  function step(dt) {
    GAMES[key].rules.step(s, dt);
    for (const e of s.events) onEvent(e);
    s.events.length = 0;
    stepFx(fx, dt);
    screenTime += dt;
    if (screen === "playing" && s.over && s.deadT > 0.85) {
      screen = "over"; screenTime = 0;
      if (!GAMES[key].custom) {
        const sc = Math.floor(s.score);
        newBest = sc > bestOf(key);
        if (newBest) saveBest(key, sc);
      }
    }
  }

  function render() {
    const best = Math.max(bestOf(key), screen === "over" && !GAMES[key].custom ? Math.floor(s.score) : 0);
    renderFrame(cv, key, s, fx, { screen, screenTime, best, newBest, dt: frameDt, touch });
    const sh = fx.shake, ox = sh > 0 ? Math.round((Math.random() - 0.5) * 6 * sh) : 0, oy = sh > 0 ? Math.round((Math.random() - 0.5) * 6 * sh) : 0;
    ctx.putImageData(image, ox, oy);
  }

  // ---------- input ----------
  function down() {
    sound.start();
    const g = GAMES[key];
    if (screen === "title") { screen = "playing"; screenTime = 0; g.rules.tap(s); return; }
    if (screen === "over") { if (screenTime > 0.7) restart(); return; }
    g.rules.tap(s);
  }
  function up() { const r = GAMES[key].rules; if (screen === "playing" && r.release) r.release(s); }
  const canvasX = (e) => { const r = canvas.getBoundingClientRect(); return ((e.clientX - r.left) / r.width) * W; };

  const onPointerDown = (e) => {
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    downY = e.clientY;
    GAMES[key].rules.aim?.(s, canvasX(e));
    down();
  };
  const onPointerMove = (e) => {
    const r = GAMES[key].rules;
    if (r.aim && (e.buttons || e.pointerType === "mouse")) r.aim(s, canvasX(e));
    if (r.fall && e.buttons && e.clientY - downY > 40) r.fall(s, true);
  };
  const onPointerUp = () => { up(); GAMES[key].rules.fall?.(s, false); };
  // Keys only while the canvas has focus, so Space still scrolls the page elsewhere.
  const onKeyDown = (e) => {
    if (key === "galaxia") { if (e.code === "ArrowLeft") { s.key = -1; if (screen === "title") down(); } if (e.code === "ArrowRight") { s.key = 1; if (screen === "title") down(); } }
    if (e.repeat) return;
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "Enter") { e.preventDefault(); down(); }
    if (e.code === "ArrowDown") { e.preventDefault(); GAMES[key].rules.fall?.(s, true); }
  };
  const onKeyUp = (e) => {
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "Enter") up();
    if (e.code === "ArrowDown") GAMES[key].rules.fall?.(s, false);
    if (key === "galaxia" && (e.code === "ArrowLeft" || e.code === "ArrowRight")) s.key = 0;
  };
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("keydown", onKeyDown);
  canvas.addEventListener("keyup", onKeyUp);

  // ---------- loop (paused while off-screen or in a background tab) ----------
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    acc += dt;
    while (acc >= STEP) { step(STEP); acc -= STEP; }
    // La lógica avanza cada cuadro (es barata); sin jugar, el dibujo va a pocos cuadros.
    if (idle() && now - lastDraw < IDLE_FRAME_MS) return;
    frameDt = lastDraw ? Math.min(0.1, (now - lastDraw) / 1000) : dt;
    render();
    lastDraw = now;
  }
  function run() {
    if (raf || !visible || document.hidden || (quiet && idle())) return;
    last = performance.now(); acc = 0;
    raf = requestAnimationFrame(frame);
  }
  function halt() { cancelAnimationFrame(raf); raf = 0; }
  const onVisibility = () => (document.hidden ? halt() : run());
  document.addEventListener("visibilitychange", onVisibility);
  const io = typeof IntersectionObserver === "function"
    ? new IntersectionObserver(([entry]) => { visible = entry?.isIntersecting ?? true; if (visible) run(); else halt(); })
    : null;
  io?.observe(canvas);

  load(key);
  run();

  return {
    load,
    toggleMute: () => sound.toggleMute(),
    /** Mientras otra animación de la página corre, el arcade sin jugar se detiene. */
    setQuiet(on) {
      quiet = on;
      if (on && idle()) halt();
      else run();
    },
    destroy() {
      halt();
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("keydown", onKeyDown);
      canvas.removeEventListener("keyup", onKeyUp);
    },
  };
}
