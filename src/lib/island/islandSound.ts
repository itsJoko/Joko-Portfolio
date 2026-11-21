// The Studio island's soundscape (docs/studio.md, Ambience): off until the visitor turns it on. Everything is made
// in the browser with Web Audio (noise and oscillators), so there are no audio files to load or license:
// a soft wind, water lapping near the lake, the fire crackling near it once lit, birds by day and crickets at
// night, footsteps while walking and a freewheel tick while riding. The scene reports where Folio is each frame;
// the engine schedules its own sounds, so birds keep singing while the island is still.

export type Listener = {
  x: number; z: number; speed: number; riding: boolean; seated: boolean; night: boolean;
  fire: { x: number; z: number; lit: boolean } | null;
  lake: { x: number; z: number; r: number } | null;
};

const near = (d: number, full: number, none: number) => Math.max(0, Math.min(1, (none - d) / (none - full)));

export class IslandSound {
  private ctx: AudioContext;
  private master: GainNode;
  private noise: AudioBuffer;
  private white: AudioBuffer;
  private wind: GainNode;
  private windFilter: BiquadFilterNode;
  private water: GainNode;
  private fireBed: GainNode;
  private bikeBed: GainNode;
  private lastKnock = 0;
  private state: Listener = { x: 0, z: 0, speed: 0, riding: false, seated: false, night: false, fire: null, lake: null };
  private timer = 0;
  private nextBird = 0;
  private nextCricket = 0;
  private nextCrackle = 0;
  private nextStep = 0;
  private nextTick = 0;
  private stepSide = 1;
  private on = false;
  // Quiet while the tab is hidden; back on return only if the visitor had it on.
  private onHidden = () => {
    if (document.hidden) void this.ctx.suspend();
    else if (this.on) void this.ctx.resume();
  };

