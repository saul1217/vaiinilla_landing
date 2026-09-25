// Vaini Skate inside the arcade card: the web-game skill's skate (pixel 480×270,
// kickflips, grinds, combos, lives, missions per level) driven by the card's loop.
import { createCanvas, W, H, type PixelCanvas } from './skate/raster.js';
import { createRun, step, pressJump, releaseJump, setFastFall, type SkateRun } from './skate/world.js';
import { missionsFor, progress, type SkateMission } from './skate/missions.js';
import { loadProgress, saveProgress, type SkateSave } from './skate/storage.js';
import { createFx, absorbEvents, drawWorld, drawHud, drawTitle, drawGameOver, type SkateFx } from './skate/render.js';
import type { ArcadeSound, SfxName } from './sound';

const STEP = 1 / 120;
const SOUNDS = new Set(['jump', 'flip', 'land', 'star', 'hit', 'bail', 'points', 'gameover']);

export const SKATE_W = W;
export const SKATE_H = H;

export interface SkateMode {
  readonly screen: 'title' | 'playing' | 'over';
  readonly run: SkateRun;
  down(): void;
  up(): void;
  fall(on: boolean): void;
  frame(dt: number, sound: ArcadeSound, onHit: () => void, onOver: (score: number, newBest: boolean) => void): void;
  paint(target: CanvasRenderingContext2D, width: number, height: number): void;
}

function autopilot(r: SkateRun) {
  const ahead = r.obstacles.find((o) => o.x - r.distance > 120 && o.x - r.distance < 175);
  if (ahead && r.player.grounded) pressJump(r);
  if (!r.player.grounded && r.player.vy > 0) releaseJump(r);
}

export function createSkateMode(touch: boolean): SkateMode {
  const cv: PixelCanvas = createCanvas();
  const buffer = document.createElement('canvas');
  buffer.width = W;
  buffer.height = H;
  const bctx = buffer.getContext('2d');
  const image = bctx ? bctx.createImageData(W, H) : null;

  const save: SkateSave = loadProgress();
  let missions: SkateMission[] = missionsFor(save.level);
  let run = createRun();
  let fx: SkateFx = createFx();
  let screen: SkateMode['screen'] = 'title';
  let screenTime = 0;
  let acc = 0;
  let toast: { text: string; life: number } | null = null;
  let result = { newBest: false, levelUp: false, missions, snapshot: save };
  let sound: ArcadeSound | null = null;

  function start() {
    run = createRun();
    fx = createFx();
    screen = 'playing';
    screenTime = 0;
  }

  function checkMissions() {
    for (const m of missions) {
      if (save.done.includes(m.id)) continue;
      if (progress(m, run).done) {
        save.done.push(m.id);
        saveProgress(save);
        toast = { text: `¡RETO: ${m.label}!`, life: 2 };
        sound?.play('mission');
      }
    }
  }

  function end(onOver: (score: number, newBest: boolean) => void) {
    screen = 'over';
    screenTime = 0;
    const newBest = run.score > save.best;
    if (newBest) save.best = run.score;
    const levelUp = missions.every((m) => save.done.includes(m.id));
    const shown = missions;
    if (levelUp) {
      save.level += 1;
      save.done = [];
      missions = missionsFor(save.level);
    }
    saveProgress(save);
    result = { newBest, levelUp, missions: shown, snapshot: { ...save, done: levelUp ? shown.map((m) => m.id) : save.done } };
    onOver(run.score, newBest);
  }

  return {
    get screen() {
      return screen;
    },
    get run() {
      return run;
    },
    down() {
      if (screen === 'title') return start();
      if (screen === 'over') {
        if (screenTime > 0.8) start();
        return;
      }
      pressJump(run);
    },
    up() {
      if (screen === 'playing') releaseJump(run);
    },
    fall(on) {
      setFastFall(run, on);
    },
    frame(dt, s, onHit, onOver) {
      sound = s;
      acc += dt;
      screenTime += dt;
      while (acc >= STEP) {
        if (screen === 'title') {
          autopilot(run);
          step(run, STEP);
          if (run.over) run = createRun();
        } else if (screen === 'playing') {
          step(run, STEP);
          checkMissions();
          if (run.over) end(onOver);
        }
        acc -= STEP;
      }
      if (screen === 'playing' || screen === 'over') {
        for (const e of run.events) if (SOUNDS.has(e.type)) s.play(e.type as SfxName);
        if (run.events.some((e) => e.type === 'hit' || e.type === 'bail')) onHit();
        if (run.events.some((e) => e.type === 'grindSpark') && Math.random() < 0.3) s.play('grind');
      }
      absorbEvents(fx, run);
      run.events.length = 0;
      if (toast) {
        toast.life -= dt;
        if (toast.life <= 0) toast = null;
      }
      drawWorld(cv, run, fx, dt, toast);
      if (screen === 'playing') drawHud(cv, run, missions, save.done, s.muted, touch);
      if (screen === 'title') drawTitle(cv, screenTime, save, missions, touch);
      if (screen === 'over') drawGameOver(cv, run, screenTime, result.snapshot, result.newBest, result.levelUp, result.missions, touch);
    },
    paint(target, width, height) {
      if (!bctx || !image) return;
      image.data.set(cv.data);
      bctx.putImageData(image, 0, 0);
      target.imageSmoothingEnabled = false;
      target.drawImage(buffer, 0, 0, width, height);
      target.imageSmoothingEnabled = true;
    },
  };
}
