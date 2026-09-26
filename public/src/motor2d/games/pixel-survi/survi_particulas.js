// ══════════════════════════════════════════════════════════════
//   Pixel Survi — survi_particulas.js
//
//   Clase Particulas: efectos chiquitos en px de mundo.
//     • romper / picar → pedacitos del bloque (con los colores de su tile)
//     • polvo          → al colocar un bloque
//     • agua           → salpicadura al caer al agua (jugador o mobs)
//     • lava           → brasas y humo al caer a la lava + burbujas sueltas
//                        en la superficie de la lava que se ve
//     • fuego          → brasas y humo de lo que se está quemando
//     • muerte         → nubecita de humo cuando muere un mob
//   Hay un tope según la calidad (gama baja: pocas). Las que "brillan"
//   (brasas) se dibujan encima de la oscuridad; el resto, debajo.
//
//   Clase Llamas: dibuja fuego pixelado encima de algo que se quema
//   (reemplaza el parpadeo naranja de antes).
// ══════════════════════════════════════════════════════════════
import { SurviConfig } from './survi_config.js';

export class Particulas {
  static MAX = { low: 90, medium: 200, high: 320 };
  static LAVA_CADA_MS = 150; // burbujas de la superficie de la lava
  static FUEGO_CADA_MS = 70; // brasas de lo que se quema
  static COLORES = {
    agua: ['#9fd4ff', '#6fb4f0', '#e6f6ff'],
    brasa: ['#ffd84a', '#ff9a1a', '#ff6a14'],
    humo: ['#6b6b6b', '#8a8a8a', '#4f4f4f'],
    poof: ['#f2f2f2', '#d8d8d8', '#bdbdbd'],
    polvo: ['#b9a58a', '#9c8a70'],
  };

  #lista = [];
  #paletas = new Map(); // tile → colores sacados de su dibujo
  #lavaMs = 0;
  #fuegoMs = 0;

  constructor(juego) {
    this.juego = juego;
  }

  get max() {
    return Particulas.MAX[this.juego.quality] || Particulas.MAX.medium;
  }

  get cantidad() {
    return this.#lista.length;
  }

  vaciar() {
    this.#lista.length = 0;
  }

