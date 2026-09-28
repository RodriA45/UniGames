// ══════════════════════════════════════════════════════════════
//   Pixel Survi — survi_light.js
//   Iluminación por tile, estilo Terraria.
//
//   Cada frame se calcula un mapa de luz (0..1) SOLO para la zona que ve
//   la cámara (+ un margen, para que la luz de afuera también entre):
//     1) Sol: toda celda que está por encima del primer bloque sólido de su
//        columna (a cielo abierto) recibe la luz del sol del momento del día.
//     2) Antorchas del área y la visión del personaje: fuentes puntuales.
//     3) Se propaga en 8 direcciones: cada paso resta LIGHT_AIR_DECAY en
//        aire o LIGHT_SOLID_DECAY en sólido (las paredes frenan la luz). Con
//        diagonales se ve redondo, no un rombo.
//   Después se dibuja la oscuridad (1 - luz) en un canvas chiquito de 1 px
//   por tile y se estira sobre el mundo CON suavizado: los bordes de la luz
//   quedan como degradé circular, no como escalones de a bloque.
// ══════════════════════════════════════════════════════════════

import { SurviConfig } from './survi_config.js';

export class LightMap {
  static MARGIN = 12; // tiles extra alrededor de la vista
  static FURNACE_LIGHT = 0.75; // ~7 tiles
  static SQRT2 = Math.SQRT2;
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.skyRow = new Int16Array(SurviConfig.COLS); // primer sólido de cada columna (desde arriba)
    this.grid = null;
    this.queue = null;
    this.margen = LightMap.MARGIN; // tiles de más alrededor de la vista (menos en gama baja)
    this.colorOscuro = null; // [r, g, b] para teñir la oscuridad (luna de sangre); null = DARK_COLOR
    this.c0 = 0;
    this.r0 = 0;
    this.w = 0;
    this.h = 0;
  }

  // Recalcula todas las columnas (al cargar el mundo).
  rebuildSky(get) {
    for (let c = 0; c < SurviConfig.COLS; c++) this.updateColumn(get, c);
  }

  // Una columna (al romper o colocar un bloque en ella).
  updateColumn(get, col) {
    if (col < 0 || col >= SurviConfig.COLS) return;
    let r = 0;
    while (r < SurviConfig.ROWS && !SurviConfig.SOLID_IDS.has(get(col, r))) r++;
    this.skyRow[col] = r;
  }

  _ensure(w, h) {
    if (this.w === w && this.h === h && this.grid) return;
    this.w = w;
    this.h = h;
    this.grid = new Float32Array(w * h);
    this.queue = new Int32Array(w * h * 4); // cola circular: sobra lugar
    this.canvas.width = w;
    this.canvas.height = h;
    this.image = this.ctx.createImageData(w, h);
  }

  // camera: {x,y,width,height} en px de mundo. sun: 0..1.
  // points: [{x, y, power}] en px de mundo (visión del personaje, etc.).
  // luzExtra(col, row): luz propia de la celda (ej. la lava), o null.
  compute(get, camera, sun, points, luzExtra = null) {
    // Tamaño de la zona FIJO (solo depende del tamaño de la vista y del
    // margen): antes era ceil(fin) - floor(inicio), que salta entre dos
    // valores según dónde cae la cámara dentro del tile. Con el temblor de
    // cámara (al recibir daño, explosiones) saltaba casi en cada cálculo y
    // _ensure() rearmaba los arrays, el canvas y el ImageData cada vez.
    const M = this.margen, T = SurviConfig.TILE;
    const w = Math.min(SurviConfig.COLS, Math.ceil(camera.width / T) + 1 + 2 * M);
    const h = Math.min(SurviConfig.ROWS, Math.ceil(camera.height / T) + 1 + 2 * M);
    const c0 = Math.max(0, Math.min(SurviConfig.COLS - w, Math.floor(camera.x / T) - M));
    const r0 = Math.max(0, Math.min(SurviConfig.ROWS - h, Math.floor(camera.y / T) - M));
    const r1 = r0 + h - 1;
    this._ensure(w, h);
    this.c0 = c0;
    this.r0 = r0;
    const L = this.grid,
      Q = this.queue,
      QN = Q.length;
    L.fill(0);
    let qh = 0,
      qt = 0;
    const seed = (i, v) => {
      if (v > L[i]) {
        L[i] = v;
        Q[qt] = i;
        qt = (qt + 1) % QN;
      }
    };
    // solidez de la zona, leída una sola vez
    if (!this.solid || this.solid.length !== w * h) this.solid = new Uint8Array(w * h);
    const S = this.solid;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const id = get(c0 + x, r0 + y);
        const i = y * w + x;
        S[i] = SurviConfig.SOLID_IDS.has(id) ? 1 : 0;
        if (SurviConfig.TORCH_IDS.has(id)) seed(i, SurviConfig.TORCH_LIGHT); // en el piso o en la pared
        else if (id === SurviConfig.T.FURNACE_ON) seed(i, LightMap.FURNACE_LIGHT); // horno prendido: luz más chica
        else if (SurviConfig.LUZ_TILES[id]) seed(i, SurviConfig.LUZ_TILES[id]); // hongo brillante, …
        else if (luzExtra) {
          const e = luzExtra(c0 + x, r0 + y);
          if (e) seed(i, e);
        }
      }
    }
    // sol: celdas a cielo abierto
    if (sun > 0) {
      for (let x = 0; x < w; x++) {
        const top = Math.min(this.skyRow[c0 + x], r1 + 1);
        for (let r = r0; r < top; r++) seed((r - r0) * w + x, sun);
      }
    }
    // fuentes puntuales (visión del personaje)
    for (const p of points) {
      const x = Math.floor(p.x / SurviConfig.TILE) - c0,
        y = Math.floor(p.y / SurviConfig.TILE) - r0;
      if (x >= 0 && y >= 0 && x < w && y < h) seed(y * w + x, p.power);
    }
    // propagación (se relaja hasta que no mejora nada)
    while (qh !== qt) {
      const i = Q[qh];
      qh = (qh + 1) % QN;
      const v = L[i];
      const x = i % w,
        y = (i - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const ni = ny * w + nx;
          // en diagonal no se cuela entre dos sólidos que se tocan por la esquina
          if (dx && dy && S[y * w + nx] && S[ny * w + x]) continue;
          const decay =
            (S[ni] ? SurviConfig.LIGHT_SOLID_DECAY : SurviConfig.LIGHT_AIR_DECAY) * (dx && dy ? LightMap.SQRT2 : 1);
          const nv = v - decay;
          if (nv > L[ni] + 0.004) {
            L[ni] = nv;
            Q[qt] = ni;
            qt = (qt + 1) % QN;
          }
        }
      }
    }
    // oscuridad = 1 - luz (con una curva: la penumbra se ve menos lavada)
    const d = this.image.data;
    const [R, G, B] = this.colorOscuro || SurviConfig.DARK_COLOR;
    for (let i = 0; i < w * h; i++) {
      const lit = Math.min(1, L[i]);
      const dark = Math.pow(1 - lit, 1.25);
      const o = i * 4;
      d[o] = R;
      d[o + 1] = G;
      d[o + 2] = B;
      d[o + 3] = Math.round(dark * 255);
    }
    this.ctx.putImageData(this.image, 0, 0);
  }

  // Dibuja la capa de oscuridad. Tiene que llamarse con el ctx ya escalado
  // por el zoom (mismo espacio que tilemap.draw).
  draw(ctx, camera) {
    if (!this.w) return;
    const sx = this.c0 * SurviConfig.TILE - camera.x,
      sy = this.r0 * SurviConfig.TILE - camera.y;
    const prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true; // degradé suave entre tiles
    ctx.drawImage(this.canvas, 0, 0, this.w, this.h, sx, sy, this.w * SurviConfig.TILE, this.h * SurviConfig.TILE);
    ctx.imageSmoothingEnabled = prev;
  }

  // Luz del sol según la hora (0..1 del ciclo).
  static sunAt(t, nightSun) {
    const lerp = (a, b, k) => a + (b - a) * k;
    if (t < 0.5) return 1;
    if (t < 0.6) return lerp(1, nightSun, (t - 0.5) / 0.1);
    if (t < 0.9) return nightSun;
    return lerp(nightSun, 1, (t - 0.9) / 0.1);
  }

  // Mezcla dos colores #rrggbb (k = 0 → a, 1 → b).
  static mixHex(a, b, k) {
    const pa = parseInt(a.slice(1), 16),
      pb = parseInt(b.slice(1), 16);
    const ch = (p, s) => (p >> s) & 255;
    const m = (s) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * k);
    return `rgb(${m(16)},${m(8)},${m(0)})`;
  }
}
