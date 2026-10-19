/* ============================================================
 * 音效模块 - 仅 WebAudio 游戏音效
 * ============================================================ */
(function (root) {
  'use strict';
  const GardenGame = root.GardenGame || (root.GardenGame = {});

  class GameAudio {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.muted = false;
    }
    /* 首次用户手势时调用 */
    ensure() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      const AC = (typeof AudioContext !== 'undefined') ? AudioContext
        : (typeof webkitAudioContext !== 'undefined' ? webkitAudioContext : null);
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.4;
        this.master.connect(this.ctx.destination);
      } catch (e) { this.ctx = null; }
    }
    tone(freq, dur, opt) {
      if (!this.ctx || this.muted) return;
      opt = opt || {};
      const t0 = this.ctx.currentTime + (opt.delay || 0);
      try {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = opt.type || 'square';
        o.frequency.setValueAtTime(freq, t0);
        if (opt.slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, opt.slide), t0 + dur);
        const vol = (opt.vol == null) ? 0.2 : opt.vol;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g); g.connect(this.master);
        o.start(t0); o.stop(t0 + dur + 0.05);
      } catch (e) { /* 忽略音频错误 */ }
    }
    noise(dur, opt) {
      if (!this.ctx || this.muted) return;
      opt = opt || {};
      const t0 = this.ctx.currentTime + (opt.delay || 0);
      try {
        const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource(); src.buffer = buf;
        const f = this.ctx.createBiquadFilter();
        f.type = opt.type || 'lowpass';
        f.frequency.setValueAtTime(opt.freq || 1000, t0);
        if (opt.sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, opt.sweep), t0 + dur);
        const g = this.ctx.createGain();
        const vol = (opt.vol == null) ? 0.25 : opt.vol;
        g.gain.setValueAtTime(vol, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        src.connect(f); f.connect(g); g.connect(this.master);
        src.start(t0); src.stop(t0 + dur);
      } catch (e) { /* 忽略音频错误 */ }
    }
    play(name) {
      if (!this.ctx || this.muted) return;
      switch (name) {
        case 'shoot':   this.tone(620, 0.07, { type: 'square', vol: 0.08, slide: 380 }); break;
        case 'hit':     this.noise(0.05, { freq: 1800, vol: 0.12 }); break;
        case 'freeze':  this.tone(920, 0.14, { type: 'sine', vol: 0.12, slide: 1500 }); break;
        case 'plant':   this.tone(200, 0.09, { type: 'sine', vol: 0.25, slide: 90 }); this.noise(0.08, { freq: 500, vol: 0.15 }); break;
        case 'select':  this.tone(720, 0.05, { type: 'triangle', vol: 0.12 }); break;
        case 'error':   this.tone(150, 0.12, { type: 'square', vol: 0.15 }); break;
        case 'shovel':  this.noise(0.14, { type: 'bandpass', freq: 2600, vol: 0.18 }); break;
        case 'sun':     this.tone(880, 0.09, { type: 'sine', vol: 0.18 }); this.tone(1320, 0.12, { type: 'sine', vol: 0.18, delay: 0.07 }); break;
        case 'sunpop':  this.tone(500, 0.06, { type: 'sine', vol: 0.08, slide: 700 }); break;
        case 'paper-rip': this.noise(.25,{freq:2400,vol:.18}); this.noise(.12,{freq:3800,vol:.12,delay:.12}); break;
        case 'land': this.noise(.14,{freq:430,vol:.18});this.tone(100,.1,{type:'sine',vol:.12});break;
        case 'chomp':   this.noise(0.06, { freq: 700, vol: 0.14 }); break;
        case 'gulp':    this.tone(300, 0.12, { type: 'sine', vol: 0.2, slide: 80 }); break;
        case 'explode': this.noise(0.5, { freq: 2400, sweep: 90, vol: 0.5 }); this.tone(140, 0.4, { type: 'sawtooth', vol: 0.3, slide: 40 }); break;
        case 'mower':   this.tone(90, 0.5, { type: 'sawtooth', vol: 0.22, slide: 150 }); this.noise(0.4, { freq: 400, vol: 0.12 }); break;
        case 'groan':   this.tone(105, 0.4, { type: 'sawtooth', vol: 0.07, slide: 82 }); break;
        case 'huge':    this.tone(220, 0.5, { type: 'sawtooth', vol: 0.25, slide: 90 }); this.tone(110, 0.6, { type: 'square', vol: 0.15, delay: 0.25 }); break;
        case 'arm':     this.tone(440, 0.1, { type: 'triangle', vol: 0.12, slide: 660 }); break;
        case 'start':   this.tone(520, 0.1, { type: 'triangle', vol: 0.2 }); this.tone(660, 0.1, { type: 'triangle', vol: 0.2, delay: 0.1 }); this.tone(880, 0.16, { type: 'triangle', vol: 0.2, delay: 0.2 }); break;
        case 'win':     [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, { type: 'triangle', vol: 0.22, delay: i * 0.13 })); break;
        case 'lose':    [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.28, { type: 'sawtooth', vol: 0.18, delay: i * 0.18 })); break;
        case 'click':   this.tone(800, 0.04, { type: 'triangle', vol: 0.1 }); break;
      }
    }
    toggleMute() { this.muted = !this.muted; return this.muted; }
  }

  GardenGame.Audio = GameAudio;
  if (typeof module !== 'undefined' && module.exports) module.exports = GardenGame;
})(typeof window !== 'undefined' ? window : globalThis);
