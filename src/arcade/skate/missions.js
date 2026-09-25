// Challenges ("retos"): three at a time, scaled by player level. Progress reads the run's stats.
import { meters } from "./world.js";

const POOL = [
  { id: "cones",     label: (n) => `SALTA ${n} CONOS`,         base: 5,   grow: 3,   value: (r) => r.stats.cones },
  { id: "kickflips", label: (n) => `HAZ ${n} KICKFLIPS`,       base: 2,   grow: 2,   value: (r) => r.stats.kickflips },
  { id: "grinds",    label: (n) => `GRINDA ${n} VECES`,        base: 2,   grow: 2,   value: (r) => r.stats.grinds },
  { id: "stars",     label: (n) => `RECOGE ${n} ESTRELLAS`,    base: 15,  grow: 10,  value: (r) => r.stats.stars },
  { id: "distance",  label: (n) => `LLEGA A ${n} M`,           base: 300, grow: 200, value: (r) => meters(r) },
  { id: "combo",     label: (n) => `COMBO DE ${n}`,            base: 4,   grow: 2,   value: (r) => r.bestCombo },
  { id: "clean",     label: (n) => `${n} M SIN GOLPES`,        base: 150, grow: 100, value: (r) => Math.floor(r.stats.cleanDistance / 20) },
  { id: "score",     label: (n) => `${n} PUNTOS`,              base: 2000, grow: 1500, value: (r) => r.score },
];

/** Picks three different challenges for this level, deterministic per level. */
export function missionsFor(level) {
  const picks = [];
  let k = level * 7 + 3;
  while (picks.length < 3) {
    k = (Math.imul(k, 1103515245) + 12345) & 0x7fffffff;
    const m = POOL[k % POOL.length];
    if (!picks.some((p) => p.id === m.id)) picks.push(m);
  }
  return picks.map((m) => {
    const target = m.base + m.grow * level;
    return { id: m.id, target, label: m.label(target), value: m.value };
  });
}

export function progress(mission, run) {
  const v = mission.value(run);
  return { v: Math.min(v, mission.target), done: v >= mission.target };
}
