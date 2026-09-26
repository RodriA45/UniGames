// ══════════════════════════════════════════════════════════════
//   Pixel Survi — survi_proc_tiles.js
//   Clase TilesetProcedural: tileset COMPLETO generado por código (ya no
//   existe tiles.png). La instancia es el "pincel": guarda el contexto y
//   la celda donde se está dibujando (ctx, x, y, ts), y cada método dibuja
//   un tipo de bloque en esa celda.
//     new TilesetProcedural(TILESET_COLS, TILE).construir()  → <canvas>
//   Se dibuja UNA sola vez al arrancar el mundo sobre un <canvas> con el
//   mismo layout de siempre (id-1 = índice, TILESET_COLS columnas) y se
//   registra con Engine2D.setImage(TILESET.src, canvas): el TileMap lo
//   dibuja con drawImage como si fuera una imagen normal.
//
//   Los colores están todos arriba como constantes para ajustarlos a ojo.
//   Cada tile usa ruido con semilla fija (su id), así se ve siempre igual.
// ══════════════════════════════════════════════════════════════

import { SurviConfig } from './survi_config.js';
import { GeneradorMundo } from './survi_world.js';

export class TilesetProcedural {
  // ─── Paletas ───
  static DIRT = {
    base: '#7a4a2b',
    spk: ['#6a3f24', '#8a5836'],
  };
  static SAND = {
    base: '#dfc36b',
    spk: ['#cfb05a', '#ecd489'],
  };
  static GRAVEL = {
    base: '#86827c',
    spk: ['#6b6762', '#a39f98', '#5a5652'],
  };
  static CAVE = {
    base: '#4b4a55',
    spk: ['#3f3e48', '#5a5966'],
    edge: '#6c6b78',
  };
  // Tira de borde (de afuera hacia adentro) de cada familia "tierra con capa".
  static TOP_STRIP = {
    grass: ['#e8ffcf', '#5bab3d', '#2f6b1f'],
    // blanco-verdoso / verde / verde oscuro
    snow: ['#ffffff', '#e6f2ff', '#b9d3ea'],
    jgrass: ['#c9ff7a', '#3fa23a', '#1d5e22'],
  };
  static STONE_BASES = ['#8b8b93', '#85858f', '#91919a', '#88878f'];
  static STONE_SPK = ['#74747c', '#a3a3ab'];
  static DARK_BASES = ['#4a4a56', '#45444f', '#504f5c', '#474655'];
  static DARK_SPK = ['#393844', '#5d5c6a'];
  static ORES = {
    coal: ['#1f1f24', '#3a3a42'],
    copper_ore: ['#e07a45', '#3fb3a0'],
    // naranja con toques verdosos (óxido)
    iron: ['#d8a784', '#b27a55'],
    gold: ['#ffd23f', '#c99a0f'],
    diamond_ore: ['#7ef0ff', '#d8fbff'],
    emerald_ore: ['#2fd36b', '#b6ffcf'],
  };
  // minerales profundos: van sobre piedra oscura
  static DEEP_ORES = new Set(['diamond_ore', 'emerald_ore']);
  static TREE_PAL = {
    forest: {
      leaf: ['#3f8f45', '#2b6b34', '#1b4524'],
      wood: ['#8a5a36', '#6b4226', '#4a2c18'],
    },
    pradera: {
      leaf: ['#8fdc5a', '#5bb33d', '#357a25'],
      wood: ['#9b6a40', '#7a4f2d', '#54351d'],
    },
    jungle: {
      leaf: ['#47c26a', '#1f8f4a', '#0f5a2e'],
      wood: ['#7a5a3a', '#5c3f26', '#3c2816'],
    },
    // pino de la nieve: madera oscura, agujas verde azulado
    snow: {
      leaf: ['#4f8a6a', '#2f5e48', '#1c3b2e'],
      wood: ['#5a3d28', '#3f2a1a', '#26190f'],
    },
    // bosque oscuro: madera gris, hojas verde muy oscuro
    dark: {
      leaf: ['#3f6b45', '#27472d', '#15291a'],
      wood: ['#8d8a86', '#6b6865', '#4a4846'],
    },
  };
  // Tablones de cada madera (claro, medio, oscuro, junta).
  static PLANKS_PAL = {
    planks: ['#c9975e', '#b8854e', '#a0713f', '#5e3f20'],
    planks_snow: ['#7a5436', '#65452c', '#533823', '#2c1d12'],
    planks_dark: ['#a8a5a0', '#94918c', '#7d7a76', '#4a4846'],
  };
  // Bordes expuestos de cada pieza de terreno (mismo significado que
  // MASK_PIECE.terrain en survi_config.js).
  static EDGES = {
    C: [],
    T: ['top'],
    B: ['bottom'],
    L: ['left'],
    R: ['right'],
    TL: ['top', 'left'],
    TR: ['top', 'right'],
    BL: ['bottom', 'left'],
    BR: ['bottom', 'right'],
    S: ['top', 'bottom', 'left', 'right'],
  };
  // Bordes expuestos de las hojas (mismo significado que MASK_PIECE.leaf).
  static LEAF_EDGES = {
    LTL: ['top', 'left'],
    LT: ['top'],
    LTR: ['top', 'right'],
    LL: ['left'],
    LC: [],
    LR: ['right'],
    LL2: ['left'],
    LC2: [],
    LR2: ['right'],
    LBL: ['bottom', 'left'],
    LB: ['bottom'],
    LBR: ['bottom', 'right'],
    LVT: ['top', 'left', 'right'],
    LVM: ['left', 'right'],
    LVB: ['bottom', 'left', 'right'],
    LBLOB: ['top', 'bottom', 'left', 'right'],
  };
  constructor(tilesetCols, tileSize) {
    this.cols = tilesetCols; // columnas del atlas
    this.ts = tileSize; // lado de un tile en px
    this.ctx = null; // contexto del canvas que se está armando
    this.x = 0; // esquina de la celda actual
    this.y = 0;
  }

  // ══════════════ helpers ══════════════
  rect(x, y, w, h, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(this.x + x, this.y + y, w, h);
  }

  speckle(colors, count, rnd) {
    for (let i = 0; i < count; i++) {
      this.rect(
        Math.floor(rnd() * this.ts),
        Math.floor(rnd() * this.ts),
        1,
        1,
        colors[Math.floor(rnd() * colors.length)],
      );
    }
  }

  edgeStrip(edge, colors) {
    const s = this.ts;
    colors.forEach((c, i) => {
      if (edge === 'top') this.rect(0, i, s, 1, c);
      if (edge === 'bottom') this.rect(0, s - 1 - i, s, 1, c);
      if (edge === 'left') this.rect(i, 0, 1, s, c);
      if (edge === 'right') this.rect(s - 1 - i, 0, 1, s, c);
    });
  }

  // Esquina redondeada: borra un pixel en la esquina donde se juntan 2
  // bordes expuestos (queda menos "cuadrado").
  roundCorners(edges) {
    const has = (e) => edges.includes(e);
    const s = this.ts;
    const clear = (x, y) => this.ctx.clearRect(this.x + x, this.y + y, 1, 1);
    if (has('top') && has('left')) clear(0, 0);
    if (has('top') && has('right')) clear(s - 1, 0);
    if (has('bottom') && has('left')) clear(0, s - 1);
    if (has('bottom') && has('right')) clear(s - 1, s - 1);
  }

