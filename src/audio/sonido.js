// Sonido 100% generado con Web Audio API (sin archivos, libre de derechos):
// silbato, patadas, palo, red, murmullo del público, ovaciones, "uuuh", abucheos y cánticos.
import { ajustes } from '../core/ajustes.js';

export class Sonido {
  constructor() {
    this.ctx = null;
    this.emocion = 0.2;
    this.emocionObj = 0.2;
    this.cantico = null;
  }

  // Los navegadores exigen una interacción del usuario antes de reproducir audio.
  activar() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;
    this.maestro = c.createGain();
    this.maestro.gain.value = ajustes.volumen;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.maestro.connect(comp).connect(c.destination);
    this.busPublico = c.createGain();
    this.busPublico.gain.value = ajustes.volumenPublico;
    this.busPublico.connect(this.maestro);
    // Ruido blanco/rosa reutilizable
    const largo = c.sampleRate * 3;
    this.ruido = c.createBuffer(2, largo, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = this.ruido.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < largo; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048;
        d[i] = (b0 + b1 + b2 + w * 0.02) * 0.9;
      }
    }
    this.crearAmbiente();
  }

  fijarVolumen() {
    if (!this.ctx) return;
    this.maestro.gain.value = ajustes.volumen;
    this.busPublico.gain.value = ajustes.volumenPublico;
  }

  fuenteRuido(destino, { tipo = 'bandpass', frec = 800, q = 0.7 } = {}) {
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.ruido; s.loop = true;
    s.loopStart = Math.random(); s.loopEnd = 2.9;
    const f = c.createBiquadFilter();
    f.type = tipo; f.frequency.value = frec; f.Q.value = q;
    s.connect(f).connect(destino);
    s.start(0, Math.random() * 2);
    return { s, f };
  }

  // Murmullo constante del estadio (varias capas de ruido filtrado + vocales sintetizadas)
  crearAmbiente() {
    const c = this.ctx;
    this.gAmb = c.createGain(); this.gAmb.gain.value = 0.25; this.gAmb.connect(this.busPublico);
    this.fuenteRuido(this.gAmb, { frec: 500, q: 0.5 });
    this.fuenteRuido(this.gAmb, { frec: 1200, q: 0.8 });
    this.gRugido = c.createGain(); this.gRugido.gain.value = 0; this.gRugido.connect(this.busPublico);
    this.rugido = this.fuenteRuido(this.gRugido, { frec: 700, q: 0.4 });
    this.fuenteRuido(this.gRugido, { frec: 1800, q: 0.6 });
    // "Voces": osciladores con formantes para que suene a gente y no solo a viento
    this.gVoces = c.createGain(); this.gVoces.gain.value = 0.0; this.gVoces.connect(this.busPublico);
    for (let i = 0; i < 6; i++) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 140 + Math.random() * 120;
      const lfo = c.createOscillator(); lfo.frequency.value = 0.2 + Math.random() * 0.5;
      const lg = c.createGain(); lg.gain.value = 8 + Math.random() * 10;
      lfo.connect(lg).connect(o.frequency); lfo.start();
      const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 700 + Math.random() * 300; f1.Q.value = 4;
      const g = c.createGain(); g.gain.value = 0.025;
      o.connect(f1).connect(g).connect(this.gVoces);
      o.start();
    }
  }

  fijarEmocion(v) { this.emocionObj = Math.max(0, Math.min(1, v)); }

  actualizar(dt) {
    if (!this.ctx) return;
    this.emocion += (this.emocionObj - this.emocion) * Math.min(1, dt * 1.5);
    this.emocionObj += (0.2 - this.emocionObj) * Math.min(1, dt * 0.15);
    const t = this.ctx.currentTime;
    this.gAmb.gain.setTargetAtTime(0.18 + this.emocion * 0.15, t, 0.3);
    this.gRugido.gain.setTargetAtTime(Math.max(0, this.emocion - 0.35) * 0.9, t, 0.25);
    this.gVoces.gain.setTargetAtTime(0.25 + this.emocion * 0.9, t, 0.4);
    this.rugido.f.frequency.setTargetAtTime(600 + this.emocion * 700, t, 0.3);
  }

  env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  silbato(tipo = 'corto') {
    if (!this.ctx) return;
    const c = this.ctx, t0 = c.currentTime;
    const pitazos = tipo === 'largo' ? [[0, 0.9]] : tipo === 'triple' ? [[0, 0.35], [0.5, 0.35], [1.0, 1.1]] : tipo === 'doble' ? [[0, 0.25], [0.35, 0.5]] : [[0, 0.3]];
    for (const [ini, dur] of pitazos) {
      const t = t0 + ini;
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = 2900;
      const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = 3050;
      const trem = c.createOscillator(); trem.frequency.value = 38;
      const tg = c.createGain(); tg.gain.value = 0.35;
      const g = c.createGain();
      trem.connect(tg).connect(g.gain);
      o.connect(g); o2.connect(g);
      g.connect(this.maestro);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.02);
      g.gain.setValueAtTime(0.18, t + dur - 0.05);
      g.gain.linearRampToValueAtTime(0, t + dur);
      for (const x of [o, o2, trem]) { x.start(t); x.stop(t + dur + 0.05); }
    }
  }

  patada(fuerza = 0.5) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(140 + fuerza * 60, t);
    o.frequency.exponentialRampToValueAtTime(50, t + 0.12);
    const g = c.createGain(); this.env(g, t, 0.003, 0.25 + fuerza * 0.5, 0.14);
    o.connect(g).connect(this.maestro); o.start(t); o.stop(t + 0.2);
    const n = c.createBufferSource(); n.buffer = this.ruido;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 1.2;
    const gn = c.createGain(); this.env(gn, t, 0.002, 0.15 + fuerza * 0.35, 0.05);
    n.connect(f).connect(gn).connect(this.maestro); n.start(t, Math.random()); n.stop(t + 0.1);
  }

  palo() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    for (const [fr, a] of [[520, 0.3], [1310, 0.18], [2210, 0.1]]) {
      const o = c.createOscillator(); o.frequency.value = fr;
      const g = c.createGain(); this.env(g, t, 0.002, a, 0.9);
      o.connect(g).connect(this.maestro); o.start(t); o.stop(t + 1);
    }
    this.patada(0.8);
  }

  red() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const n = c.createBufferSource(); n.buffer = this.ruido;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500;
    const g = c.createGain(); this.env(g, t, 0.01, 0.35, 0.35);
    n.connect(f).connect(g).connect(this.maestro); n.start(t, Math.random()); n.stop(t + 0.5);
  }

  // Reacciones del público
  rugir(tipo) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const conf = {
      gol: { dur: 6, pico: 1.0, frec: 900, emo: 1 },
      ocasion: { dur: 1.6, pico: 0.45, frec: 800, emo: 0.75 },
      uy: { dur: 1.8, pico: 0.5, frec: 450, emo: 0.6 },
      abucheo: { dur: 2.5, pico: 0.45, frec: 260, emo: 0.5 },
      aplauso: { dur: 2.2, pico: 0.3, frec: 2500, emo: 0.45 },
    }[tipo];
    if (!conf) return;
    this.fijarEmocion(conf.emo);
    const n = c.createBufferSource(); n.buffer = this.ruido; n.loop = true;
    const f = c.createBiquadFilter(); f.type = tipo === 'aplauso' ? 'highpass' : 'bandpass'; f.frequency.value = conf.frec; f.Q.value = 0.6;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(conf.pico, t + (tipo === 'gol' ? 0.15 : 0.3));
    g.gain.setValueAtTime(conf.pico, t + conf.dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + conf.dur);
    n.connect(f).connect(g).connect(this.busPublico);
    n.start(t, Math.random()); n.stop(t + conf.dur + 0.1);
    if (tipo === 'uy' || tipo === 'abucheo' || tipo === 'gol') {
      // vocal "uuuh"/"buuu"/"ehhh" con formantes
      const o = c.createOscillator(); o.type = 'sawtooth';
      const base = tipo === 'gol' ? 220 : tipo === 'uy' ? 180 : 120;
      o.frequency.setValueAtTime(base, t);
      o.frequency.linearRampToValueAtTime(tipo === 'uy' ? base * 0.75 : base * 1.05, t + conf.dur);
      const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = tipo === 'gol' ? 750 : 350; f1.Q.value = 5;
      const g2 = c.createGain();
      g2.gain.setValueAtTime(0.0001, t);
      g2.gain.exponentialRampToValueAtTime(0.18, t + 0.3);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + conf.dur);
      // coro: varias voces desafinadas
      for (let i = 0; i < 4; i++) {
        const oo = c.createOscillator(); oo.type = 'sawtooth';
        oo.frequency.setValueAtTime(base * (1 + (Math.random() - 0.5) * 0.08), t);
        oo.frequency.linearRampToValueAtTime(tipo === 'uy' ? base * 0.72 : base * 1.07, t + conf.dur);
        oo.connect(f1); oo.start(t); oo.stop(t + conf.dur);
      }
      o.connect(f1).connect(g2).connect(this.busPublico);
      o.start(t); o.stop(t + conf.dur);
    }
  }

  // Cántico genérico: palmas rítmicas + "oh-oh-oh" sintetizado. Se repite varios compases.
  cantar(compases = 4) {
    if (!this.ctx || this.cantando) return;
    this.cantando = true;
    const c = this.ctx, t0 = c.currentTime + 0.1;
    const bpm = 120, negra = 60 / bpm;
    const patron = [1, 0, 1, 0, 1, 1, 1, 0]; // palmas en corcheas
    const notas = [0, 0, 3, 5, 3, 0, -2, 0];
    for (let comp = 0; comp < compases; comp++) {
      for (let i = 0; i < 8; i++) {
        const t = t0 + (comp * 8 + i) * negra / 2;
        if (patron[i]) {
          const n = c.createBufferSource(); n.buffer = this.ruido;
          const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 1;
          const g = c.createGain(); this.env(g, t, 0.002, 0.25, 0.07);
          n.connect(f).connect(g).connect(this.busPublico); n.start(t, Math.random() * 2); n.stop(t + 0.1);
        }
        if (i % 2 === 0) {
          const fr = 196 * Math.pow(2, notas[i] / 12);
          const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 650; f1.Q.value = 3;
          const g = c.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.07, t + 0.05);
          g.gain.exponentialRampToValueAtTime(0.0001, t + negra * 0.95);
          f1.connect(g).connect(this.busPublico);
          for (let v = 0; v < 5; v++) {
            const o = c.createOscillator(); o.type = 'sawtooth';
            o.frequency.value = fr * (1 + (Math.random() - 0.5) * 0.03) * (v === 4 ? 2 : 1);
            o.connect(f1); o.start(t); o.stop(t + negra);
          }
        }
      }
    }
    setTimeout(() => { this.cantando = false; }, compases * 4 * negra * 1000 + 500);
  }

  // Sonido de interfaz
  clic(tono = 1) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = 660 * tono;
    const g = c.createGain(); this.env(g, t, 0.003, 0.08, 0.06);
    o.connect(g).connect(this.maestro); o.start(t); o.stop(t + 0.1);
  }
}

export const sonido = new Sonido();
