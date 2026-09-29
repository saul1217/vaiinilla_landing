// Vaini Skate inside the arcade card: wraps the original rules/HUD/screens so the shell can drive it like any other game.
import { createRun, step as stepRun, pressJump, releaseJump, setFastFall } from "./skate/world.mjs";
import { missionsFor, progress } from "./skate/missions.mjs";
import { createFx, absorbEvents, drawWorld, drawHud, drawTitle, drawGameOver } from "./skate/render.mjs";

const KEY = "vaini-skate.v1";
const FRESH = { best: 0, level: 0, done: [] };
const loadProgress = () => {
  try { const p = JSON.parse(localStorage.getItem(KEY) || "null"); return p ? { best: +p.best || 0, level: +p.level || 0, done: Array.isArray(p.done) ? p.done : [] } : { ...FRESH }; } catch { return { ...FRESH }; }
};
const saveProgress = (p) => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode */ } };

export const custom = true;          // the shell hands over HUD, title and game-over screens
const SOUND = { jump: "jump", flip: "flip", land: "land", star: "score", hit: "hit", bail: "hit", points: null };

export const rules = {
  create(seed) {
    const save = typeof localStorage === "undefined" ? { ...FRESH } : loadProgress();
    return { seed, run: createRun(seed), fx: createFx(), save, missions: missionsFor(save.level), started: false, over: false, deadT: 0, score: 0, events: [], toast: null, result: null, t: 0 };
  },
  tap(w) {
    if (w.over) return;
    if (!w.started) { w.started = true; w.run = createRun(w.seed); w.fx = createFx(); }
    pressJump(w.run);
  },
  release(w) { releaseJump(w.run); },
  fall(w, on) { setFastFall(w.run, on); },
  step(w, dt) {
    w.t += dt;
    if (w.toast) { w.toast.life -= dt; if (w.toast.life <= 0) w.toast = null; }
    if (!w.started) {                      // title: the demo run plays itself
      const r = w.run, ahead = r.obstacles.find((o) => o.x - r.distance > 120 && o.x - r.distance < 175);
      if (ahead && r.player.grounded) pressJump(r);
      if (!r.player.grounded && r.player.vy > 0) releaseJump(r);
      stepRun(r, dt);
      absorbEvents(w.fx, r); r.events.length = 0;
      if (r.over) w.run = createRun(w.seed);
      return;
    }
    if (w.over) { w.deadT += dt; return; }
    stepRun(w.run, dt);
    w.score = w.run.score;
    for (const e of w.run.events) if (e.type in SOUND && SOUND[e.type]) w.events.push({ type: e.type });
    absorbEvents(w.fx, w.run); w.run.events.length = 0;
    for (const m of w.missions) {
      if (w.save.done.includes(m.id)) continue;
      if (progress(m, w.run).done) { w.save.done.push(m.id); saveProgress(w.save); w.toast = { text: `¡RETO: ${m.label}!`, life: 2 }; }
    }
    if (w.run.over) {
      w.over = true;
      const r = w.run, save = w.save;
      const newBest = r.score > save.best;
      if (newBest) save.best = r.score;
      const levelUp = w.missions.every((m) => save.done.includes(m.id));
      const shown = w.missions;
      if (levelUp) { save.level += 1; save.done = []; w.missions = missionsFor(save.level); }
      saveProgress(save);
      w.result = { newBest, levelUp, missions: shown, snapshot: { ...save, done: levelUp ? shown.map((m) => m.id) : save.done } };
    }
  },
};

export function draw(cv, w, ui) {
  drawWorld(cv, w.run, w.fx, ui.dt, w.toast);
  if (ui.screen === "playing") drawHud(cv, w.run, w.missions, w.save.done, false, ui.touch);
  else if (ui.screen === "title") drawTitle(cv, ui.screenTime, w.save, w.missions, ui.touch);
  else if (w.result) drawGameOver(cv, w.run, ui.screenTime, w.result.snapshot, w.result.newBest, w.result.levelUp, w.result.missions, ui.touch);
}