  // ══════════════ bloques ══════════════
  drawDirt(rnd) {
    this.rect(0, 0, this.ts, this.ts, TilesetProcedural.DIRT.base);
    this.speckle(TilesetProcedural.DIRT.spk, 14, rnd);
  }

  drawTerrainPiece(fam, piece, rnd) {
    const edges = TilesetProcedural.EDGES[piece] || [];
    if (fam === 'sand') {
      this.rect(0, 0, this.ts, this.ts, TilesetProcedural.SAND.base);
      this.speckle(TilesetProcedural.SAND.spk, 12, rnd);
    } else if (fam === 'cave') {
      this.rect(0, 0, this.ts, this.ts, TilesetProcedural.CAVE.base);
      this.speckle(TilesetProcedural.CAVE.spk, 14, rnd);
      for (const e of edges) this.edgeStrip(e, [TilesetProcedural.CAVE.edge]);
    } else {
      // grass / snow / jgrass: tierra + tira de color en los bordes expuestos
      this.drawDirt(rnd);
      for (const e of edges) this.edgeStrip(e, TilesetProcedural.TOP_STRIP[fam]);
    }
    this.roundCorners(edges);
  }

  drawStone(base, spk, rnd, crack) {
    this.rect(0, 0, this.ts, this.ts, base);
    this.speckle(spk, 16, rnd);
    if (crack) {
      // grieta corta en diagonal
      let x = 3 + Math.floor(rnd() * 6),
        y = 3 + Math.floor(rnd() * 4);
      for (let i = 0; i < 6; i++) {
        this.rect(x, y, 1, 1, spk[0]);
        x += rnd() < 0.5 ? 1 : 0;
        y += 1;
      }
    }
  }

  drawOre(ore, rnd) {
    if (TilesetProcedural.DEEP_ORES.has(ore))
      this.drawStone(TilesetProcedural.DARK_BASES[0], TilesetProcedural.DARK_SPK, rnd, false);
    else this.drawStone(TilesetProcedural.STONE_BASES[0], TilesetProcedural.STONE_SPK, rnd, false);
    const [c1, c2] = TilesetProcedural.ORES[ore];
    for (let k = 0; k < 4; k++) {
      const x = 2 + Math.floor(rnd() * 11),
        y = 2 + Math.floor(rnd() * 11);
      this.rect(x, y, 2, 2, c1);
      this.rect(x + 1, y + 1, 1, 1, c2);
    }
  }

  drawIce(rnd) {
    this.rect(0, 0, this.ts, this.ts, '#a9dcf2');
    this.speckle(['#93cde6'], 8, rnd);
    for (let i = 0; i < 5; i++) this.rect(3 + i, 9 - i, 1, 1, '#e4f7ff');
    for (let i = 0; i < 3; i++) this.rect(9 + i, 13 - i, 1, 1, '#e4f7ff');
  }

  drawBedrock(rnd) {
    this.rect(0, 0, this.ts, this.ts, '#2a2a30');
    this.speckle(['#1a1a1f', '#3c3c44'], 26, rnd);
  }

  drawGravel(rnd) {
    this.rect(0, 0, this.ts, this.ts, TilesetProcedural.GRAVEL.base);
    this.speckle(TilesetProcedural.GRAVEL.spk, 30, rnd);
  }

  drawCactus() {
    this.rect(4, 0, 8, 16, '#3f9b3a');
    this.rect(6, 0, 1, 16, '#2c7a2a');
    this.rect(9, 0, 1, 16, '#2c7a2a');
    this.rect(4, 0, 1, 16, '#2c7a2a');
    this.rect(11, 0, 1, 16, '#5bb84f');
    for (let y = 2; y < 16; y += 4) {
      this.rect(3, y, 1, 1, '#e8f5c8');
      this.rect(12, y + 2, 1, 1, '#e8f5c8');
    }
  }

  // Antorcha: palito de madera con llama (fondo transparente, no es sólida).
  drawTorch() {
    this.rect(7, 7, 2, 9, '#6b4226'); // palo
    this.rect(7, 7, 1, 9, '#8a5a36');
    this.rect(6, 6, 4, 2, '#3a2a1c'); // cabeza (tela con brea)
    this.rect(6, 2, 4, 4, '#ff8a1c'); // llama
    this.rect(7, 1, 2, 2, '#ffb640');
    this.rect(7, 3, 2, 3, '#ffe27a'); // centro claro
    this.rect(5, 4, 1, 2, '#ff6a00');
    this.rect(10, 3, 1, 2, '#ff6a00');
  }

  // Antorcha de pared: el palo sale en diagonal desde el bloque de al lado
  // (lado = -1: bloque a la izquierda, +1: a la derecha), con la llama arriba.
  drawWallTorch(lado) {
    const X = (x) => (lado < 0 ? x : 15 - x); // se dibuja para la izquierda y se espeja
    const px = (x, y, w, h, c) => {
      for (let i = 0; i < w; i++) this.rect(X(x + i), y, 1, h, c);
    };
    // soporte de hierro clavado en la pared
    px(0, 11, 2, 2, '#4a4a52');
    px(0, 11, 2, 1, '#6c6c76');
    // palo en diagonal (de la pared hacia arriba y afuera)
    for (let i = 0; i < 6; i++) {
      px(2 + i, 12 - i, 2, 2, '#6b4226');
      px(2 + i, 12 - i, 1, 1, '#8a5a36');
    }
    // cabeza con brea
    px(7, 6, 3, 2, '#3a2a1c');
    // llama
    px(7, 2, 4, 4, '#ff8a1c');
    px(8, 1, 2, 2, '#ffb640');
    px(8, 3, 2, 3, '#ffe27a');
    px(6, 4, 1, 2, '#ff6a00');
    px(11, 3, 1, 2, '#ff6a00');
  }

  // ══════════════ decoración (pasto, flores, arbusto) ══════════════
  // Sin fondo: se ve el cielo / el bloque de atrás. Van apoyadas abajo.
  drawTallGrass(rnd, alto) {
    const verdes = ['#5bab3d', '#4a9432', '#6fc14a', '#3f8a2a'];
    for (let x = 1; x < 15; x += 1 + Math.floor(rnd() * 2)) {
      const h = Math.floor((alto ? 7 : 4) + rnd() * (alto ? 7 : 5));
      const c = verdes[Math.floor(rnd() * verdes.length)];
      const inclina = rnd() < 0.5 ? -1 : 1;
      for (let y = 0; y < h; y++) this.rect(x + (y > h * 0.6 ? inclina : 0), 15 - y, 1, 1, c);
    }
  }

  drawFlower(petalo, centro, rnd) {
    // tallos y hojitas
    this.drawTallGrass(rnd, false);
    for (const [x, h] of [[5, 9], [10, 7]]) {
      for (let y = 0; y < h; y++) this.rect(x, 15 - y, 1, 1, '#3f8a2a');
      this.rect(x + 1, 12, 1, 1, '#5bab3d');
      const cy = 15 - h - 1;
      this.rect(x - 1, cy, 3, 1, petalo);
      this.rect(x, cy - 1, 1, 3, petalo);
      this.rect(x, cy, 1, 1, centro);
    }
  }

