// ══════════════════════════════════════════════════════════════
//   Pixel Survi — survi_cielo.js
//
//   Clase Cielo: el fondo detrás del mundo.
//     • Color del cielo con transición SUAVE: al cambiar de bioma o al
//       entrar/salir de una cueva ya no cambia de golpe, se mezcla en
//       ~1 segundo (actualizar()).
//     • Sol: cruza el cielo de día (anaranjado al salir y al ponerse).
//     • Luna: de noche, con fases (cambia cada día, ciclo de 8).
//     • Estrellas: de noche, titilan.
//     • Nubes pixeladas en 2 capas (lejos / cerca) con parallax. Con lluvia
//       hay más y se ponen grises; de noche, oscuras.
//     • Resplandor naranja en el horizonte al amanecer y al atardecer.
//   Todo en px de PANTALLA (unidades lógicas), no de mundo.
//   La luna y las estrellas se dibujan DESPUÉS de la oscuridad (si no, de
//   noche no se verían), solo donde hay cielo abierto (abierto(sx, sy)).
// ══════════════════════════════════════════════════════════════
export class Cielo {
  static CUEVA = [12, 14, 20]; // color de fondo bajo tierra (cueva común)
  static TRANSICION_MS = 900; // tiempo de la mezcla de color (bioma / cueva)
  static N_ESTRELLAS = 70;
  static N_NUBES = 12;
  static NUBE_CLARA = '#ffffff';
  static NUBE_OSCURA = '#3a4058';

  #color = null; // [r, g, b] actual (se acerca al objetivo)
  #cueva = 0; // 0 = afuera, 1 = bajo tierra (suave)
  #colorCueva = Cielo.CUEVA.slice(); // color de fondo de la cueva donde estás (suave)
  #estrellas = [];
  #nubes = []; // { img, oscura, x, y, capa, umbral }
  #deriva = 0; // cuánto se corrieron las nubes con el viento (px)

