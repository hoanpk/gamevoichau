class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) {
      this.enabled = false;
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  _tone(freq, dur, type, vol, delay) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime + (delay || 0);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol || 0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  }

  _noise(dur, vol) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const sz = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, sz, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < sz; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 800;
    src.connect(filt);
    filt.connect(gain);
    gain.connect(this.ctx.destination);
    src.start();
    src.stop(t + dur);
  }

  diceRoll() {
    for (let i = 0; i < 8; i++)
      this._tone(200 + Math.random() * 600, 0.04, 'square', 0.08, i * 0.06);
  }

  move() { this._tone(400, 0.08, 'sine', 0.12); }

  wallBump() {
    this._noise(0.12, 0.15);
    this._tone(120, 0.15, 'square', 0.1);
  }

  itemPickup() {
    this._tone(523, 0.1, 'sine', 0.18);
    this._tone(659, 0.1, 'sine', 0.18, 0.1);
    this._tone(784, 0.15, 'sine', 0.18, 0.2);
  }

  trap() {
    this._tone(200, 0.25, 'sawtooth', 0.12);
    this._tone(140, 0.3, 'sawtooth', 0.12, 0.15);
  }

  gateEnter() {
    this._tone(392, 0.12, 'sine', 0.15);
    this._tone(523, 0.15, 'sine', 0.15, 0.12);
  }

  victory() {
    [523, 659, 784, 1047].forEach((f, i) => this._tone(f, 0.3, 'sine', 0.2, i * 0.18));
  }

  turnStart() { this._tone(660, 0.12, 'sine', 0.1); }
  click() { this._tone(800, 0.05, 'sine', 0.08); }
}