  static #azar(a, b) {
    return a + Math.random() * (b - a);
  }

  static #elegir(lista) {
    return lista[Math.floor(Math.random() * lista.length)];
  }

  // p: { x, y, vx, vy, vida, color, tam, g (gravedad), roce, choca, brilla, humo }
  #agregar(p) {
    if (this.#lista.length >= this.max) return;
    p.ms = p.vida;
    this.#lista.push(p);
  }

  // Colores de un tile (se leen una vez de su dibujo en el tileset).
  paleta(id) {
    if (this.#paletas.has(id)) return this.#paletas.get(id);
    let colores = ['#8a6a4a', '#6e5238'];
    const img = this.juego._tilesetCanvas;
    if (img && id > 0) {
      try {
        const T = SurviConfig.TILE, tc = SurviConfig.TILESET_COLS, i = id - 1;
        const ctx = img.getContext('2d', { willReadFrequently: true });
        const d = ctx.getImageData((i % tc) * T, Math.floor(i / tc) * T, T, T).data;
        const vistos = new Set();
        for (let k = 0; k < 40 && vistos.size < 6; k++) {
          const o = Math.floor(Math.random() * T * T) * 4;
          if (d[o + 3] < 200) continue; // transparente
          vistos.add(`rgb(${d[o]},${d[o + 1]},${d[o + 2]})`);
        }
        if (vistos.size) colores = [...vistos];
      } catch {
        /* sin acceso al canvas: colores de tierra */
      }
    }
    this.#paletas.set(id, colores);
    return colores;
  }

  // ── Efectos ──
  romper(col, row, id, n = 10) {
    const T = SurviConfig.TILE, pal = this.paleta(id);
    for (let i = 0; i < n; i++) {
      this.#agregar({
        x: col * T + Particulas.#azar(2, T - 2),
        y: row * T + Particulas.#azar(2, T - 2),
        vx: Particulas.#azar(-1.4, 1.4),
        vy: Particulas.#azar(-2.6, -0.6),
        vida: Particulas.#azar(450, 850),
        color: Particulas.#elegir(pal),
        tam: Math.random() < 0.35 ? 2 : 1,
        g: 0.16,
        roce: 0.98,
        choca: true,
      });
    }
  }

  // Mientras picás: un par de astillas que saltan hacia vos.
  picar(col, row, id) {
    const T = SurviConfig.TILE, p = this.juego.player, pal = this.paleta(id);
    const hacia = Math.sign(p.x + p.w / 2 - (col * T + T / 2)) || 1;
    for (let i = 0; i < 2; i++) {
      this.#agregar({
        x: col * T + T / 2 + hacia * (T / 2 - 1),
        y: row * T + Particulas.#azar(3, T - 3),
        vx: hacia * Particulas.#azar(0.4, 1.3),
        vy: Particulas.#azar(-1.8, -0.5),
        vida: Particulas.#azar(300, 550),
        color: Particulas.#elegir(pal),
        tam: 1,
        g: 0.16,
        roce: 0.97,
        choca: true,
      });
    }
  }

  polvo(col, row) {
    const T = SurviConfig.TILE;
    for (let i = 0; i < 5; i++) {
      this.#agregar({
        x: col * T + Particulas.#azar(0, T),
        y: row * T + T - 1,
        vx: Particulas.#azar(-0.6, 0.6),
        vy: Particulas.#azar(-0.5, -0.1),
        vida: Particulas.#azar(300, 500),
        color: Particulas.#elegir(Particulas.COLORES.polvo),
        tam: 1,
        g: 0.01,
        roce: 0.93,
        humo: true,
      });
    }
  }

  // Salpicadura: más gotas cuanto más fuerte cayó (fuerza ~ velocidad de caída).
  agua(x, y, fuerza = 2) {
    const n = Math.min(18, 5 + Math.round(fuerza * 2.5));
    for (let i = 0; i < n; i++) {
      this.#agregar({
        x: x + Particulas.#azar(-5, 5),
        y: y - 1,
        vx: Particulas.#azar(-1.2, 1.2),
        vy: -Particulas.#azar(0.8, 1.2 + fuerza * 0.45),
        vida: Particulas.#azar(350, 650),
        color: Particulas.#elegir(Particulas.COLORES.agua),
        tam: Math.random() < 0.3 ? 2 : 1,
        g: 0.17,
        roce: 0.99,
        agua: true, // se corta al volver a caer al agua
      });
    }
  }

  brasa(x, y, fuerte = false) {
    this.#agregar({
      x,
      y,
      vx: Particulas.#azar(-0.4, 0.4),
      vy: -Particulas.#azar(0.3, fuerte ? 1.8 : 0.9),
      vida: Particulas.#azar(500, 1100),
      color: Particulas.#elegir(Particulas.COLORES.brasa),
      tam: Math.random() < 0.25 ? 2 : 1,
      g: 0.012,
      roce: 0.985,
      brilla: true,
    });
  }

  humo(x, y, color = null) {
    this.#agregar({
      x,
      y,
      vx: Particulas.#azar(-0.25, 0.25),
      vy: -Particulas.#azar(0.25, 0.6),
      vida: Particulas.#azar(600, 1100),
      color: color || Particulas.#elegir(Particulas.COLORES.humo),
      tam: 2,
      g: -0.004,
      roce: 0.97,
      humo: true,
    });
  }

  // Caer a la lava: chispazo de brasas + humo.
  lava(x, y, fuerza = 2) {
    const n = 6 + Math.round(fuerza * 2);
    for (let i = 0; i < n; i++) this.brasa(x + Particulas.#azar(-6, 6), y - 1, true);
    for (let i = 0; i < 4; i++) this.humo(x + Particulas.#azar(-5, 5), y - 3);
  }

  // Algo que se quema (caja x, y, w, h): una brasa o humo de vez en cuando.
  fuegoEn(x, y, w, h) {
    this.brasa(x + Particulas.#azar(0, w), y + Particulas.#azar(h * 0.2, h * 0.8));
    if (Math.random() < 0.35) this.humo(x + Particulas.#azar(0, w), y + Particulas.#azar(0, h * 0.4));
  }

  // Estallido chiquito de un color (telaraña, bola de nieve…).
  chispas(x, y, colores, n = 6) {
    for (let i = 0; i < n; i++) {
      this.#agregar({
        x: x + Particulas.#azar(-2, 2),
        y: y + Particulas.#azar(-2, 2),
        vx: Particulas.#azar(-1.3, 1.3),
        vy: Particulas.#azar(-1.8, 0.2),
        vida: Particulas.#azar(300, 600),
        color: Particulas.#elegir(colores),
        tam: Math.random() < 0.3 ? 2 : 1,
        g: 0.12,
        roce: 0.97,
        choca: true,
      });
    }
  }

  // Un mob que muere: nubecita blanca.
  muerte(x, y, w, h) {
    const n = Math.min(12, 5 + Math.round((w * h) / 40));
    for (let i = 0; i < n; i++) {
      this.#agregar({
        x: x + Particulas.#azar(0, w),
        y: y + Particulas.#azar(0, h),
        vx: Particulas.#azar(-0.5, 0.5),
        vy: -Particulas.#azar(0.1, 0.6),
        vida: Particulas.#azar(450, 800),
        color: Particulas.#elegir(Particulas.COLORES.poof),
        tam: 2,
        g: -0.005,
        roce: 0.95,
        humo: true,
      });
    }
  }

  // ── Por frame ──
  actualizar(dt, step) {
    const J = this.juego, T = SurviConfig.TILE, map = J.tilemap;
    this.#emitirLava(dt);
    this.#emitirFuego(dt);
    const L = this.#lista;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.ms -= dt;
      p.vy += p.g * step;
      p.vx *= Math.pow(p.roce, step);
      const nx = p.x + p.vx * step, ny = p.y + p.vy * step;
      if (p.choca && map.isSolidAt(Math.floor(nx / T), Math.floor(ny / T))) {
        // rebota apenas contra el piso / la pared
        if (map.isSolidAt(Math.floor(p.x / T), Math.floor(ny / T))) p.vy *= -0.25;
        else p.vx *= -0.3;
        p.vx *= 0.6;
      } else {
        p.x = nx;
        p.y = ny;
      }
      if (p.agua && p.vy > 0 && J.fluidos.tipo(Math.floor(p.x / T), Math.floor(p.y / T)) === 1) p.ms = 0;
      if (p.ms <= 0) {
        L[i] = L[L.length - 1]; // sacar sin correr todo (el orden no importa)
        L.pop();
      }
    }
  }

  // Burbujas y brasas en la superficie de la lava que se ve (muestreo al azar).
  #emitirLava(dt) {
    this.#lavaMs -= dt;
    if (this.#lavaMs > 0) return;
    this.#lavaMs = Particulas.LAVA_CADA_MS;
    const J = this.juego, T = SurviConfig.TILE, cam = J.camera, F = J.fluidos;
    const c0 = Math.floor(cam.x / T), r0 = Math.floor(cam.y / T);
    const cw = Math.ceil(cam.width / T) + 1, rh = Math.ceil(cam.height / T) + 1;
    const columnas = J.quality === 'low' ? 3 : 7;
    for (let k = 0; k < columnas; k++) {
      // una columna al azar de la vista: se buscan sus superficies de lava
      const c = c0 + Math.floor(Math.random() * cw);
      for (let r = r0; r < r0 + rh; r++) {
        if (F.tipo(c, r) !== 2 || F.tipo(c, r - 1) === 2 || J.tilemap.isSolidAt(c, r - 1)) continue;
        if (Math.random() < 0.45) continue;
        const sup = (r + 1) * T - (F.nivel(c, r) / 8) * T;
        const x = c * T + Math.random() * T;
        if (Math.random() < 0.75) this.brasa(x, sup - 1);
        else this.humo(x, sup - 2);
      }
    }
  }

  // Lo que se está quemando (visible) larga brasas.
  #emitirFuego(dt) {
    this.#fuegoMs -= dt;
    if (this.#fuegoMs > 0) return;
    this.#fuegoMs = Particulas.FUEGO_CADA_MS;
    const J = this.juego, cam = J.camera, margen = 20;
    const visible = (o) => o.x + o.w > cam.x - margen && o.x < cam.x + cam.width + margen && o.y + o.h > cam.y - margen && o.y < cam.y + cam.height + margen;
    for (const c of J.enemies) if (c.enFuego && visible(c)) this.fuegoEn(c.x, c.y, c.w, c.h);
    for (const c of J.animals) if (c.enFuego && visible(c)) this.fuegoEn(c.x, c.y, c.w, c.h);
    const p = J.player;
    if (p && J.jugadorEnFuego) this.fuegoEn(p.x, p.y, p.w, p.h);
  }

  // brillantes = true → solo las brasas (van encima de la oscuridad).
  dibujar(ctx, cam, brillantes = false) {
    const alfa0 = ctx.globalAlpha;
    for (const p of this.#lista) {
      if (!!p.brilla !== brillantes) continue;
      const x = Math.round(p.x - cam.x), y = Math.round(p.y - cam.y);
      if (x < -4 || y < -4 || x > cam.width + 4 || y > cam.height + 4) continue;
      const vida = p.ms / p.vida; // 1 → 0
      let tam = p.tam;
      if (p.humo) {
        tam = p.tam + Math.round((1 - vida) * 2);
        ctx.globalAlpha = alfa0 * 0.55 * vida;
      } else ctx.globalAlpha = alfa0 * Math.min(1, vida * 3); // se apaga al final
      ctx.fillStyle = p.color;
      ctx.fillRect(x - (tam >> 1), y - (tam >> 1), tam, tam);
    }
    ctx.globalAlpha = alfa0;
  }
}