  constructor(semilla = 1) {
    let s = semilla >>> 0 || 1;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < Cielo.N_ESTRELLAS; i++) {
      this.#estrellas.push({ x: rnd(), y: rnd() * 0.62, grande: rnd() < 0.15, fase: rnd() * 6.28 });
    }
    for (let i = 0; i < Cielo.N_NUBES; i++) {
      const capa = i % 3 === 0 ? 1 : 0; // 1 = cerca (más grande y rápida)
      const w = Math.round((capa ? 70 : 42) + rnd() * (capa ? 60 : 40));
      const h = Math.round((capa ? 16 : 10) + rnd() * 8);
      const forma = Cielo.#formaNube(w, h, rnd);
      this.#nubes.push({
        img: Cielo.#dibujarNube(w, h, forma, Cielo.NUBE_CLARA, '#dfe6ee'),
        oscura: Cielo.#dibujarNube(w, h, forma, Cielo.NUBE_OSCURA, '#2c3146'),
        x: rnd() * 1100,
        y: 8 + rnd() * (capa ? 70 : 55),
        capa,
        umbral: rnd(), // con más cobertura (lluvia) se ven más nubes
      });
    }
  }

  // Forma de una nube: unos "bollos" redondos apoyados en una base plana.
  static #formaNube(w, h, rnd) {
    const bollos = [];
    const n = 2 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const r = Math.round(h * (0.35 + rnd() * 0.25));
      bollos.push({ x: Math.round(r + rnd() * (w - 2 * r)), y: h - r - 2, r });
    }
    return bollos;
  }

  // La nube pixelada (color arriba, sombra abajo) en un canvas propio.
  static #dibujarNube(w, h, bollos, color, sombra) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    const pintar = (col, dy) => {
      ctx.fillStyle = col;
      for (const b of bollos) {
        for (let y = -b.r; y <= b.r; y++) {
          const ancho = Math.round(Math.sqrt(b.r * b.r - y * y));
          ctx.fillRect(b.x - ancho, b.y + y + dy, ancho * 2, 1);
        }
      }
      ctx.fillRect(1, h - Math.round(h * 0.4) + dy, w - 2, Math.round(h * 0.4) - 1); // base plana
    };
    pintar(sombra, 0);
    pintar(color, -1);
    ctx.clearRect(0, h - 1, w, 1);
    return c;
  }

  get enCueva() {
    return this.#cueva;
  }

  // objetivo: color del cielo que debería verse ahora ('#rrggbb' o 'rgb(...)').
  // colorCueva: fondo del tipo de cueva donde estás (musgo, hielo, …).
  actualizar(dt, objetivo, bajoTierra, viento = 1, colorCueva = null) {
    const meta = Cielo.#rgb(objetivo);
    const k = 1 - Math.exp(-dt / (Cielo.TRANSICION_MS / 3));
    if (!this.#color) this.#color = meta.slice();
    for (let i = 0; i < 3; i++) this.#color[i] += (meta[i] - this.#color[i]) * k;
    if (colorCueva) {
      const mc = Cielo.#rgb(colorCueva), kc = 1 - Math.exp(-dt / Cielo.TRANSICION_MS); // un poco más lento
      for (let i = 0; i < 3; i++) this.#colorCueva[i] += (mc[i] - this.#colorCueva[i]) * kc;
    }
    this.#cueva += ((bajoTierra ? 1 : 0) - this.#cueva) * k;
    if (Math.abs(this.#cueva - (bajoTierra ? 1 : 0)) < 0.002) this.#cueva = bajoTierra ? 1 : 0;
    this.#deriva += dt * 0.004 * viento;
  }

  static #rgb(c) {
    if (c[0] === '#') {
      const n = parseInt(c.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    return c.match(/\d+/g).slice(0, 3).map(Number);
  }

  get colorActual() {
    const [r, g, b] = (this.#color || [0, 0, 0]).map((v, i) => Math.round(v + (this.#colorCueva[i] - v) * this.#cueva));
    return `rgb(${r},${g},${b})`;
  }

  // Posición en el arco: t de 0 (sale) a 1 (se pone).
  static #arco(t, W, H) {
    return { x: W * (0.06 + 0.88 * t), y: H * 0.62 - Math.sin(Math.PI * t) * H * 0.5 };
  }

  // Sol: visible del amanecer (0.9) al atardecer (0.6). null si es de noche.
  static tSol(hora) {
    const t = ((hora + 0.1) % 1) / 0.7;
    return t <= 1 ? t : null;
  }

  // Luna: de 0.55 a 0.95.
  static tLuna(hora) {
    return hora >= 0.55 && hora <= 0.95 ? (hora - 0.55) / 0.4 : null;
  }

  // Fondo (antes del mundo): color, resplandor, sol y nubes.
  // e: { W, H, hora, noche (0..1), lluvia (0..1), camX, colorLluvia }
  dibujarFondo(ctx, e) {
    const { W, H } = e;
    ctx.fillStyle = this.colorActual;
    ctx.fillRect(0, 0, W, H);
    const afuera = 1 - this.#cueva;
    if (afuera <= 0.01) return;
    // cielo nublado con lluvia (gris) o lluvia ácida (verdoso)
    if (e.lluvia > 0) {
      ctx.globalAlpha = 0.7 * e.lluvia * afuera;
      ctx.fillStyle = e.colorLluvia;
      ctx.fillRect(0, 0, W, H);
    }
    // degradé suave: un poco más claro abajo
    ctx.globalAlpha = 0.14 * afuera * (1 - e.noche);
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    // amanecer / atardecer: horizonte naranja
    const crep = Math.max(0, 1 - Math.abs(e.hora - 0.56) / 0.06, 1 - Math.abs(e.hora - 0.95) / 0.05) * (1 - e.lluvia * 0.7);
    if (crep > 0) {
      ctx.globalAlpha = 0.5 * crep * afuera;
      const g2 = ctx.createLinearGradient(0, H * 0.25, 0, H);
      g2.addColorStop(0, 'rgba(255,140,60,0)');
      g2.addColorStop(1, 'rgba(255,120,50,1)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, W, H);
    }
    // luna de sangre: el cielo de la noche se tiñe de rojo
    if (e.sangre && e.noche > 0) {
      ctx.globalAlpha = 0.45 * e.noche * afuera;
      ctx.fillStyle = '#7a0f1c';
      ctx.fillRect(0, 0, W, H);
    }
    // sol
    const ts = Cielo.tSol(e.hora);
    if (ts !== null) {
      const { x, y } = Cielo.#arco(ts, W, H);
      const bajo = Math.min(1, Math.min(ts, 1 - ts) * 6); // cerca del horizonte: anaranjado
      ctx.globalAlpha = afuera * (1 - e.lluvia * 0.85);
      this.#dibujarSol(ctx, Math.round(x), Math.round(y), bajo);
    }
    // nubes
    this.#dibujarNubes(ctx, e, afuera);
    ctx.globalAlpha = 1;
  }

  // Halo redondo (degradé radial) alrededor del sol / la luna.
  static #resplandor(ctx, x, y, r, rgb, alfa) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${alfa})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  #dibujarSol(ctx, x, y, bajo) {
    const a = ctx.globalAlpha;
    const nucleo = bajo < 1 ? '#ffb347' : '#fff3a8', borde = bajo < 1 ? '#ff8a3d' : '#ffe066';
    Cielo.#resplandor(ctx, x, y, 24, bajo < 1 ? '255,150,70' : '255,235,140', a * 0.55);
    ctx.globalAlpha = a;
    ctx.fillStyle = borde;
    ctx.fillRect(x - 9, y - 9, 18, 18);
    ctx.fillStyle = nucleo;
    ctx.fillRect(x - 7, y - 7, 14, 14);
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = a * 0.6;
    ctx.fillRect(x - 5, y - 5, 4, 4);
    ctx.globalAlpha = a;
  }

  #dibujarNubes(ctx, e, afuera) {
    const cobertura = 0.55 + 0.45 * e.lluvia; // qué fracción de nubes se ve
    const oscuridad = Math.min(1, Math.max(e.noche * 0.85, e.lluvia * 0.6));
    const span = e.W + 260;
    for (const n of this.#nubes) {
      const vis = Math.max(0, Math.min(1, (cobertura - n.umbral) * 6));
      if (vis <= 0) continue;
      const par = n.capa ? 0.22 : 0.1; // parallax con la cámara
      const vel = n.capa ? 1.6 : 1;
      let x = (n.x + this.#deriva * vel - e.camX * par) % span;
      if (x < 0) x += span;
      x = Math.round(x - 130);
      const y = Math.round(n.y);
      const alfa = afuera * vis * (n.capa ? 0.95 : 0.8);
      ctx.globalAlpha = alfa;
      ctx.drawImage(n.img, x, y);
      if (oscuridad > 0.01) {
        ctx.globalAlpha = alfa * oscuridad; // de noche / con lluvia, más oscura
        ctx.drawImage(n.oscura, x, y);
      }
    }
    ctx.globalAlpha = 1;
  }

  // Luna y estrellas (después de la oscuridad). abierto(sx, sy): true si en
  // ese punto de la pantalla se ve el cielo (no hay bloque, agua ni pared).
  dibujarNoche(ctx, e, abierto) {
    const afuera = 1 - this.#cueva;
    const vis = e.noche * afuera * (1 - e.lluvia * 0.9);
    if (vis <= 0.02) return;
    const { W, H } = e;
    // estrellas
    for (const s of this.#estrellas) {
      const x = Math.round(s.x * W), y = Math.round(s.y * H);
      if (!abierto(x, y)) continue;
      ctx.globalAlpha = vis * (0.55 + 0.45 * Math.sin(e.t / 700 + s.fase));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, 1, 1);
      if (s.grande) {
        ctx.globalAlpha *= 0.5;
        ctx.fillRect(x - 1, y, 3, 1);
        ctx.fillRect(x, y - 1, 1, 3);
      }
    }
    // luna
    const tl = Cielo.tLuna(e.hora);
    if (tl !== null) {
      const { x, y } = Cielo.#arco(tl, W, H);
      const cx = Math.round(x), cy = Math.round(y);
      if (abierto(cx, cy) && abierto(cx - 5, cy - 5) && abierto(cx + 5, cy + 5)) {
        ctx.globalAlpha = Math.min(1, vis * 1.3);
        this.#dibujarLuna(ctx, cx, cy, e.dias, e.sangre);
      }
    }
    ctx.globalAlpha = 1;
  }

  // Luna pixelada de radio 6 con cráteres y fase: la sombra entra por la
  // derecha (llena → nueva) y sale por la izquierda (nueva → llena).
  static SOMBRA_FASE = [null, 9, 6, 3, 0, -3, -6, -9];

  // sangre: luna de sangre (llena, roja y con un halo más grande)
  #dibujarLuna(ctx, cx, cy, dias, sangre = false) {
    const R = 6, fase = (((dias || 0) % 8) + 8) % 8;
    const off = sangre ? null : Cielo.SOMBRA_FASE[fase];
    const a = ctx.globalAlpha;
    Cielo.#resplandor(ctx, cx, cy, sangre ? 22 : 13, sangre ? '255,60,60' : '220,230,255', a * (sangre ? 0.5 : 0.3));
    ctx.globalAlpha = a;
    const luz = (x, y) => off === null || (x + 0.5 - off) ** 2 + (y + 0.5) ** 2 >= R * R;
    for (let y = -R; y < R; y++) {
      const ancho = Math.round(Math.sqrt(R * R - (y + 0.5) ** 2));
      for (let x = -ancho; x < ancho; x++) {
        ctx.fillStyle = luz(x, y) ? (sangre ? '#e0343c' : '#e8ecf5') : '#2b3350';
        ctx.fillRect(cx + x, cy + y, 1, 1);
      }
    }
    // cráteres (solo donde está iluminada)
    ctx.fillStyle = sangre ? '#9c1c26' : '#a9b2c8';
    for (const [x, y, w, h] of [[-3, -2, 2, 2], [1, 1, 2, 1], [-1, 3, 1, 1], [2, -4, 1, 1]]) {
      if (luz(x, y)) ctx.fillRect(cx + x, cy + y, w, h);
    }
    ctx.globalAlpha = a;
  }
}