  drawDeadBush() {
    const c = ['#8a6a3a', '#6b5130'];
    for (const [x0, dir, h] of [[7, -1, 9], [8, 1, 10], [7, -1, 5], [8, 1, 6]]) {
      let x = x0;
      for (let y = 0; y < h; y++) {
        this.rect(x, 15 - y, 1, 1, c[y % 2]);
        if (y % 3 === 2) x += dir;
      }
    }
  }

  // Pasto blanco de la nieve: matas finitas blanco-celeste.
  drawSnowGrass(rnd) {
    const c = ['#ffffff', '#dce9f5', '#b4cbe0', '#96b2cc'];
    for (let x = 1; x < 15; x += 1 + Math.floor(rnd() * 2)) {
      const h = 3 + Math.floor(rnd() * 7);
      const col = c[Math.floor(rnd() * c.length)];
      const inclina = rnd() < 0.5 ? -1 : 1;
      for (let y = 0; y < h; y++) this.rect(x + (y > h * 0.6 ? inclina : 0), 15 - y, 1, 1, col);
    }
  }

  // Montículo de nieve: lomita baja, redondeada.
  drawSnowPile(rnd) {
    for (let x = 0; x < 16; x++) {
      const d = Math.abs(x - 7.5) / 8;
      const h = Math.max(1, Math.round(6 * (1 - d * d)));
      this.rect(x, 16 - h, 1, h, '#f4f9ff');
      this.rect(x, 16 - h, 1, 1, '#ffffff');
      if (h > 2) this.rect(x, 15, 1, 1, '#cfe3f5');
    }
    this.speckle(['#dcebfa'], 5, () => 0.4 + rnd() * 0.6);
  }

  // Sandía: bloque verde con rayas oscuras.
  drawMelon(rnd) {
    this.rect(0, 0, 16, 16, '#4f9a2e');
    for (const x of [1, 5, 9, 13]) {
      for (let y = 0; y < 16; y++) this.rect(x + (y % 5 === 0 ? 1 : 0), y, 2, 1, '#2f6b1f');
    }
    this.speckle(['#6fbe45'], 14, rnd);
    this.rect(0, 0, 16, 1, '#7fcf55');
    this.rect(0, 15, 16, 1, '#2a5a1b');
  }

  // Tablones: 4 tablas horizontales con clavos, en el color de su madera.
  drawPlanks(rnd, pal = TilesetProcedural.PLANKS_PAL.planks) {
    const [claro, medio, oscuro, junta] = pal;
    for (let t = 0; t < 4; t++) {
      const y = t * 4;
      this.rect(0, y, 16, 4, t % 2 ? oscuro : medio);
      this.rect(0, y, 16, 1, claro);
      this.rect(0, y + 3, 16, 1, junta);
      const j = (t * 7 + 3) % 16;
      this.rect(j, y, 1, 3, junta);
      this.rect((j + 3) % 16, y + 1, 1, 1, '#2a1d12'); // clavo
    }
    this.speckle([oscuro], 8, rnd);
  }

  // Escalera: dos largueros y 4 peldaños (fondo transparente).
  drawLadder() {
    const W = ['#c08a52', '#8a5e32', '#5e3f20'];
    for (const x of [2, 12]) {
      this.rect(x, 0, 2, 16, W[1]);
      this.rect(x, 0, 1, 16, W[0]);
    }
    for (const y of [1, 5, 9, 13]) {
      this.rect(4, y, 8, 2, W[1]);
      this.rect(4, y, 8, 1, W[0]);
      this.rect(4, y + 1, 8, 1, W[2]);
    }
  }

  // Poste de la mina (no sólido): tronco vertical en el medio.
  drawBeam() {
    this.rect(5, 0, 6, 16, '#8a5e32');
    this.rect(5, 0, 1, 16, '#5e3f20');
    this.rect(10, 0, 1, 16, '#5e3f20');
    this.rect(7, 0, 1, 16, '#a0713f');
    this.rect(8, 4, 1, 2, '#5e3f20');
    this.rect(8, 11, 1, 2, '#5e3f20');
  }

  // Rieles: durmientes de madera + 2 rieles de hierro, apoyados abajo.
  drawRail() {
    for (let x = 1; x < 16; x += 4) this.rect(x, 13, 2, 3, '#6b4424');
    this.rect(0, 12, 16, 1, '#9aa0aa');
    this.rect(0, 13, 16, 1, '#6c717a');
  }

  // Telaraña: hilos blancos radiales + anillos.
  drawCobweb() {
    const c = 'rgba(235,235,240,0.85)';
    for (let i = 0; i < 16; i++) {
      this.rect(i, i, 1, 1, c);
      this.rect(15 - i, i, 1, 1, c);
      this.rect(7, i, 1, 1, c);
      this.rect(i, 8, 1, 1, c);
    }
    for (const r of [3, 6]) {
      for (let a = 0; a < 24; a++) {
        const ang = (a / 24) * Math.PI * 2;
        this.rect(Math.round(7.5 + Math.cos(ang) * r), Math.round(8 + Math.sin(ang) * r), 1, 1, c);
      }
    }
  }

  // Rama con nido: el tramo de rama (a la altura de siempre, y 6..8) y
  // encima el cuenco de ramitas con huevitos asomando.
  drawNest(pal, rnd) {
    this.drawBranchH(pal, 6, 3);
    const R = ['#8a6440', '#6b4a2a', '#a37a4c', '#4f3520'];
    for (const [x, y] of [[5, 0], [8, 0], [10, 1]]) {
      this.rect(x, y, 3, 3, '#eef0e6');
      this.rect(x, y, 1, 1, '#ffffff');
      this.rect(x + 1, y + 1, 1, 1, '#b9d8e8'); // pintitas
    }
    for (let y = 2; y < 7; y++) {
      const a = y - 2;
      const m = a > 3 ? 2 : a > 2 ? 1 : 0;
      for (let x = 2 + m; x < 14 - m; x++) this.rect(x, y, 1, 1, R[Math.floor(rnd() * R.length)]);
    }
    this.rect(1, 2, 2, 1, R[1]); // ramitas sueltas
    this.rect(13, 2, 2, 1, R[1]);
  }

  // ══════════════ muebles ══════════════
  // Cama (2 bloques): mitad izquierda con cabecera y almohada, mitad derecha
  // con los pies. Colchón rojo, patas de madera.
  drawBed(mitad) {
    const W = ['#c08a52', '#8a5e32', '#5e3f20'];
    const R = ['#d64a4a', '#b53535', '#8c2626'];
    // colchón + frazada (de borde a borde entre las dos mitades)
    this.rect(0, 8, 16, 4, R[0]);
    this.rect(0, 8, 16, 1, '#e87070');
    this.rect(0, 11, 16, 1, R[2]);
    // base de madera
    this.rect(0, 12, 16, 2, W[1]);
    this.rect(0, 12, 16, 1, W[0]);
    if (mitad === 'l') {
      this.rect(0, 3, 3, 13, W[1]); // cabecera
      this.rect(0, 3, 3, 1, W[0]);
      this.rect(2, 3, 1, 13, W[2]);
      this.rect(3, 6, 6, 3, '#f2f2f2'); // almohada
      this.rect(3, 6, 6, 1, '#ffffff');
      this.rect(3, 8, 6, 1, '#d4d4d4');
      this.rect(0, 14, 2, 2, W[2]); // pata
    } else {
      this.rect(13, 6, 3, 10, W[1]); // pie de la cama
      this.rect(13, 6, 3, 1, W[0]);
      this.rect(13, 6, 1, 10, W[2]);
      this.rect(14, 14, 2, 2, W[2]);
    }
  }

