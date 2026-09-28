// ══════════════════════════════════════════════════════════════
//   Pixel Survi — survi_mapa.js
//
//   Mapa del mundo (tecla M o el botón del mapa en el HUD).
//
//   Clase MapaMundo: qué celdas ya exploraste (1 byte por celda, 125 KB).
//     • Se revela lo que VISTE (estilo Terraria): cada tanto se mira la
//       grilla de luz que ya calcula LightMap y toda celda de la vista con
//       luz suficiente queda descubierta. Una cueva oscura no aparece en el
//       mapa hasta que la iluminás. El espectador descubre toda la vista.
//     • dibujar(): arma una imagen de 1 px por celda (solo al abrir el mapa):
//       lo no explorado en negro; lo explorado con el color promedio de cada
//       tile (sacado una vez del tileset), agua, lava, paredes de fondo, cielo
//       y aire de cueva.
//     • Se guarda con la partida (RLE, como los tiles). Un mundo de antes
//       arranca con el mapa en negro.
//
//   Clase VistaMapa: la pantalla del mapa. Arrastrar = mover, rueda / pellizco
//   / botones = zoom, botón de centrar. Marca al jugador y a la cama.
// ══════════════════════════════════════════════════════════════
import { SurviConfig } from './survi_config.js';

export class MapaMundo {
  static UMBRAL_LUZ = 0.15; // luz mínima para que una celda cuente como vista
  static CIELO = [93, 134, 184];
  static AIRE_CUEVA = [34, 37, 47];
  static AGUA = [47, 111, 208];
  static LAVA = [224, 86, 27];
  static OSCURECER_FONDO = 0.55; // paredes de fondo: más oscuras que los bloques

  static #colores = null; // por id de tile: { r, g, b, k } (k = cuánto tapa)

  #celdas;
  #explorados = 0;
  #canvas = null;
  #ctx = null;
  #imagen = null;

  constructor(celdas = null) {
    const n = SurviConfig.COLS * SurviConfig.ROWS;
    this.#celdas = celdas && celdas.length === n ? Uint8Array.from(celdas, (v) => (v ? 1 : 0)) : new Uint8Array(n);
    for (let i = 0; i < n; i++) this.#explorados += this.#celdas[i];
  }

  // Desde lo guardado (Uint16Array del decodificador, o null).
  static desde(guardado) {
    return new MapaMundo(guardado);
  }

  // Para el guardado (se comprime con GestorGuardado.codificarTiles).
  serializar() {
    return this.#celdas;
  }

  get porcentaje() {
    return (this.#explorados / this.#celdas.length) * 100;
  }

  explorada(col, row) {
    return col >= 0 && row >= 0 && col < SurviConfig.COLS && row < SurviConfig.ROWS && this.#celdas[row * SurviConfig.COLS + col] === 1;
  }

  // Descubre las celdas de la VISTA que tienen luz (grilla de LightMap).
  // todo = true: toda la vista, sin mirar la luz (espectador).
  revelarLuz(luz, camera, todo = false) {
    const L = luz.grid;
    if (!L || !luz.w) return;
    const T = SurviConfig.TILE, COLS = SurviConfig.COLS, C = this.#celdas, U = MapaMundo.UMBRAL_LUZ;
    const ca = Math.max(luz.c0, Math.floor(camera.x / T));
    const cb = Math.min(luz.c0 + luz.w - 1, Math.floor((camera.x + camera.width) / T));
    const ra = Math.max(luz.r0, Math.floor(camera.y / T));
    const rb = Math.min(luz.r0 + luz.h - 1, Math.floor((camera.y + camera.height) / T));
    for (let r = ra; r <= rb; r++) {
      const fila = (r - luz.r0) * luz.w - luz.c0;
      for (let c = ca; c <= cb; c++) {
        const i = r * COLS + c;
        if (C[i] || (!todo && L[fila + c] < U)) continue;
        C[i] = 1;
        this.#explorados++;
      }
    }
  }

  // Color promedio de cada tile del tileset (una sola vez).
  static #leerColores(tileset) {
    if (MapaMundo.#colores) return MapaMundo.#colores;
    const T = SurviConfig.TILE, tc = SurviConfig.TILESET_COLS;
    const filas = Math.ceil(tileset.height / T);
    const lista = [null];
    try {
      const d = tileset.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, tileset.width, tileset.height).data;
      for (let i = 0; i < tc * filas; i++) {
        const x0 = (i % tc) * T, y0 = Math.floor(i / tc) * T;
        let r = 0, g = 0, b = 0, n = 0;
        for (let y = y0; y < y0 + T; y++) {
          for (let x = x0; x < x0 + T; x++) {
            const o = (y * tileset.width + x) * 4;
            if (d[o + 3] < 128) continue;
            r += d[o];
            g += d[o + 1];
            b += d[o + 2];
            n++;
          }
        }
        lista.push(n ? { r: r / n, g: g / n, b: b / n, k: n / (T * T) } : null);
      }
    } catch {
      /* sin acceso al canvas: todo gris */
    }
    MapaMundo.#colores = lista;
    return lista;
  }

