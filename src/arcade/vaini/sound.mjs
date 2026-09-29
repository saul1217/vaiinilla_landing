// Small WebAudio sound effects shared by the four arcade games. Starts on the first gesture.
const hz = (m) => 440 * 2 ** ((m - 69) / 12);

export function createSound() {
  let ctx = null, master = null, muted = false, noiseBuf = null;

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.7;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 5200;
    master.connect(lp).connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  const tone = (f, t, dur, gain, type = "sine", to) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02);
  };
  const noise = (t, dur, gain, freq) => {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = "bandpass"; f.frequency.value = freq;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + dur);
  };

  const sfx = {
    flap: () => tone(480, ctx.currentTime, 0.12, 0.1, "triangle", 760),
    score: () => { const t = ctx.currentTime; tone(hz(84), t, 0.08, 0.06, "square"); tone(hz(91), t + 0.06, 0.12, 0.05, "square"); },
    jump: () => tone(420, ctx.currentTime, 0.14, 0.1, "triangle", 820),
    land: () => { tone(150, ctx.currentTime, 0.07, 0.16, "square"); noise(ctx.currentTime, 0.05, 0.1, 900); },
    release: () => noise(ctx.currentTime, 0.1, 0.1, 2400),
    place: () => { tone(200, ctx.currentTime, 0.09, 0.2, "square", 110); noise(ctx.currentTime, 0.05, 0.12, 1200); },
    perfect: () => { const t = ctx.currentTime; [76, 80, 83, 88].forEach((m, i) => tone(hz(m), t + i * 0.06, 0.3, 0.07, "triangle")); },
    flip: () => { tone(300, ctx.currentTime, 0.16, 0.09, "sawtooth", 900); noise(ctx.currentTime, 0.14, 0.06, 3800); },
    milestone: () => { const t = ctx.currentTime; [72, 76, 79].forEach((m, i) => tone(hz(m + 12), t + i * 0.07, 0.25, 0.06, "triangle")); },
    shoot: () => tone(880, ctx.currentTime, 0.05, 0.025, "square", 1400),
    hitEnemy: () => tone(300, ctx.currentTime, 0.05, 0.06, "square", 200),
    kill: () => { const t = ctx.currentTime; tone(240, t, 0.18, 0.12, "sawtooth", 60); noise(t, 0.12, 0.1, 2200); },
    hurt: () => { const t = ctx.currentTime; tone(180, t, 0.4, 0.2, "sawtooth", 50); noise(t, 0.2, 0.15, 500); },
    power: () => { const t = ctx.currentTime; [72, 79, 84, 91].forEach((m, i) => tone(hz(m), t + i * 0.05, 0.16, 0.06, "square")); },
    life: () => { const t = ctx.currentTime; [79, 84, 88].forEach((m, i) => tone(hz(m), t + i * 0.08, 0.25, 0.07, "triangle")); },
    wave: () => { const t = ctx.currentTime; [67, 72, 76, 79].forEach((m, i) => tone(hz(m), t + i * 0.09, 0.22, 0.06, "triangle")); },
    bossDown: () => { const t = ctx.currentTime; tone(160, t, 0.9, 0.22, "sawtooth", 30); noise(t, 0.7, 0.2, 900); [60, 64, 67, 72].forEach((m, i) => tone(hz(m + 12), t + 0.5 + i * 0.1, 0.4, 0.07, "triangle")); },
    level: () => { const t = ctx.currentTime; [72, 76, 79, 84].forEach((m, i) => tone(hz(m + 12), t + i * 0.07, 0.3, 0.06, "triangle")); },
    hit: () => { const t = ctx.currentTime; tone(220, t, 0.32, 0.22, "sawtooth", 55); noise(t, 0.16, 0.16, 600); },
  };

  return {
    start() { if (ensure() && ctx.state === "suspended") ctx.resume().catch(() => {}); },
    play(name) { if (ctx && !muted && sfx[name]) sfx[name](); },
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.7; return muted; },
  };
}