// Fuego pixelado encima de algo que se quema: lenguas que suben desde los
// pies, cada una con su propio ritmo (rojo afuera, naranja, amarillo al medio).
export class Llamas {
  static ROJO = '#d2361b';
  static NARANJA = '#ff7a1a';
  static AMARILLO = '#ffd84a';

  // (x, y) arriba a la izquierda de la caja en pantalla (ctx escalado por el zoom).
  static dibujar(ctx, x, y, w, h, t) {
    const n = Math.max(2, Math.round(w / 2.5));
    const alto = h * 0.85;
    const base = Math.round(y + h);
    const cuadro = Math.floor(t / 80); // cambia la forma ~12 veces por segundo
    ctx.save();
    // resplandor suave sobre el cuerpo
    ctx.globalAlpha = 0.16 + 0.06 * Math.sin(t / 90);
    ctx.fillStyle = Llamas.NARANJA;
    ctx.fillRect(Math.round(x - 2), Math.round(y + h * 0.2), Math.round(w + 4), Math.round(h * 0.8));
    ctx.globalAlpha = 0.95;
    // de atrás para adelante: lenguas rojas, después naranjas, después el centro amarillo
    const lenguas = [];
    for (let i = 0; i < n; i++) {
      const ruido = ((i * 73 + cuadro * 31) % 7) / 7;
      const hi = Math.max(4, Math.round(alto * (0.3 + 0.3 * (Math.sin(t / 110 + i * 1.9) + 1) * 0.5 + 0.4 * ruido)));
      const fx = Math.round(x + ((i + 0.5) * w) / n);
      const ladeo = Math.round(Math.sin(t / 140 + i * 2.3)); // la punta se mueve
      lenguas.push({ fx, hi, ladeo });
    }
    for (const { fx, hi, ladeo } of lenguas) Llamas.#lengua(ctx, fx, base, hi, ladeo, Llamas.ROJO, 1.5);
    for (const { fx, hi, ladeo } of lenguas) Llamas.#lengua(ctx, fx, base, Math.round(hi * 0.7), ladeo, Llamas.NARANJA, 1);
    for (const { fx, hi } of lenguas) Llamas.#lengua(ctx, fx, base, Math.round(hi * 0.38), 0, Llamas.AMARILLO, 0.5);
    ctx.restore();
  }

  // Una lengua de fuego: ancha abajo, se afina hacia la punta (que se ladea).
  static #lengua(ctx, fx, base, hi, ladeo, color, ancho) {
    ctx.fillStyle = color;
    const a = Math.ceil(ancho);
    const tercio = Math.max(1, Math.round(hi / 3));
    ctx.fillRect(fx - a, base - tercio, a * 2 + (ancho % 1 ? 0 : -1) + 1, tercio); // base
    ctx.fillRect(fx - Math.max(0, a - 1), base - tercio * 2, Math.max(1, a * 2 - 1), tercio); // medio
    ctx.fillRect(fx + (ladeo > 0 ? 0 : ladeo), base - hi, 1 + Math.abs(ladeo), hi - tercio * 2); // punta
  }
}
