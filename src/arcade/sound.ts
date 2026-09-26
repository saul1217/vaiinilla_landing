// Live WebAudio for the arcade: a looping lofi beat plus effects. Ported from the
// web-game skate example (sound.mjs) with extra effects for the one-tap games.
// Nothing plays until the first tap (browsers require a gesture).

const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const CHORDS = [
  [50, 57, 60, 64, 65],
  [43, 53, 57, 59, 64],
  [48, 55, 59, 62, 64],
  [45, 55, 57, 61, 64],
];
const BPM = 96;
const BEAT = 60 / BPM;
const MUTE_KEY = 'vaiinilla.arcade.muted';

export type SfxName =
  | 'jump'
  | 'flap'
  | 'flip'
  | 'land'
  | 'star'
  | 'points'
  | 'score'
  | 'grind'
  | 'drop'
  | 'perfect'
  | 'gravity'
  | 'hit'
  | 'bail'
  | 'mission'
  | 'gameover'
  | 'best'
  | 'select';

type WindowWithWebkit = Window & { webkitAudioContext?: typeof AudioContext };

function readMuted() {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function createSound() {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let musicBus: GainNode | null = null;
  let noiseBuf: AudioBuffer | null = null;
  let timer: number | null = null;
  let nextBeat = 0;
  let beatIndex = 0;
  let muted = typeof window === 'undefined' ? true : readMuted();
  let combo = 0;

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext ?? (window as WindowWithWebkit).webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 4200;
    master.connect(lp).connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.5;
    musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return true;
  }

  function tone(freq: number, t: number, dur: number, gain: number, type: OscillatorType = 'sine', dest = master, slideTo?: number) {
    if (!ctx || !dest) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(t: number, dur: number, gain: number, freq = 3000, dest = master) {
    if (!ctx || !dest || !noiseBuf) return;
    const s = ctx.createBufferSource();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    s.buffer = noiseBuf;
    f.type = 'bandpass';
    f.frequency.value = freq;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(dest);
    s.start(t);
    s.stop(t + dur);
  }

  function scheduleBeat(i: number, t: number) {
    const bar = Math.floor(i / 4) % 4;
    const beat = i % 4;
    const ch = CHORDS[bar] ?? CHORDS[0]!;
    const root = ch[0] ?? 50;
    if (beat === 0) ch.forEach((m, j) => tone(hz(m + 12), t + j * 0.012, 1.6, 0.035, 'sine', musicBus));
    if (beat === 2) ch.slice(1, 4).forEach((m) => tone(hz(m + 12), t + BEAT * 0.5, 0.9, 0.025, 'sine', musicBus));
    if (beat === 0) tone(hz(root - 12), t, 0.9, 0.16, 'sine', musicBus);
    if (beat === 2) tone(hz(root - 12), t + BEAT * 0.5, 0.6, 0.12, 'sine', musicBus);
    if (beat % 2 === 0) tone(110, t, 0.28, 0.45, 'sine', musicBus, 45);
    else noise(t, 0.16, 0.18, 1800, musicBus);
    noise(t, 0.04, 0.05, 8000, musicBus);
    noise(t + BEAT * 0.62, 0.04, 0.04, 8000, musicBus);
  }

  function tick() {
    if (!ctx) return;
    while (nextBeat < ctx.currentTime + 0.2) {
      scheduleBeat(beatIndex, nextBeat);
      beatIndex++;
      nextBeat += BEAT;
    }
  }

  // Pentatonic steps so consecutive points climb like a melody.
  const LADDER = [72, 74, 76, 79, 81, 84, 86, 88];

  const sfx: Record<SfxName, (t: number) => void> = {
    jump: (t) => tone(520, t, 0.12, 0.12, 'triangle', master, 900),
    flap: (t) => {
      tone(420, t, 0.09, 0.1, 'triangle', master, 760);
      noise(t, 0.06, 0.05, 2400);
    },
    flip: (t) => noise(t, 0.18, 0.15, 5000),
    land: (t) => {
      tone(140, t, 0.08, 0.25, 'square');
      noise(t, 0.06, 0.2, 900);
    },
    star: (t) => {
      tone(1320, t, 0.12, 0.08);
      tone(1760, t + 0.06, 0.16, 0.07);
    },
    points: (t) => tone(880, t, 0.1, 0.05, 'triangle'),
    score: (t) => {
      const note = LADDER[combo % LADDER.length] ?? 72;
      combo++;
      tone(hz(note), t, 0.14, 0.09, 'triangle');
      tone(hz(note + 12), t + 0.03, 0.12, 0.03, 'sine');
    },
    grind: (t) => noise(t, 0.05, 0.03, 6500),
    drop: (t) => {
      tone(180, t, 0.1, 0.22, 'square', master, 90);
      noise(t, 0.08, 0.12, 700);
    },
    perfect: (t) => {
      const note = LADDER[combo % LADDER.length] ?? 72;
      combo++;
      [0, 4, 7, 12].forEach((step, i) => tone(hz(note + step), t + i * 0.045, 0.3, 0.07, 'triangle'));
    },
    gravity: (t) => {
      tone(300, t, 0.14, 0.1, 'sine', master, 700);
      tone(700, t + 0.02, 0.14, 0.04, 'triangle', master, 300);
    },
    hit: (t) => {
      tone(200, t, 0.3, 0.3, 'sawtooth', master, 60);
      noise(t, 0.25, 0.25, 600);
    },
    bail: (t) => tone(300, t, 0.35, 0.2, 'triangle', master, 90),
    mission: (t) => [72, 76, 79, 84].forEach((m, i) => tone(hz(m + 12), t + i * 0.08, 0.4, 0.08, 'triangle')),
    gameover: (t) => [67, 64, 60].forEach((m, i) => tone(hz(m), t + i * 0.18, 0.5, 0.12, 'triangle')),
    best: (t) => [72, 76, 79, 84, 88].forEach((m, i) => tone(hz(m), t + i * 0.07, 0.5, 0.09, 'triangle')),
    select: (t) => tone(660, t, 0.06, 0.05, 'triangle', master, 990),
  };

  return {
    /** Call from a tap/keydown: unlocks audio and starts the beat. */
    start() {
      if (!ensure() || !ctx) return;
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
      if (timer === null) {
        nextBeat = ctx.currentTime + 0.1;
        timer = window.setInterval(tick, 50);
      }
    },
    /** Stops the beat (card scrolled away, tab hidden, page left). */
    pause() {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
      if (ctx && ctx.state === 'running') void ctx.suspend().catch(() => {});
    },
    play(name: SfxName) {
      if (!ctx || muted) return;
      sfx[name](ctx.currentTime);
    },
    resetCombo() {
      combo = 0;
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.8;
      try {
        window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
      } catch {
        // storage blocked: the choice lasts for this visit
      }
      return muted;
    },
    get muted() {
      return muted;
    },
    get running() {
      return timer !== null;
    },
  };
}

export type ArcadeSound = ReturnType<typeof createSound>;

let shared: ArcadeSound | null = null;
export function arcadeSound(): ArcadeSound {
  shared ??= createSound();
  return shared;
}

/** Short buzz on hits (Android only; iOS ignores it). */
export function buzz(ms: number | number[]) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // not allowed without a gesture on some browsers
  }
}