  // Puerta (2 bloques de alto). Cerrada: la hoja entera con marco, tablas,
  // una ventanita arriba y el picaporte abajo. Abierta: se ve de canto
  // (una tira finita pegada al lado de las bisagras).
  drawDoor(parte, abierta) {
    const W = ['#c08a52', '#a0713f', '#8a5e32', '#5e3f20'];
    if (abierta) {
      this.rect(1, 0, 3, 16, W[2]);
      this.rect(1, 0, 1, 16, W[0]);
      this.rect(3, 0, 1, 16, W[3]);
      if (parte === 'bot') this.rect(4, 8, 1, 2, '#ffd23f'); // picaporte asomando
      this.rect(1, parte === 'top' ? 3 : 12, 3, 1, '#4a4a52'); // bisagra
      return;
    }
    this.rect(1, 0, 14, 16, W[1]);
    for (const x of [5, 10]) this.rect(x, 0, 1, 16, W[2]); // tablas
    this.rect(1, 0, 1, 16, W[0]);
    this.rect(14, 0, 1, 16, W[3]);
    if (parte === 'top') {
      this.rect(1, 0, 14, 1, W[0]);
      this.rect(4, 3, 8, 6, W[3]); // ventanita
      this.rect(5, 4, 6, 4, '#9fd3ee');
      this.rect(5, 4, 2, 1, '#d8f1ff');
      this.rect(7, 4, 1, 4, W[3]);
      this.rect(5, 6, 6, 1, W[3]);
      this.rect(1, 3, 2, 1, '#4a4a52');
    } else {
      this.rect(1, 15, 14, 1, W[3]);
      this.rect(11, 7, 2, 2, '#ffd23f'); // picaporte
      this.rect(11, 8, 2, 1, '#c99a0f');
      this.rect(1, 12, 2, 1, '#4a4a52');
    }
  }

  // ══════════════ fondo (paredes y ventana) ══════════════
  // Más oscuras que los bloques, para que se lean como "atrás".
  drawWallWood(rnd) {
    const W = ['#6e4d2c', '#5f4226', '#50371f', '#3b2816'];
    for (let t = 0; t < 4; t++) {
      this.rect(0, t * 4, 16, 4, W[t % 2]);
      this.rect(0, t * 4 + 3, 16, 1, W[3]);
      this.rect((t * 5 + 2) % 16, t * 4, 1, 3, W[3]);
    }
    this.speckle([W[2]], 6, rnd);
  }

  drawWallStone(rnd) {
    const S = ['#5b5b63', '#4f4f57', '#43434a', '#34343a'];
    this.rect(0, 0, 16, 16, S[1]);
    for (let y = 0; y < 16; y += 4) {
      this.rect(0, y + 3, 16, 1, S[3]); // ladrillos
      const off = (y / 4) % 2 ? 4 : 0;
      for (let x = off; x < 16; x += 8) this.rect(x, y, 1, 3, S[3]);
      this.rect(0, y, 16, 1, S[0]);
    }
    this.speckle([S[2]], 8, rnd);
  }

  // Ventana: marco de madera y 4 vidrios (se ve el cielo de atrás a medias).
  drawWindow() {
    const W = ['#8a5e32', '#5e3f20'];
    this.rect(0, 0, 16, 16, 'rgba(160, 215, 245, 0.35)');
    this.rect(2, 2, 3, 2, 'rgba(255,255,255,0.6)'); // brillo
    this.rect(10, 9, 2, 1, 'rgba(255,255,255,0.5)');
    this.rect(0, 0, 16, 1, W[0]);
    this.rect(0, 15, 16, 1, W[1]);
    this.rect(0, 0, 1, 16, W[0]);
    this.rect(15, 0, 1, 16, W[1]);
    this.rect(7, 0, 2, 16, W[0]); // cruz del marco
    this.rect(0, 7, 16, 2, W[0]);
  }

  // ══════════════ íconos (solo inventario) ══════════════
  drawIconBed() {
    this.rect(0, 7, 16, 4, '#d64a4a');
    this.rect(0, 7, 16, 1, '#e87070');
    this.rect(0, 11, 16, 2, '#8a5e32');
    this.rect(0, 3, 2, 12, '#8a5e32');
    this.rect(14, 6, 2, 9, '#8a5e32');
    this.rect(2, 5, 4, 2, '#f2f2f2');
  }

  drawIconDoor() {
    this.rect(4, 0, 8, 16, '#a0713f');
    this.rect(4, 0, 1, 16, '#c08a52');
    this.rect(11, 0, 1, 16, '#5e3f20');
    this.rect(6, 2, 4, 4, '#9fd3ee');
    this.rect(9, 9, 1, 2, '#ffd23f');
  }

  // Caña de pescar: vara en diagonal, carrete, hilo y anzuelo.
  drawIconRod() {
    for (let i = 0; i < 12; i++) {
      this.rect(2 + i, 14 - i, 1, 1, i < 4 ? '#5e3f20' : '#a0713f');
      this.rect(3 + i, 14 - i, 1, 1, i < 4 ? '#3f2a14' : '#8a5e32');
    }
    this.rect(4, 11, 2, 2, '#9aa0aa'); // carrete
    for (let y = 3; y < 11; y++) this.rect(14, y, 1, 1, '#e6e6e6'); // hilo
    this.rect(13, 11, 1, 1, '#c9ccd2'); // anzuelo
    this.rect(14, 12, 1, 1, '#c9ccd2');
    this.rect(15, 11, 1, 1, '#c9ccd2');
  }

  // ══════════════ cultivos ══════════════
  // Tierra arada: bloque entero con surcos arriba, más oscura si está regada.
  // (antes era 1 px más baja y los cultivos parecían flotar)
  drawFarmland(rnd, regada) {
    const base = regada ? '#4f3019' : '#6e4426', osc = regada ? '#3a2311' : '#553318', claro = regada ? '#6a4527' : '#8a5a36';
    this.rect(0, 0, 16, 16, base);
    this.speckle([osc, claro], 14, rnd);
    for (let x = 0; x < 16; x += 4) {
      this.rect(x, 0, 2, 2, osc); // surcos
      this.rect(x + 2, 0, 2, 1, claro);
    }
  }

