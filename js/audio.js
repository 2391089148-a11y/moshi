/* =========================================================
 * 末世孤城 · 半感染者 —— 程序化音效与氛围音乐（WebAudio，无音频文件）
 * 低沉的无人机音 + 风声 + 雨声 + 稀疏的钢琴音，营造孤独感。
 * ========================================================= */
(function () {
  'use strict';
  const LG = window.LG = window.LG || {};

  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.sfxGain = null;
      this.musicGain = null;
      this.started = false;
      this.rainNode = null;
      this.windGain = null;
      this.droneNodes = [];
      this.weather = 'clear';
      this.nextPiano = 0;
      this.nextGroan = 0;
      this.nextWindPuff = 0;
      this.pianoNotes = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25]; // 五声音阶，克制而孤寂
    }

    /* 必须在用户手势后调用 */
    init() {
      if (this.started) { this.ctx.resume && this.ctx.resume(); return; }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.9;
        this.master.connect(this.ctx.destination);
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 0.8;
        this.sfxGain.connect(this.master);
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = 0.32;
        this.musicGain.connect(this.master);
        this.started = true;
        this.startAmbient();
      } catch (e) { /* 静默失败，无音频也能玩 */ }
    }

    setEnabled(kind, on) {
      if (!this.ctx) return;
      const g = kind === 'music' ? this.musicGain : this.sfxGain;
      g.gain.setTargetAtTime(on ? (kind === 'music' ? 0.32 : 0.8) : 0, this.ctx.currentTime, 0.15);
    }

    /* ---------- 氛围层 ---------- */
    startAmbient() {
      const ctx = this.ctx;
      const t = ctx.currentTime;
      // 低频无人机（两根差频，产生缓慢拍频的"不安感"）
      const freqs = [52, 55.5];
      this.droneNodes = freqs.map(f => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = f;
        const g = ctx.createGain();
        g.gain.value = 0.035;
        // 缓慢呼吸
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.06 + Math.random() * 0.03;
        const lfoG = ctx.createGain(); lfoG.gain.value = 0.02;
        lfo.connect(lfoG); lfoG.connect(g.gain);
        osc.connect(g); g.connect(this.musicGain);
        osc.start(); lfo.start();
        return { osc, g, lfo, lfoG };
      });
      // 风：滤波噪声
      const windBuf = this.noiseBuffer();
      const windSrc = ctx.createBufferSource();
      windSrc.buffer = windBuf; windSrc.loop = true;
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass'; windFilter.frequency.value = 320; windFilter.Q.value = 0.6;
      this.windGain = ctx.createGain();
      this.windGain.gain.value = 0.05;
      windSrc.connect(windFilter); windFilter.connect(this.windGain); this.windGain.connect(this.musicGain);
      windSrc.start();
      // 雨：另一层噪声
      const rainBuf = this.noiseBuffer();
      const rainSrc = ctx.createBufferSource();
      rainSrc.buffer = rainBuf; rainSrc.loop = true;
      const rainFilter = ctx.createBiquadFilter();
      rainFilter.type = 'lowpass'; rainFilter.frequency.value = 1200;
      this.rainNode = ctx.createGain();
      this.rainNode.gain.value = 0;
      rainSrc.connect(rainFilter); rainFilter.connect(this.rainNode); this.rainNode.connect(this.musicGain);
      rainSrc.start();
    }

    setWeather(w) {
      this.weather = w || 'clear';
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const rain = w === 'rain' ? 0.07 : 0;
      const wind = (LG.CFG.WEATHER.find(x => x.id === w) || { wind: 1 }).wind;
      this.rainNode && this.rainNode.gain.setTargetAtTime(rain, t, 0.8);
      this.windGain && this.windGain.gain.setTargetAtTime(0.035 + wind * 0.03, t, 0.8);
    }

    noiseBuffer(sec) {
      sec = sec || 2;
      const len = Math.floor(this.ctx.sampleRate * sec);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      return buf;
    }

    /* 每一帧调用：随机氛围事件（钢琴音、远处的丧尸低吼、风扑） */
    updateAmbient(dt) {
      if (!this.ctx || !this.started) return;
      const t = this.ctx.currentTime;
      if (t > this.nextPiano && LG.State.s && LG.State.s.settings && LG.State.s.settings.music !== false) {
        this.nextPiano = t + 6 + Math.random() * 14;
        this.pianoNote();
      }
      if (t > this.nextGroan && LG.State.s && LG.State.s.settings && LG.State.s.settings.music !== false) {
        this.nextGroan = t + 25 + Math.random() * 30;
        this.distantGroan();
      }
      if (t > this.nextWindPuff) {
        this.nextWindPuff = t + 8 + Math.random() * 14;
        this.windPuff();
      }
    }

    /* 稀疏的钢琴音符——像风从很远的地方带来的一小节旋律 */
    pianoNote() {
      const ctx = this.ctx;
      const f = this.pianoNotes[Math.floor(Math.random() * this.pianoNotes.length)];
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'triangle'; osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8 + Math.random() * 2);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 1600;
      osc.connect(filter); filter.connect(g); g.connect(this.musicGain);
      osc.start(t); osc.stop(t + 5);
    }

    /* 远处丧尸的低吼：滤波锯齿，很轻 */
    distantGroan() {
      const ctx = this.ctx;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth'; osc.frequency.setValueAtTime(80, t);
      osc.frequency.linearRampToValueAtTime(55, t + 1.4);
      osc.frequency.linearRampToValueAtTime(90, t + 2.6);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.012, t + 0.5);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 300;
      osc.connect(filter); filter.connect(g); g.connect(this.musicGain);
      osc.start(t); osc.stop(t + 3.4);
    }

    /* 一阵风扑过 */
    windPuff() {
      const ctx = this.ctx;
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer(1.5);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(500, t);
      filter.frequency.linearRampToValueAtTime(900, t + 0.8);
      filter.frequency.linearRampToValueAtTime(300, t + 1.5);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.03, t + 0.5);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
      src.connect(filter); filter.connect(g); g.connect(this.musicGain);
      src.start(t); src.stop(t + 1.6);
    }

    /* ---------- 音效 ---------- */
    sfx(kind) {
      if (!this.ctx || !this.started) return;
      if (LG.State.s && LG.State.s.settings && LG.State.s.settings.sound === false) return;
      const ctx = this.ctx;
      const t = ctx.currentTime;
      const out = this.sfxGain;
      const env = (peak, dur) => {
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(peak, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        return g;
      };
      const noise = (dur) => {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer(dur + 0.1);
        return src;
      };
      switch (kind) {
        case 'swing': {
          const src = noise(0.18);
          const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 1.2;
          const g = env(0.14, 0.18);
          src.connect(f); f.connect(g); g.connect(out); src.start(t); src.stop(t + 0.2);
          break;
        }
        case 'hit': {
          const osc = ctx.createOscillator(); osc.type = 'square'; osc.frequency.setValueAtTime(160, t); osc.frequency.exponentialRampToValueAtTime(60, t + 0.12);
          const g = env(0.2, 0.14);
          osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + 0.15);
          break;
        }
        case 'zombieHit': {
          const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(90, t); osc.frequency.exponentialRampToValueAtTime(40, t + 0.2);
          const g = env(0.16, 0.2);
          osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + 0.22);
          break;
        }
        case 'bite': {
          const src = noise(0.25);
          const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
          const g = env(0.22, 0.25);
          src.connect(f); f.connect(g); g.connect(out); src.start(t); src.stop(t + 0.27);
          break;
        }
        case 'pickup': {
          const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.setValueAtTime(520, t); osc.frequency.exponentialRampToValueAtTime(880, t + 0.1);
          const g = env(0.1, 0.16);
          osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + 0.18);
          break;
        }
        case 'plant': {
          const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.setValueAtTime(220, t); osc.frequency.exponentialRampToValueAtTime(140, t + 0.12);
          const g = env(0.12, 0.16);
          osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + 0.18);
          break;
        }
        case 'harvest': {
          [523, 659, 784].forEach((f, i) => {
            const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = f;
            const g = env(0.09, 0.3);
            g.gain.setValueAtTime(0, t + i * 0.06);
            g.gain.linearRampToValueAtTime(0.09, t + i * 0.06 + 0.01);
            g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.06 + 0.3);
            osc.connect(g); g.connect(out); osc.start(t + i * 0.06); osc.stop(t + i * 0.06 + 0.35);
          });
          break;
        }
        case 'synth': {
          const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(60, t);
          osc.frequency.exponentialRampToValueAtTime(240, t + 1.1);
          const g = env(0.14, 1.2);
          const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2400, t + 1.1);
          osc.connect(f); f.connect(g); g.connect(out); osc.start(t); osc.stop(t + 1.25);
          break;
        }
        case 'heal': {
          const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.setValueAtTime(440, t); osc.frequency.exponentialRampToValueAtTime(660, t + 0.5);
          const g = env(0.1, 0.6);
          osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + 0.65);
          break;
        }
        case 'ui': {
          const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 700;
          const g = env(0.06, 0.08);
          osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + 0.1);
          break;
        }
        case 'radio': {
          const src = noise(0.4);
          const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2000; f.Q.value = 0.5;
          const g = env(0.12, 0.4);
          src.connect(f); f.connect(g); g.connect(out); src.start(t); src.stop(t + 0.45);
          break;
        }
        case 'roar': {
          const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(120, t); osc.frequency.exponentialRampToValueAtTime(45, t + 0.9);
          const g = env(0.22, 1.0);
          const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
          osc.connect(f); f.connect(g); g.connect(out); osc.start(t); osc.stop(t + 1.05);
          break;
        }
        case 'dead': {
          const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.setValueAtTime(300, t); osc.frequency.exponentialRampToValueAtTime(60, t + 1.4);
          const g = env(0.18, 1.5);
          osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + 1.6);
          break;
        }
        case 'dash': {
          const src = noise(0.25);
          const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 400;
          const g = env(0.1, 0.25);
          src.connect(f); f.connect(g); g.connect(out); src.start(t); src.stop(t + 0.3);
          break;
        }
      }
    }
  }

  LG.Audio = new AudioEngine();
})();