  // Imagen de 1 px por celda. j: el SurviGame (tilemap, fluidos, fondo, luz).
  dibujar(j) {
    const { COLS, ROWS } = SurviConfig;
    if (!this.#canvas) {
      this.#canvas = document.createElement('canvas');
      this.#canvas.width = COLS;
      this.#canvas.height = ROWS;
      this.#ctx = this.#canvas.getContext('2d');
      this.#imagen = this.#ctx.createImageData(COLS, ROWS);
    }
    const col = MapaMundo.#leerColores(j._tilesetCanvas);
    const d = this.#imagen.data, C = this.#celdas;
    const tiles = j.tilemap.data, fondo = j.fondo, F = j.fluidos, cielo = j.light.skyRow;
    const [cR, cG, cB] = MapaMundo.CIELO, [aR, aG, aB] = MapaMundo.AIRE_CUEVA;
    const K = MapaMundo.OSCURECER_FONDO;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c, o = i * 4;
        d[o + 3] = 255;
        if (!C[i]) {
          d[o] = d[o + 1] = d[o + 2] = 0;
          continue;
        }
        // fondo de la celda: cielo, pared de fondo o aire de cueva
        let R, G, B;
        const fl = F.tipo(c, r);
        if (fl) [R, G, B] = fl === 2 ? MapaMundo.LAVA : MapaMundo.AGUA;
        else if (fondo[i] && col[fondo[i]]) {
          const p = col[fondo[i]];
          R = p.r * K;
          G = p.g * K;
          B = p.b * K;
        } else if (r < cielo[c]) {
          R = cR;
          G = cG;
          B = cB;
        } else {
          R = aR;
          G = aG;
          B = aB;
        }
        // el bloque encima (los que no tapan toda la celda se mezclan)
        const p = tiles[i] && col[tiles[i]];
        if (p) {
          R += (p.r - R) * p.k;
          G += (p.g - G) * p.k;
          B += (p.b - B) * p.k;
        } else if (tiles[i]) R = G = B = 128;
        d[o] = R;
        d[o + 1] = G;
        d[o + 2] = B;
      }
    }
    this.#ctx.putImageData(this.#imagen, 0, 0);
    return this.#canvas;
  }
}

export class VistaMapa {
  static ZOOM_INICIAL = 4; // px de pantalla por celda
  static ZOOM_MAX = 16;
  static PASO_BOTON = 1.5;

  #cv;
  #ctx;
  #info;
  #juego = null;
  #img = null;
  #z = VistaMapa.ZOOM_INICIAL;
  #cx = 0; // celda en el centro de la vista
  #cy = 0;
  #punteros = new Map(); // pointerId → { x, y }
  #pellizco = null; // distancia inicial entre dos dedos