  // Montoncito de tierra en la base de la planta (la "pega" al suelo).
  #base(xs) {
    for (const x of xs) {
      this.rect(x - 1, 15, 3, 1, '#553318');
      this.rect(x, 15, 1, 1, '#6e4426');
    }
  }

  // Tallos que crecen desde abajo: alto según la etapa (0..3).
  #tallos(etapa, colores, puntas) {
    const alto = [3, 6, 9, 12][etapa];
    const xs = [[2, 0], [5, 1], [8, -1], [11, 1], [13, 0]];
    this.#base(xs.map(([x]) => x));
    for (const [x, dh] of xs) {
      const h = Math.max(2, alto + dh);
      for (let y = 1; y <= h; y++) this.rect(x, 15 - y, 1, 1, colores[y % colores.length]);
      if (puntas) this.rect(x - 1, 15 - h, 3, 2, puntas); // espiga
    }
  }

  drawWheat(etapa) {
    const verde = ['#4f9a2e', '#5bab3d'], amarillo = ['#c9a23a', '#d9b64a'];
    if (etapa < 3) this.#tallos(etapa, verde, etapa === 2 ? '#8fbf4a' : null);
    else this.#tallos(3, amarillo, '#e8c55a'); // maduro: dorado con espigas
  }

  // Zanahoria / papa: hojas que crecen; madura se asoma lo de abajo.
  drawRaiz(etapa, tipo) {
    const hojas = tipo === 'carrot' ? ['#3fa23a', '#5bc24a'] : ['#3f8a2a', '#4f9a2e'];
    const alto = [2, 4, 6, 8][etapa];
    this.#base([5, 8, 11]);
    for (const [x, dir] of [[4, -1], [7, 0], [10, 1]]) {
      for (let y = 1; y <= alto; y++) this.rect(x + (y > alto / 2 ? dir : 0), 15 - y, 2, 1, hojas[y % 2]);
    }
    if (etapa === 3) {
      if (tipo === 'carrot') {
        this.rect(6, 12, 4, 4, '#f08a24'); // punta naranja asomando
        this.rect(7, 12, 2, 1, '#ffb45a');
      } else {
        this.rect(5, 13, 3, 3, '#c9a066'); // papitas
        this.rect(9, 13, 3, 3, '#b88e56');
        this.rect(7, 4, 2, 2, '#e8e0ff'); // florcita
      }
    }
  }

  // Tallo de sandía: crece y se abre en hojas; maduro se pone más amarillento
  // y con zarcillos a los costados (ahí brota la sandía).
  drawTalloSandia(etapa) {
    const tallo = etapa < 3 ? ['#5fae3a', '#4f9a2e'] : ['#9ea83a', '#8a9430'];
    const alto = [3, 6, 9, 11][etapa];
    this.#base([8]);
    for (let y = 1; y <= alto; y++) this.rect(7 + (y % 4 === 0 ? 1 : 0), 15 - y, 1, 1, tallo[y % 2]);
    const hoja = '#3f8a2a', hojaClara = '#5bab3d';
    if (etapa === 0) {
      this.rect(5, 11, 2, 1, hojaClara); // brotecito: dos hojitas
      this.rect(8, 11, 2, 1, hoja);
    }
    if (etapa >= 1) {
      this.rect(4, 13 - Math.min(alto, 5), 3, 2, hoja);
      this.rect(9, 14 - Math.min(alto, 4), 3, 2, hojaClara);
    }
    if (etapa >= 2) {
      this.rect(3, 15 - alto + 2, 4, 2, hojaClara);
      this.rect(9, 15 - alto + 1, 4, 2, hoja);
    }
    if (etapa === 3) {
      // zarcillos hacia los costados, a ras del suelo
      for (let x = 0; x < 6; x++) this.rect(x, 13 + (x % 2), 1, 1, '#8a9430');
      for (let x = 10; x < 16; x++) this.rect(x, 13 + (x % 2), 1, 1, '#8a9430');
    }
  }

  // ══════════════ biomas de cueva ══════════════
  // Musgo: verde con textura de matitas y algún pelito colgando abajo.
  drawMoss(rnd) {
    this.rect(0, 0, 16, 16, '#4e7d2e');
    this.speckle(['#3c6624', '#5f9338', '#6fa844', '#35591f'], 40, rnd);
    for (let x = 0; x < 16; x += 2 + Math.floor(rnd() * 2)) this.rect(x, 0, 1, 1 + Math.floor(rnd() * 2), '#7cbc4c'); // puntitas claras
  }

  // Hielo azul: más oscuro y compacto que el hielo, con vetas claras.
  drawHieloAzul(rnd) {
    this.rect(0, 0, 16, 16, '#5d9fe0');
    this.speckle(['#4f8fd2', '#78b6ef'], 14, rnd);
    for (let i = 0; i < 6; i++) this.rect(2 + i, 12 - i, 1, 1, '#c8e6ff');
    for (let i = 0; i < 4; i++) this.rect(9 + i, 6 - i, 1, 1, '#a9d6ff');
    this.rect(0, 0, 16, 1, '#86c2f5');
  }

  // Roca de goteo: marrón claro con bandas verticales.
  drawDripstone(rnd) {
    this.rect(0, 0, 16, 16, '#8a6d52');
    for (let x = 0; x < 16; x += 3) this.rect(x + Math.floor(rnd() * 2), 0, 1, 16, '#7a5f47');
    this.speckle(['#9e8064', '#6e5540', '#a88a6c'], 22, rnd);
  }

  // Pastito de cueva: más bajo y de un verde azulado.
  drawCaveGrass(rnd, alto) {
    const verdes = ['#4f9a5c', '#3f8a4e', '#62b06c', '#2f7040'];
    for (let x = 1; x < 15; x += 1 + Math.floor(rnd() * 2)) {
      const h = Math.floor((alto ? 5 : 3) + rnd() * (alto ? 6 : 4));
      const c = verdes[Math.floor(rnd() * verdes.length)];
      const inclina = rnd() < 0.5 ? -1 : 1;
      for (let y = 0; y < h; y++) this.rect(x + (y > h * 0.6 ? inclina : 0), 15 - y, 1, 1, c);
    }
  }

  // Hongo brillante: sombrero celeste luminoso con puntitos.
  drawGlowMushroom() {
    for (const [x, h, r] of [[5, 5, 3], [11, 3, 2]]) {
      this.rect(x, 16 - h, 1, h, '#d8e8e0'); // pie
      const y = 16 - h - r;
      this.rect(x - r, y + 1, r * 2 + 1, r - 1 || 1, '#5fe3d0'); // sombrero
      this.rect(x - r + 1, y, r * 2 - 1, 1, '#9ff5e8');
      this.rect(x - 1, y + 1, 1, 1, '#e8fffb');
      this.rect(x + 1, y + 1, 1, 1, '#e8fffb');
    }
    this.rect(8, 15, 1, 1, '#5fe3d0'); // brote
  }

  // Enredadera colgante (cuerpo o punta).
  drawVine(punta, rnd) {
    const hojas = ['#3f8a2a', '#5bab3d', '#4a9432'];
    for (const x0 of [4, 10]) {
      const largo = punta ? 9 + Math.floor(rnd() * 4) : 16;
      for (let y = 0; y < largo; y++) {
        const x = x0 + (Math.floor(y / 4) % 2);
        this.rect(x, y, 1, 1, '#2f6b20');
        if (y % 3 === 1) this.rect(x + (y % 2 ? 1 : -1), y, 1, 1, hojas[y % 3]);
      }
      if (punta) this.rect(x0, largo, 2, 1, '#9fd06a'); // puntita clara
    }
  }

  // Carámbano: cono de hielo colgando.
  drawIcicle() {
    for (const [x, largo, ancho] of [[4, 11, 2], [9, 14, 3], [13, 7, 1]]) {
      for (let y = 0; y < largo; y++) {
        const w = Math.max(1, Math.round(ancho * (1 - y / largo) + 0.4));
        this.rect(x - (w >> 1), y, w, 1, y < largo * 0.4 ? '#cfeeff' : '#a9dcf2');
      }
      this.rect(x, 0, 1, Math.floor(largo * 0.6), '#f0fbff'); // brillo
    }
  }

  // Estalactita / estalagmita: cono de roca. `abajo` = cuelga del techo.
  // base = el tramo ancho que se pega a la roca; si no, la punta.
  drawEstalactita(abajo, base) {
    const c = ['#8a6d52', '#a3856a', '#6e5540'];
    for (let y = 0; y < 16; y++) {
      const k = base ? 1 - y / 32 : 0.5 - y / 32; // ancho relativo (base: 1 → 0.5, punta: 0.5 → 0)
      const w = Math.max(1, Math.round(10 * k));
      const x = 8 - Math.ceil(w / 2);
      const fila = abajo ? y : 15 - y;
      this.rect(x, fila, w, 1, c[0]);
      if (w > 2) this.rect(x + 1, fila, 1, 1, c[1]); // lado iluminado
      if (w > 3) this.rect(x + w - 1, fila, 1, 1, c[2]); // lado en sombra
    }
  }

  // TNT: cajón de madera con 3 cartuchos de dinamita atados y sus mechas.
  drawTnt() {
    this.rect(0, 0, 16, 16, '#8a5e32'); // cajón
    this.rect(1, 1, 14, 14, '#3a2a1a');
    this.rect(0, 0, 16, 1, '#a0713f');
    this.rect(0, 15, 16, 1, '#6b4623');
    for (const x of [2, 6, 10]) {
      this.rect(x, 4, 4, 11, '#c9352c'); // cartucho
      this.rect(x, 4, 1, 11, '#e0574a'); // brillo
      this.rect(x + 3, 4, 1, 11, '#96231d'); // sombra
      this.rect(x + 1, 3, 2, 1, '#e8dcc0'); // tapita
      this.rect(x + 2, 1, 1, 2, '#6b5b45'); // mecha
    }
    this.rect(1, 9, 14, 2, '#d9c9a0'); // soga
    this.rect(7, 9, 2, 2, '#b8a57a'); // nudo
    this.rect(8, 0, 1, 1, '#ffb347'); // chispita
  }

  // Pólvora: montoncito gris oscuro.
  drawIconPolvora() {
    for (let x = 3; x < 13; x++) {
      const h = Math.round(5 * (1 - Math.abs(x - 7.5) / 5.5));
      this.rect(x, 13 - h, 1, h + 1, '#4a4a4f');
    }
    for (const [x, y] of [[5, 11], [8, 9], [10, 12], [7, 12], [6, 10]]) this.rect(x, y, 1, 1, '#7a7a82');
    this.rect(4, 14, 8, 1, '#35353a');
  }

  drawIconSemillasSandia() {
    for (const [x, y] of [[4, 5], [9, 4], [6, 9], [11, 9], [3, 12], [9, 12]]) {
      this.rect(x, y, 2, 3, '#2a2a22');
      this.rect(x, y, 1, 1, '#5a5a48');
    }
  }

  drawIconHoe() {
    for (let i = 0; i < 11; i++) this.rect(3 + i, 14 - i, 2, 1, '#8a5e32'); // mango
    this.rect(10, 2, 5, 2, '#9aa0aa'); // hoja de piedra
    this.rect(10, 2, 2, 4, '#7d828c');
  }

  drawIconSeeds() {
    for (const [x, y] of [[5, 6], [9, 5], [7, 9], [11, 9], [4, 11], [9, 12]]) {
      this.rect(x, y, 2, 3, '#c9a23a');
      this.rect(x, y, 1, 1, '#e8c55a');
    }
  }

  drawIconWheat() {
    for (const x of [5, 8, 11]) {
      for (let y = 7; y < 15; y++) this.rect(x, y, 1, 1, '#c9a23a');
      this.rect(x - 1, 2, 3, 5, '#e8c55a');
      this.rect(x, 3, 1, 3, '#c9a23a');
    }
    this.rect(4, 11, 9, 1, '#8a5e32'); // atadito
  }

  drawIconGlass() {
    this.rect(3, 2, 10, 12, 'rgba(170, 220, 245, 0.8)');
    this.rect(3, 2, 10, 1, '#e6f7ff');
    this.rect(3, 2, 1, 12, '#e6f7ff');
    this.rect(12, 2, 1, 12, '#7fb8d6');
    this.rect(3, 13, 10, 1, '#7fb8d6');
    this.rect(5, 4, 2, 4, '#ffffff');
  }

  // ══════════════ estaciones ══════════════
  // Mesa de crafteo: tablero con grilla 3x3 grabada, sierra y martillo
  // arriba, patas con travesaño. Fondo transparente (se pasa por delante).
  drawCraftTable() {
    const W = ['#c08a52', '#9c6a3a', '#6b4424', '#3e2614']; // madera clara → oscura

    // herramientas apoyadas arriba
    this.rect(3, 0, 5, 1, '#b8bcc4');
    this.rect(3, 1, 5, 1, '#7d828c'); // sierra
    this.rect(8, 0, 2, 2, '#6b4424');
    this.rect(11, 0, 3, 2, '#9aa0aa');
    this.rect(12, 2, 1, 1, '#6b4424'); // martillo

    // tablero
    this.rect(0, 2, 16, 5, W[1]);
    this.rect(0, 2, 16, 1, W[0]);
    this.rect(0, 6, 16, 1, W[3]);
    for (const x of [5, 10]) this.rect(x, 3, 1, 3, W[2]); // grilla grabada
    this.rect(1, 4, 14, 1, W[2]);
    this.rect(0, 2, 1, 5, W[3]);
    this.rect(15, 2, 1, 5, W[3]);
    // patas + travesaño
    for (const x of [1, 12]) {
      this.rect(x, 7, 3, 9, W[2]);
      this.rect(x, 7, 1, 9, W[1]);
      this.rect(x + 2, 7, 1, 9, W[3]);
    }
    this.rect(4, 11, 8, 2, W[2]);
    this.rect(4, 11, 8, 1, W[1]);
  }

  // Horno de piedra: ladrillos, boca abajo. Prendido: fuego adentro y
  // brillo en el marco de la boca.
  drawFurnace(lit) {
    const S = ['#9a9aa2', '#7c7c85', '#5d5d66', '#3d3d45'];
    this.rect(0, 0, 16, 16, S[1]);
    // ladrillos
    for (let y = 0; y < 16; y += 4) {
      this.rect(0, y, 16, 1, S[2]);
      const off = (y / 4) % 2 ? 4 : 0;
      for (let x = off; x < 16; x += 8) this.rect(x, y + 1, 1, 3, S[2]);
    }
    this.rect(0, 0, 16, 1, S[0]);
    this.rect(0, 0, 1, 16, S[0]);
    this.rect(15, 0, 1, 16, S[3]);
    this.rect(0, 15, 16, 1, S[3]);
    // boca
    this.rect(3, 7, 10, 7, S[3]);
    this.rect(4, 8, 8, 6, lit ? '#2a1206' : '#141418');
    this.rect(3, 6, 10, 1, S[0]);
    if (lit) {
      this.rect(3, 7, 10, 1, '#ff9a3c'); // reflejo en el marco
      this.rect(4, 12, 8, 2, '#ff6a00'); // brasas
      this.rect(5, 10, 2, 2, '#ff8a1c');
      this.rect(9, 10, 2, 2, '#ff8a1c');
      this.rect(6, 9, 1, 3, '#ffd23f');
      this.rect(9, 9, 1, 2, '#ffd23f');
      this.rect(7, 11, 2, 2, '#fff1a8');
    } else {
      this.rect(5, 12, 6, 2, '#2c2c33');
      this.rect(6, 12, 1, 1, '#4a4a52'); // cenizas
    }
    // chimenea
    this.rect(11, 1, 3, 3, S[2]);
    this.rect(12, 2, 1, 2, S[3]);
  }

  // Cofre de madera con herrajes dorados y cerradura.
  drawChest() {
    const W = ['#c08a52', '#9c6a3a', '#6b4424', '#3e2614'];
    const G = ['#ffe07a', '#d9a520', '#8a6410'];
    this.rect(1, 3, 14, 13, W[1]); // cuerpo
    this.rect(1, 3, 14, 5, W[2]); // tapa
    this.rect(1, 3, 14, 1, W[0]);
    this.rect(2, 4, 12, 1, W[1]);
    this.rect(1, 8, 14, 1, W[3]); // unión tapa/cuerpo
    for (const y of [10, 13]) this.rect(2, y, 12, 1, W[2]); // tablas
    this.rect(1, 3, 1, 13, W[3]);
    this.rect(14, 3, 1, 13, W[3]);
    this.rect(1, 15, 14, 1, W[3]);
    // herrajes
    for (const x of [2, 12]) {
      this.rect(x, 3, 2, 13, G[1]);
      this.rect(x, 3, 1, 13, G[0]);
      this.rect(x + 1, 3, 1, 13, G[2]);
    }
    // cerradura
    this.rect(6, 7, 4, 4, G[1]);
    this.rect(6, 7, 4, 1, G[0]);
    this.rect(7, 9, 2, 2, G[2]);
    this.rect(7, 9, 1, 1, '#1a1206');
  }

  // ══════════════ árboles ══════════════
  drawLeaves(pal, edges, rnd, alt) {
    const [light, mid, dark] = pal.leaf;
    this.rect(0, 0, this.ts, this.ts, mid);
    this.speckle([light], alt ? 16 : 9, rnd);
    this.speckle([dark], 9, rnd);
    for (const e of edges) this.edgeStrip(e, [dark]);
    this.roundCorners(edges);
  }

  drawTrunk(pal) {
    const [light, mid, dark] = pal.wood;
    this.rect(5, 0, 6, 16, mid);
    this.rect(5, 0, 1, 16, dark);
    this.rect(10, 0, 1, 16, dark);
    this.rect(7, 0, 1, 16, light);
    this.rect(8, 3, 1, 3, dark);
    this.rect(8, 10, 1, 3, dark);
  }

  drawBranchH(pal, y0, h, x0 = 0, x1 = 16) {
    const [light, mid, dark] = pal.wood;
    this.rect(x0, y0, x1 - x0, h, mid);
    this.rect(x0, y0, x1 - x0, 1, light);
    this.rect(x0, y0 + h - 1, x1 - x0, 1, dark);
  }

  leafBlob(pal, cx, cy, r, rnd) {
    const [light, mid, dark] = pal.leaf;
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++) {
        const d = x * x + y * y;
        if (d > r * r) continue;
        const px = cx + x,
          py = cy + y;
        if (px < 0 || py < 0 || px >= this.ts || py >= this.ts) continue;
        const c = d > (r - 1) * (r - 1) ? dark : rnd() < 0.2 ? light : mid;
        this.rect(px, py, 1, 1, c);
      }
  }

  drawTreePiece(pal, piece, rnd) {
    if (TilesetProcedural.LEAF_EDGES[piece]) {
      this.drawLeaves(pal, TilesetProcedural.LEAF_EDGES[piece], rnd, piece.endsWith('2'));
      return;
    }
    const [, , dark] = pal.wood;
    switch (piece) {
      case 'LCAN':
        // copa por donde entra el tronco
        this.drawLeaves(pal, [], rnd, false);
        this.rect(5, 11, 6, 5, pal.wood[1]);
        this.rect(5, 11, 1, 5, dark);
        this.rect(10, 11, 1, 5, dark);
        break;
      case 'LARM_L':
        // rama que sale del tronco (derecha) con follaje a la izquierda
        this.drawBranchH(pal, 6, 3, 8, 16); // (misma altura que las otras ramas: y 6..8)
        this.leafBlob(pal, 5, 7, 5, rnd);
        break;
      case 'LARM_R':
        this.drawBranchH(pal, 6, 3, 0, 8);
        this.leafBlob(pal, 10, 7, 5, rnd);
        break;
      case 'TRUNK':
        this.drawTrunk(pal);
        break;
      case 'TRUNK_K':
        // tronco con nudo
        this.drawTrunk(pal);
        this.rect(6, 6, 4, 4, dark);
        this.rect(7, 7, 2, 2, pal.wood[0]);
        break;
      case 'TRUNK_BR':
        // salida de ramas a los dos lados
        this.drawBranchH(pal, 6, 3);
        this.drawTrunk(pal);
        break;
      case 'TRUNK_R':
        // salida de rama a la derecha
        this.drawBranchH(pal, 6, 3, 10, 16);
        this.drawTrunk(pal);
        break;
      case 'TRUNK_BASE':
        // base con raíces
        this.drawTrunk(pal);
        this.rect(3, 12, 10, 4, pal.wood[1]);
        this.rect(2, 14, 2, 2, dark);
        this.rect(12, 14, 2, 2, dark);
        this.rect(3, 12, 10, 1, pal.wood[0]);
        break;
      case 'STUB':
        this.drawBranchH(pal, 7, 2, 2, 14);
        break;
      case 'BRANCH_H':
        this.drawBranchH(pal, 6, 3);
        break;
      case 'BRANCH_S':
        // rama que termina en una matita (sale de la izquierda, hacia la derecha)
        this.drawBranchH(pal, 6, 3, 0, 9);
        this.drawBranchH(pal, 7, 1, 9, 11); // punta más finita
        this.leafBlob(pal, 12, 7, 4, rnd);
        break;
      case 'BRANCH_SL':
        // igual, espejada: sale de la derecha y termina en matita a la izquierda
        this.drawBranchH(pal, 6, 3, 7, 16);
        this.drawBranchH(pal, 7, 1, 5, 7);
        this.leafBlob(pal, 3, 7, 4, rnd);
        break;
      case 'TRUNK_L':
        // salida de rama a la izquierda
        this.drawBranchH(pal, 6, 3, 0, 6);
        this.drawTrunk(pal);
        break;
      case 'STUB_R':
        // muñón pegado al tronco de la izquierda
        this.drawBranchH(pal, 6, 3, 0, 6);
        this.drawBranchH(pal, 7, 1, 6, 9);
        this.rect(8, 6, 1, 1, pal.wood[2]);
        break;
      case 'STUB_L':
        this.drawBranchH(pal, 6, 3, 10, 16);
        this.drawBranchH(pal, 7, 1, 7, 10);
        this.rect(7, 6, 1, 1, pal.wood[2]);
        break;
    }
  }

  // ══════════════ armado del tileset ══════════════
  // Devuelve un <canvas> con TODOS los tiles (TILE_COUNT) en su celda.
  construir() {
    const tilesetCols = this.cols,
      tileSize = this.ts;
    const rows = Math.ceil(SurviConfig.TILE_COUNT / tilesetCols);
    const canvas = document.createElement('canvas');
    canvas.width = tilesetCols * tileSize;
    canvas.height = rows * tileSize;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    this.ctx = ctx;
    // Mueve el "pincel" a la celda del tile `id` y devuelve su ruido.
    const at = (id) => {
      const i = id - 1;
      this.x = (i % tilesetCols) * tileSize;
      this.y = Math.floor(i / tilesetCols) * tileSize;
      return GeneradorMundo.mulberry32(id * 7919 + 17); // ruido estable por tile
    };
    for (const fam of SurviConfig.FAM_KEYS) {
      for (const p of SurviConfig.FAM_PIECES) this.drawTerrainPiece(fam, p, at(SurviConfig.TID[`${fam}_${p}`]));
    }
    this.drawDirt(at(SurviConfig.TID.dirt));
    this.drawStone(TilesetProcedural.STONE_BASES[0], TilesetProcedural.STONE_SPK, at(SurviConfig.TID.stone), false);
    this.drawIce(at(SurviConfig.TID.ice));
    this.drawBedrock(at(SurviConfig.TID.bedrock));
    for (const ore of Object.keys(TilesetProcedural.ORES)) this.drawOre(ore, at(SurviConfig.TID[ore]));
    at(SurviConfig.TID.cactus);
    this.drawCactus();
    this.drawGravel(at(SurviConfig.TID.gravel));
    SurviConfig.STONE_VARIANT_KEYS.forEach((k, i) =>
      this.drawStone(TilesetProcedural.STONE_BASES[i], TilesetProcedural.STONE_SPK, at(SurviConfig.TID[k]), i === 2),
    );
    SurviConfig.DARK_STONE_VARIANT_KEYS.forEach((k, i) =>
      this.drawStone(TilesetProcedural.DARK_BASES[i], TilesetProcedural.DARK_SPK, at(SurviConfig.TID[k]), i === 2),
    );
    for (const tree of SurviConfig.TREE_KEYS) {
      const pal = TilesetProcedural.TREE_PAL[tree];
      for (const p of [...SurviConfig.LEAF_PIECES, ...SurviConfig.WOOD_PIECES_ALL])
        this.drawTreePiece(pal, p, at(SurviConfig.TID[`${tree}_${p}`]));
    }
    at(SurviConfig.TID.torch);
    this.drawTorch();
    at(SurviConfig.TID.craft_table);
    this.drawCraftTable();
    at(SurviConfig.TID.furnace);
    this.drawFurnace(false);
    at(SurviConfig.TID.furnace_on);
    this.drawFurnace(true);
    at(SurviConfig.TID.chest);
    this.drawChest();
    at(SurviConfig.TID.torch_wl);
    this.drawWallTorch(-1);
    at(SurviConfig.TID.torch_wr);
    this.drawWallTorch(1);
    this.drawTallGrass(at(SurviConfig.TID.tallgrass), false);
    this.drawTallGrass(at(SurviConfig.TID.tallgrass2), true);
    this.drawFlower('#e5483b', '#ffd23f', at(SurviConfig.TID.flower_red));
    this.drawFlower('#ffd23f', '#c9761a', at(SurviConfig.TID.flower_yellow));
    this.drawFlower('#5a8cff', '#ffffff', at(SurviConfig.TID.flower_blue));
    at(SurviConfig.TID.deadbush);
    this.drawDeadBush();
    this.drawSnowGrass(at(SurviConfig.TID.snowgrass));
    this.drawSnowPile(at(SurviConfig.TID.snowpile));
    this.drawMelon(at(SurviConfig.TID.melon));
    this.drawPlanks(at(SurviConfig.TID.planks));
    this.drawPlanks(at(SurviConfig.TID.planks_snow), TilesetProcedural.PLANKS_PAL.planks_snow);
    this.drawPlanks(at(SurviConfig.TID.planks_dark), TilesetProcedural.PLANKS_PAL.planks_dark);
    at(SurviConfig.TID.ladder);
    this.drawLadder();
    for (const t of SurviConfig.TREE_KEYS) this.drawNest(TilesetProcedural.TREE_PAL[t], at(SurviConfig.TID[`${t}_NEST`]));
    at(SurviConfig.TID.beam);
    this.drawBeam();
    at(SurviConfig.TID.rail);
    this.drawRail();
    at(SurviConfig.TID.cobweb);
    this.drawCobweb();
    at(SurviConfig.TID.bed_l);
    this.drawBed('l');
    at(SurviConfig.TID.bed_r);
    this.drawBed('r');
    at(SurviConfig.TID.door_bot);
    this.drawDoor('bot', false);
    at(SurviConfig.TID.door_top);
    this.drawDoor('top', false);
    at(SurviConfig.TID.door_bot_o);
    this.drawDoor('bot', true);
    at(SurviConfig.TID.door_top_o);
    this.drawDoor('top', true);
    this.drawWallWood(at(SurviConfig.TID.wall_wood));
    this.drawWallStone(at(SurviConfig.TID.wall_stone));
    at(SurviConfig.TID.window);
    this.drawWindow();
    at(SurviConfig.TID.icon_bed);
    this.drawIconBed();
    at(SurviConfig.TID.icon_door);
    this.drawIconDoor();
    at(SurviConfig.TID.icon_glass);
    this.drawIconGlass();
    at(SurviConfig.TID.icon_rod);
    this.drawIconRod();
    this.drawFarmland(at(SurviConfig.TID.farmland), false);
    this.drawFarmland(at(SurviConfig.TID.farmland_wet), true);
    for (let e = 0; e < 4; e++) {
      at(SurviConfig.TID[`wheat_${e}`]);
      this.drawWheat(e);
      at(SurviConfig.TID[`carrot_${e}`]);
      this.drawRaiz(e, 'carrot');
      at(SurviConfig.TID[`potato_${e}`]);
      this.drawRaiz(e, 'potato');
    }
    at(SurviConfig.TID.icon_hoe);
    this.drawIconHoe();
    at(SurviConfig.TID.icon_seeds);
    this.drawIconSeeds();
    at(SurviConfig.TID.icon_wheat);
    this.drawIconWheat();
    for (let e = 0; e < 4; e++) {
      at(SurviConfig.TID[`melon_${e}`]);
      this.drawTalloSandia(e);
    }
    at(SurviConfig.TID.icon_melon_seeds);
    this.drawIconSemillasSandia();
    // biomas de cueva
    const T = SurviConfig.TID;
    this.drawMoss(at(T.moss));
    this.drawHieloAzul(at(T.hielo_azul));
    this.drawDripstone(at(T.dripstone));
    this.drawCaveGrass(at(T.cave_grass), false);
    this.drawCaveGrass(at(T.cave_grass2), true);
    at(T.glow_mushroom);
    this.drawGlowMushroom();
    this.drawVine(false, at(T.vine));
    this.drawVine(true, at(T.vine_end));
    at(T.icicle);
    this.drawIcicle();
    at(T.stalactite_base);
    this.drawEstalactita(true, true);
    at(T.stalactite_tip);
    this.drawEstalactita(true, false);
    at(T.stalagmite_base);
    this.drawEstalactita(false, true);
    at(T.stalagmite_tip);
    this.drawEstalactita(false, false);
    at(T.tnt);
    this.drawTnt();
    at(T.icon_polvora);
    this.drawIconPolvora();
    return canvas;
  }
}
