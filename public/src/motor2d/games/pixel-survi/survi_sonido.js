// ══════════════════════════════════════════════════════════════
//   Pixel Survi — survi_sonido.js
//
//   Clase SonidoSurvi: TODOS los sonidos del juego generados por código con
//   Web Audio (osciladores + ruido filtrado). No hay archivos de audio: no se
//   descarga nada y pesan 0 KB.
//
//   Respeta el volumen de efectos y el mute del motor (Engine2D.Audio, los
//   sliders de Ajustes). El AudioContext se crea recién con el primer sonido
//   (después de un toque/clic: los navegadores no dejan antes).
//
//   Uso:  sonido.play('romper', { material: 'piedra', dist: 0.3, pan: -0.2 })
//         sonido.lluvia(intensidad, bajoTecho)   ← sonido continuo
//
//   Cada sonido es un método de SonidoSurvi.RECETAS: arma sus notas con
//   tono() y ruido(). Para cambiar cómo suena algo, se toca solo su receta.
// ══════════════════════════════════════════════════════════════

export class SonidoSurvi {
  static MAX_VOCES = 14; // sonidos sonando a la vez (más, se ignoran)
  static DIST_MAX = 1; // dist (0..1) a partir de la cual no se oye

  // Separación mínima entre dos del mismo (ms): que picar o juntar muchos
  // ítems de golpe no sature.
  static GAP_MS = { recoger: 60, picar: 90, pegar: 60, dano: 120, gota: 40, murcielago: 150, arana: 200 };

  #ctx = null;
  #master = null;
  #ruido = null; // buffer de ruido blanco (1 s), se reusa
  #voces = 0;
  #ultimo = {};
  #lluvia = null; // { fuente, filtro, gain }

  // ── Volumen (sale de Ajustes) ──
  get volumen() {
    const A = typeof Engine2D !== 'undefined' ? Engine2D.Audio : null;
    if (!A) return 0.5;
    if (A.isMuted && A.isMuted()) return 0;
    const g = A.getVolume ? A.getVolume() : 1;
    const s = A.getSfxVolume ? A.getSfxVolume() : 0.7;
    return g * s;
  }

  #contexto() {
    if (!this.#ctx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return null;
      try {
        this.#ctx = new AC();
      } catch {
        return null;
      }
      this.#master = this.#ctx.createGain();
      this.#master.connect(this.#ctx.destination);
      const n = this.#ctx.sampleRate;
      this.#ruido = this.#ctx.createBuffer(1, n, n);
      const d = this.#ruido.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.#ctx.state === 'suspended') this.#ctx.resume().catch(() => {});
    this.#master.gain.value = this.volumen * 0.6;
    return this.#ctx;
  }