  constructor() {
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);
    // Two seconds of noise each, looped: soft pinkish noise (mostly low) for the wind, white noise (all
    // frequencies) for everything that needs some bite: water, the fire, steps, the bike, knocks.
    const len = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    this.white = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0), wd = this.white.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      wd[i] = w * 0.7;
      b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048;
      d[i] = (b0 + b1 + b2 + w * 0.02) * 0.9;
    }
    // Wind: low-passed noise, its filter slowly breathing; kept well under everything else.
    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = "lowpass";
    this.windFilter.frequency.value = 420;
    this.wind = this.ctx.createGain();
    this.wind.gain.value = 0.045;
    this.loop(this.windFilter, this.noise);
    this.windFilter.connect(this.wind).connect(this.master);
    // Beds whose level follows where Folio is: water near the lake (it laps), the fire's soft roar near it,
    // the bike's whirr with its speed.
    this.water = this.bed("bandpass", 650, 0.6);
    this.fireBed = this.bed("lowpass", 900, 0.7);
    this.bikeBed = this.bed("bandpass", 2600, 1.6);
    document.addEventListener("visibilitychange", this.onHidden);
  }

  private bed(type: BiquadFilterType, freq: number, q: number) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    this.loop(f, this.white);   // its own start offset, so the beds don't sound alike
    f.connect(g).connect(this.master);
    return g;
  }

  private loop(into: AudioNode, buffer: AudioBuffer) {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.loopStart = Math.random();
    src.connect(into);
    src.start();
  }

  /** A short burst of filtered noise (a crackle, a step, a tick). */
  private burst(freq: number, type: BiquadFilterType, gain: number, dur: number, pan = 0) {
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.white;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan;
    src.connect(f).connect(g).connect(p).connect(this.master);
    src.start(t, Math.random() * 1.5, dur + 0.02);
  }

  /** A little bird: two to four quick rising chirps. */
  private bird() {
    const t0 = this.ctx.currentTime, notes = 2 + Math.floor(Math.random() * 3), base = 2600 + Math.random() * 1400;
    const p = this.ctx.createStereoPanner();
    p.pan.value = Math.random() * 1.6 - 0.8;
    p.connect(this.master);
    for (let k = 0; k < notes; k++) {
      const t = t0 + k * (0.09 + Math.random() * 0.05);
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(base * (0.9 + Math.random() * 0.2), t);
      o.frequency.exponentialRampToValueAtTime(base * 1.45, t + 0.07);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      o.connect(g).connect(p);
      o.start(t);
      o.stop(t + 0.1);
    }
  }

  /** A cricket: a few fast pulses of a high tone. */
  private cricket() {
    const t0 = this.ctx.currentTime, f = 4300 + Math.random() * 500;
    const p = this.ctx.createStereoPanner();
    p.pan.value = Math.random() * 1.8 - 0.9;
    p.connect(this.master);
    for (let k = 0; k < 3 + Math.floor(Math.random() * 3); k++) {
      const t = t0 + k * 0.045;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.018, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      o.connect(g).connect(p);
      o.start(t);
      o.stop(t + 0.04);
    }
  }

  /** The scene tells the engine where Folio is and what's around, every frame it draws. */
  update(s: Listener) {
    this.state = s;
  }

  private tick = () => {
    const s = this.state, now = this.ctx.currentTime, t = performance.now() / 1000;
    // Wind breathes; water follows the lake's distance and laps.
    this.windFilter.frequency.setTargetAtTime(380 + Math.sin(t * 0.21) * 140 + Math.sin(t * 0.53) * 60, now, 0.5);
    const lake = s.lake ? near(Math.hypot(s.x - s.lake.x, s.z - s.lake.z) - s.lake.r, 0, 9) : 0;
    this.water.gain.setTargetAtTime(lake * (0.3 + 0.14 * Math.sin(t * 1.3)), now, 0.3);
    // The fire, when lit: a soft roar and crackles, louder the closer Folio is (silent past 12 m).
    const fire = s.fire?.lit ? near(Math.hypot(s.x - s.fire.x, s.z - s.fire.z), 1.5, 12) : 0;
    this.fireBed.gain.setTargetAtTime(fire * fire * 0.22, now, 0.3);
    if (fire > 0 && t > this.nextCrackle) {
      this.burst(1500 + Math.random() * 2500, "highpass", 0.45 * fire * fire, 0.02 + Math.random() * 0.05, Math.random() - 0.5);
      this.nextCrackle = t + 0.04 + Math.random() * 0.22;
    }
    // The bike's whirr, with its speed.
    this.bikeBed.gain.setTargetAtTime(s.riding ? Math.min(1, s.speed / 6) * 0.05 : 0, now, 0.15);
    // Birds by day, crickets at night, now and then.
    if (!s.night && t > this.nextBird) {
      this.bird();
      this.nextBird = t + 1.6 + Math.random() * 4;
    }
    if (s.night && t > this.nextCricket) {
      this.cricket();
      this.nextCricket = t + 0.4 + Math.random() * 1.2;
    }
    // Footsteps walking; a soft freewheel tick riding.
    if (!s.seated && !s.riding && s.speed > 0.8 && t > this.nextStep) {
      this.stepSide = -this.stepSide;
      this.burst(1000, "lowpass", 0.28, 0.06, this.stepSide * 0.15);
      this.nextStep = t + 0.34 * (3.4 / Math.max(s.speed, 1));
    }
    if (s.riding && s.speed > 1 && t > this.nextTick) {
      this.burst(5200, "highpass", 0.06, 0.012);
      this.nextTick = t + 0.07;
    }
  };

  /** The bike bell: ding-ding. */
  bell() {
    if (!this.on) return;
    for (const at of [0, 0.16]) {
      const t = this.ctx.currentTime + at;
      for (const [f, v] of [[2100, 0.12], [5250, 0.05], [3480, 0.04]] as const) {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(v, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
        o.connect(g).connect(this.master);
        o.start(t);
        o.stop(t + 0.75);
      }
    }
  }

  /** A crate or barrel knocking on the ground or another (strength 0 to 1, x/z where), quieter far from Folio. */
  knock(strength: number, x: number, z: number) {
    const now = this.ctx.currentTime;
    if (!this.on || now - this.lastKnock < 0.06) return;
    const v = strength * near(Math.hypot(x - this.state.x, z - this.state.z), 2, 16);
    if (v < 0.03) return;
    this.lastKnock = now;
    const pan = Math.max(-0.8, Math.min(0.8, (x - this.state.x) / 8));
    this.burst(380 + Math.random() * 200, "lowpass", 0.7 * v, 0.09, pan);     // the thud
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(), p = this.ctx.createStereoPanner();
    o.frequency.setValueAtTime(190 + Math.random() * 60, now);                     // and a hollow wooden knock
    o.frequency.exponentialRampToValueAtTime(110, now + 0.08);
    g.gain.setValueAtTime(0.25 * v, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    p.pan.value = pan;
    o.connect(g).connect(p).connect(this.master);
    o.start(now);
    o.stop(now + 0.14);
  }

  /** Turn on (after a click: browsers only allow sound after one). */
  async start() {
    this.on = true;
    await this.ctx.resume();
    this.master.gain.setTargetAtTime(0.6, this.ctx.currentTime, 0.4);
    window.clearInterval(this.timer);
    this.timer = window.setInterval(this.tick, 50);
  }

  /** Turn off: fade out, then stop everything. */
  stop() {
    this.on = false;
    window.clearInterval(this.timer);
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
    window.setTimeout(() => !this.on && this.ctx.state === "running" && this.ctx.suspend(), 600);
  }

  dispose() {
    window.clearInterval(this.timer);
    document.removeEventListener("visibilitychange", this.onHidden);
    void this.ctx.close();
  }
}
