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
        this.drawBranchH(pal, 7, 3, 8, 16);
        this.leafBlob(pal, 5, 7, 5, rnd);
        break;
      case 'LARM_R':
        this.drawBranchH(pal, 7, 3, 0, 8);
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
        // rama que termina en una matita
        this.drawBranchH(pal, 8, 2, 0, 10);
        this.leafBlob(pal, 11, 7, 4, rnd);
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
      for (const p of [...SurviConfig.LEAF_PIECES, ...SurviConfig.WOOD_PIECES])
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
    return canvas;
  }
}