  // ── Piezas ──
  // Un tono con barrido de frecuencia (f0 → f1) y envolvente corta.
  #tono(salida, t0, { tipo = 'square', f0 = 440, f1 = f0, dur = 0.1, vol = 0.3, ataque = 0.004, vibrato = 0 }) {
    const ctx = this.#ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    if (vibrato) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = vibrato;
      lg.gain.value = f0 * 0.06;
      lfo.connect(lg).connect(o.frequency);
      lfo.start(t0);
      lfo.stop(t0 + dur + 0.05);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(salida);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
    return o;
  }

  // Ruido filtrado (golpes, pasos, agua, siseos).
  #ruidoF(salida, t0, { dur = 0.1, vol = 0.3, filtro = 'lowpass', f0 = 1000, f1 = f0, q = 1, ataque = 0.003 }) {
    const ctx = this.#ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.#ruido;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const bq = ctx.createBiquadFilter();
    bq.type = filtro;
    bq.Q.value = q;
    bq.frequency.setValueAtTime(f0, t0);
    bq.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bq).connect(g).connect(salida);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.02);
    return src;
  }

  // ── Recetas ── (this = el SonidoSurvi; s = salida; t = tiempo de inicio)
  // material: 'tierra' | 'piedra' | 'madera' | 'hojas' | 'arena' | 'vidrio'
  static MATERIAL = {
    tierra: { f: 500, q: 0.8, vol: 0.5 },
    arena: { f: 900, q: 0.6, vol: 0.4 },
    piedra: { f: 1600, q: 2.5, vol: 0.45 },
    madera: { f: 700, q: 3, vol: 0.5, tono: 180 },
    hojas: { f: 3200, q: 0.7, vol: 0.25 },
    vidrio: { f: 4200, q: 6, vol: 0.3, tono: 1800 },
  };

  static RECETAS = {
    picar(s, t, { material = 'tierra' }) {
      const m = SonidoSurvi.MATERIAL[material] || SonidoSurvi.MATERIAL.tierra;
      this.#ruidoF(s, t, { dur: 0.06, vol: m.vol * 0.6, filtro: 'bandpass', f0: m.f, q: m.q });
      if (m.tono) this.#tono(s, t, { tipo: 'triangle', f0: m.tono, f1: m.tono * 0.8, dur: 0.05, vol: 0.12 });
    },
    romper(s, t, { material = 'tierra' }) {
      const m = SonidoSurvi.MATERIAL[material] || SonidoSurvi.MATERIAL.tierra;
      this.#ruidoF(s, t, { dur: 0.16, vol: m.vol, filtro: 'bandpass', f0: m.f * 1.2, f1: m.f * 0.6, q: m.q });
      this.#ruidoF(s, t + 0.04, { dur: 0.1, vol: m.vol * 0.5, filtro: 'lowpass', f0: m.f * 0.8 });
      if (m.tono) this.#tono(s, t, { tipo: 'triangle', f0: m.tono * 1.2, f1: m.tono * 0.6, dur: 0.12, vol: 0.15 });
    },
    colocar(s, t, { material = 'tierra' }) {
      const m = SonidoSurvi.MATERIAL[material] || SonidoSurvi.MATERIAL.tierra;
      this.#tono(s, t, { tipo: 'sine', f0: 160, f1: 90, dur: 0.08, vol: 0.35 });
      this.#ruidoF(s, t, { dur: 0.07, vol: m.vol * 0.5, filtro: 'lowpass', f0: m.f });
    },
    pegar(s, t) {
      this.#ruidoF(s, t, { dur: 0.07, vol: 0.45, filtro: 'lowpass', f0: 1400, f1: 300 });
      this.#tono(s, t, { tipo: 'square', f0: 260, f1: 110, dur: 0.07, vol: 0.12 });
    },
    dano(s, t) {
      this.#tono(s, t, { tipo: 'square', f0: 330, f1: 140, dur: 0.16, vol: 0.2 });
      this.#ruidoF(s, t, { dur: 0.1, vol: 0.3, filtro: 'lowpass', f0: 900 });
    },
    morir(s, t) {
      this.#tono(s, t, { tipo: 'square', f0: 420, f1: 60, dur: 0.9, vol: 0.22 });
      this.#tono(s, t + 0.05, { tipo: 'triangle', f0: 300, f1: 45, dur: 0.9, vol: 0.18 });
    },
    comer(s, t) {
      for (let i = 0; i < 3; i++) this.#ruidoF(s, t + i * 0.12, { dur: 0.07, vol: 0.35, filtro: 'bandpass', f0: 1100 + Math.random() * 500, q: 1.5 });
    },
    recoger(s, t) {
      this.#tono(s, t, { tipo: 'sine', f0: 620 + Math.random() * 120, f1: 1250, dur: 0.07, vol: 0.18 });
    },
    craftear(s, t) {
      this.#tono(s, t, { tipo: 'triangle', f0: 523, dur: 0.08, vol: 0.2 });
      this.#tono(s, t + 0.08, { tipo: 'triangle', f0: 784, dur: 0.12, vol: 0.2 });
    },
    rota(s, t) {
      for (let i = 0; i < 3; i++) this.#ruidoF(s, t + i * 0.05, { dur: 0.05, vol: 0.35, filtro: 'highpass', f0: 2500 });
      this.#tono(s, t, { tipo: 'square', f0: 600, f1: 200, dur: 0.2, vol: 0.12 });
    },
    arco(s, t) {
      this.#tono(s, t, { tipo: 'triangle', f0: 220, f1: 110, dur: 0.12, vol: 0.25 });
      this.#ruidoF(s, t, { dur: 0.08, vol: 0.25, filtro: 'highpass', f0: 2000 });
    },
    flecha(s, t) {
      this.#ruidoF(s, t, { dur: 0.05, vol: 0.3, filtro: 'bandpass', f0: 1800, q: 2 });
    },
    chapuzon(s, t) {
      this.#ruidoF(s, t, { dur: 0.35, vol: 0.4, filtro: 'lowpass', f0: 1500, f1: 250 });
      this.#tono(s, t + 0.02, { tipo: 'sine', f0: 380, f1: 160, dur: 0.12, vol: 0.12 });
    },
    pica(s, t) {
      this.#tono(s, t, { tipo: 'sine', f0: 520, f1: 300, dur: 0.08, vol: 0.25 });
      this.#tono(s, t + 0.1, { tipo: 'sine', f0: 520, f1: 300, dur: 0.08, vol: 0.2 });
    },
    puerta(s, t, { abrir = true }) {
      this.#ruidoF(s, t, { dur: 0.22, vol: 0.2, filtro: 'bandpass', f0: abrir ? 500 : 350, f1: abrir ? 900 : 250, q: 6 });
      this.#tono(s, t + (abrir ? 0 : 0.15), { tipo: 'sine', f0: 110, f1: 70, dur: 0.1, vol: 0.3 });
    },
    dormir(s, t) {
      [523, 659, 784].forEach((f, i) => this.#tono(s, t + i * 0.18, { tipo: 'sine', f0: f, dur: 0.5, vol: 0.12 }));
    },
    arar(s, t) {
      this.#ruidoF(s, t, { dur: 0.12, vol: 0.4, filtro: 'lowpass', f0: 700, f1: 300 });
    },
    // ── mobs ──
    zombie(s, t) {
      this.#tono(s, t, { tipo: 'sawtooth', f0: 120, f1: 85, dur: 0.6, vol: 0.12, ataque: 0.08, vibrato: 7 });
    },
    esqueleto(s, t) {
      for (let i = 0; i < 4; i++) this.#ruidoF(s, t + i * 0.06, { dur: 0.03, vol: 0.25, filtro: 'bandpass', f0: 2500 + Math.random() * 1000, q: 5 });
    },
    slime(s, t) {
      this.#tono(s, t, { tipo: 'sine', f0: 240, f1: 80, dur: 0.12, vol: 0.25 });
      this.#ruidoF(s, t, { dur: 0.08, vol: 0.15, filtro: 'lowpass', f0: 600 });
    },
    serpiente(s, t) {
      this.#ruidoF(s, t, { dur: 0.45, vol: 0.18, filtro: 'highpass', f0: 4500, ataque: 0.05 });
    },
    ojo(s, t) {
      this.#ruidoF(s, t, { dur: 0.35, vol: 0.18, filtro: 'bandpass', f0: 400, f1: 1400, q: 3, ataque: 0.1 });
    },
    vaca(s, t) {
      this.#tono(s, t, { tipo: 'sawtooth', f0: 150, f1: 115, dur: 0.55, vol: 0.12, ataque: 0.06, vibrato: 4 });
    },
    cerdo(s, t) {
      this.#tono(s, t, { tipo: 'square', f0: 320, f1: 260, dur: 0.12, vol: 0.1, vibrato: 30 });
      this.#tono(s, t + 0.16, { tipo: 'square', f0: 300, f1: 240, dur: 0.1, vol: 0.08, vibrato: 30 });
    },
    gallina(s, t) {
      this.#tono(s, t, { tipo: 'square', f0: 800, f1: 600, dur: 0.05, vol: 0.08 });
      this.#tono(s, t + 0.08, { tipo: 'square', f0: 900, f1: 650, dur: 0.06, vol: 0.08 });
    },
    mecha(s, t) {
      this.#ruidoF(s, t, { dur: 1.1, vol: 0.22, filtro: 'highpass', f0: 3000, f1: 5000, ataque: 0.05 });
    },
    explosion(s, t) {
      this.#ruidoF(s, t, { dur: 0.9, vol: 0.8, filtro: 'lowpass', f0: 1800, f1: 120 });
      this.#tono(s, t, { tipo: 'sine', f0: 90, f1: 35, dur: 0.7, vol: 0.5 });
      this.#ruidoF(s, t + 0.05, { dur: 0.3, vol: 0.3, filtro: 'bandpass', f0: 600, q: 0.8 });
    },
    arana(s, t) {
      for (let i = 0; i < 5; i++) this.#ruidoF(s, t + i * 0.04, { dur: 0.02, vol: 0.2, filtro: 'bandpass', f0: 3200 + Math.random() * 800, q: 8 });
    },
    murcielago(s, t) {
      this.#tono(s, t, { tipo: 'square', f0: 3800, f1: 4600, dur: 0.04, vol: 0.06 });
      this.#tono(s, t + 0.06, { tipo: 'square', f0: 4200, f1: 5000, dur: 0.035, vol: 0.05 });
    },
    yeti(s, t) {
      this.#tono(s, t, { tipo: 'sawtooth', f0: 95, f1: 70, dur: 0.5, vol: 0.14, ataque: 0.05, vibrato: 12 });
      this.#ruidoF(s, t, { dur: 0.4, vol: 0.1, filtro: 'lowpass', f0: 400 });
    },
    telarana(s, t) {
      this.#ruidoF(s, t, { dur: 0.12, vol: 0.2, filtro: 'bandpass', f0: 900, f1: 2400, q: 4 });
    },
    nieve(s, t) {
      this.#ruidoF(s, t, { dur: 0.15, vol: 0.3, filtro: 'lowpass', f0: 1200, f1: 400 });
    },
    ave(s, t) {
      this.#tono(s, t, { tipo: 'sine', f0: 2200, f1: 3200, dur: 0.06, vol: 0.1 });
      this.#tono(s, t + 0.09, { tipo: 'sine', f0: 2400, f1: 3400, dur: 0.06, vol: 0.08 });
    },
  };

  // Reproduce un sonido. dist: 0 (encima tuyo) .. 1 (lejos, no se oye).
  // pan: -1 (izquierda) .. 1 (derecha). Devuelve false si no sonó.
  play(nombre, { dist = 0, pan = 0, ...opts } = {}) {
    const receta = SonidoSurvi.RECETAS[nombre];
    if (!receta || dist >= SonidoSurvi.DIST_MAX) return false;
    if (this.volumen <= 0.001) return false;
    const ahora = performance.now();
    const gap = SonidoSurvi.GAP_MS[nombre] || 0;
    if (gap && this.#ultimo[nombre] && ahora - this.#ultimo[nombre] < gap) return false;
    if (this.#voces >= SonidoSurvi.MAX_VOCES) return false;
    const ctx = this.#contexto();
    if (!ctx) return false;
    this.#ultimo[nombre] = ahora;
    // salida propia: volumen por distancia + paneo
    const g = ctx.createGain();
    g.gain.value = Math.pow(1 - dist, 1.5);
    let salida = g;
    if (ctx.createStereoPanner && pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p).connect(this.#master);
    } else g.connect(this.#master);
    this.#voces++;
    try {
      receta.call(this, salida, ctx.currentTime + 0.005, opts);
    } catch {
      /* un sonido que falla no rompe el juego */
    }
    setTimeout(() => {
      this.#voces--;
      g.disconnect();
    }, 1200);
    return true;
  }

  // Lluvia: ruido continuo que sube y baja con la intensidad. bajoTecho:
  // más apagada (filtro más bajo y menos volumen).
  lluvia(intensidad, bajoTecho = false) {
    if (intensidad <= 0.01 || this.volumen <= 0.001) {
      if (this.#lluvia) this.#lluvia.gain.gain.setTargetAtTime(0, this.#ctx.currentTime, 0.3);
      return;
    }
    const ctx = this.#contexto();
    if (!ctx) return;
    if (!this.#lluvia) {
      const fuente = ctx.createBufferSource();
      fuente.buffer = this.#ruido;
      fuente.loop = true;
      const filtro = ctx.createBiquadFilter();
      filtro.type = 'lowpass';
      const gain = ctx.createGain();
      gain.gain.value = 0;
      fuente.connect(filtro).connect(gain).connect(this.#master);
      fuente.start();
      this.#lluvia = { fuente, filtro, gain };
    }
    const L = this.#lluvia;
    L.filtro.frequency.setTargetAtTime(bajoTecho ? 500 : 2200, ctx.currentTime, 0.4);
    L.gain.gain.setTargetAtTime(intensidad * (bajoTecho ? 0.12 : 0.28), ctx.currentTime, 0.4);
  }

  // Corta los sonidos continuos (al pausar o salir al menú).
  silenciar() {
    if (this.#lluvia && this.#ctx) this.#lluvia.gain.gain.setTargetAtTime(0, this.#ctx.currentTime, 0.1);
  }
}