  constructor(ui) {
    this.#cv = ui.mapaCanvas;
    this.#ctx = this.#cv.getContext('2d');
    this.#info = ui.mapaInfo;
    const cv = this.#cv;
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try {
        cv.setPointerCapture(e.pointerId);
      } catch {}
      this.#punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.#pellizco = null;
    });
    cv.addEventListener('pointermove', (e) => this.#mover(e));
    const soltar = (e) => {
      this.#punteros.delete(e.pointerId);
      this.#pellizco = null;
    };
    cv.addEventListener('pointerup', soltar);
    cv.addEventListener('pointercancel', soltar);
    cv.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const r = cv.getBoundingClientRect();
        this.#zoomEn(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX - r.left, e.clientY - r.top);
      },
      { passive: false },
    );
    ui.mapaMas.addEventListener('click', () => this.#zoomEn(VistaMapa.PASO_BOTON));
    ui.mapaMenos.addEventListener('click', () => this.#zoomEn(1 / VistaMapa.PASO_BOTON));
    ui.mapaCentrar.addEventListener('click', () => {
      this.#centrarEnJugador();
      this.dibujar();
    });
    if (typeof ResizeObserver === 'function') new ResizeObserver(() => this.#juego && this.dibujar()).observe(cv);
  }

  abrir(juego) {
    this.#juego = juego;
    this.#img = juego.mapa.dibujar(juego);
    this.#z = Math.max(this.#zMin, Math.min(VistaMapa.ZOOM_MAX, this.#z));
    this.#centrarEnJugador();
    this.dibujar();
  }

  cerrar() {
    this.#juego = null;
    this.#punteros.clear();
  }

  get #tam() {
    return { W: this.#cv.clientWidth || 1, H: this.#cv.clientHeight || 1 };
  }

  // zoom mínimo: el mundo entero entra en la vista
  get #zMin() {
    const { W, H } = this.#tam;
    return Math.min(W / SurviConfig.COLS, H / SurviConfig.ROWS);
  }

  #centrarEnJugador() {
    const p = this.#juego.player, T = SurviConfig.TILE;
    this.#cx = (p.x + p.w / 2) / T;
    this.#cy = (p.y + p.h / 2) / T;
  }

  #mover(e) {
    const ant = this.#punteros.get(e.pointerId);
    if (!ant) return;
    e.preventDefault();
    const act = { x: e.clientX, y: e.clientY };
    this.#punteros.set(e.pointerId, act);
    if (this.#punteros.size >= 2) {
      // pellizco: zoom según cuánto se separan los dos dedos
      const [a, b] = [...this.#punteros.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.#pellizco) {
        const r = this.#cv.getBoundingClientRect();
        this.#zoomEn(dist / this.#pellizco, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      }
      this.#pellizco = dist;
      return;
    }
    this.#cx -= (act.x - ant.x) / this.#z;
    this.#cy -= (act.y - ant.y) / this.#z;
    this.dibujar();
  }

  // Zoom manteniendo quieto el punto (sx, sy) de la pantalla (por defecto, el centro).
  #zoomEn(factor, sx = null, sy = null) {
    const { W, H } = this.#tam;
    if (sx === null) {
      sx = W / 2;
      sy = H / 2;
    }
    const wx = this.#cx + (sx - W / 2) / this.#z, wy = this.#cy + (sy - H / 2) / this.#z;
    this.#z = Math.max(this.#zMin, Math.min(VistaMapa.ZOOM_MAX, this.#z * factor));
    this.#cx = wx - (sx - W / 2) / this.#z;
    this.#cy = wy - (sy - H / 2) / this.#z;
    this.dibujar();
  }

  dibujar() {
    const J = this.#juego;
    if (!J || !this.#img) return;
    const { COLS, ROWS, TILE: T } = SurviConfig;
    const { W, H } = this.#tam, dpr = globalThis.devicePixelRatio || 1;
    const cv = this.#cv, ctx = this.#ctx;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
    }
    const z = this.#z;
    // que no se pueda arrastrar el mundo fuera de la vista
    this.#cx = Math.max(Math.min(W / 2 / z, COLS / 2), Math.min(COLS - Math.min(W / 2 / z, COLS / 2), this.#cx));
    this.#cy = Math.max(Math.min(H / 2 / z, ROWS / 2), Math.min(ROWS - Math.min(H / 2 / z, ROWS / 2), this.#cy));
    const x0 = W / 2 - this.#cx * z, y0 = H / 2 - this.#cy * z;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.#img, x0, y0, COLS * z, ROWS * z);
    // cama
    if (J.cama && J.mapa.explorada(J.cama.col, J.cama.row)) {
      VistaMapa.#marca(ctx, x0 + (J.cama.col + 1) * z, y0 + (J.cama.row + 0.5) * z, '#e0563a', 4);
    }
    // jugador (siempre encima)
    const p = J.player;
    VistaMapa.#marca(ctx, x0 + ((p.x + p.w / 2) / T) * z, y0 + ((p.y + p.h / 2) / T) * z, '#f5c518', 5);
    if (this.#info) {
      const x = Math.floor((p.x + p.w / 2) / T) - COLS / 2;
      const y = SurviConfig.COORD_Y0_FILA - Math.floor((p.y + p.h - 1) / T);
      this.#info.textContent = `X ${x} · Y ${y} · Explorado ${J.mapa.porcentaje.toFixed(1)}%`;
    }
  }

  // Cuadradito con borde oscuro, del mismo tamaño en pantalla con cualquier zoom.
  static #marca(ctx, x, y, color, r) {
    x = Math.round(x);
    y = Math.round(y);
    ctx.fillStyle = '#111';
    ctx.fillRect(x - r - 1, y - r - 1, r * 2 + 2, r * 2 + 2);
    ctx.fillStyle = color;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}
