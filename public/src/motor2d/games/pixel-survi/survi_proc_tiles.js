// ══════════════════════════════════════════════════════════════
//   Pixel Survi — survi_proc_tiles.js
//   Tileset COMPLETO generado por código: ya no existe tiles.png.
//   Se dibuja UNA sola vez al arrancar el mundo sobre un <canvas> con el
//   mismo layout de siempre (id-1 = índice, TILESET_COLS columnas) y se
//   registra con Engine2D.setImage(TILESET.src, canvas): el TileMap lo
//   dibuja con drawImage como si fuera una imagen normal.
//
//   Los colores están todos arriba como constantes para ajustarlos a ojo.
//   Cada tile usa ruido con semilla fija (su id), así se ve siempre igual.
// ══════════════════════════════════════════════════════════════

import {
  TID, TILE_COUNT, FAM_PIECES, FAM_KEYS, TREE_KEYS, LEAF_PIECES, WOOD_PIECES,
  STONE_VARIANT_KEYS, DARK_STONE_VARIANT_KEYS
} from './survi_config.js';
import { mulberry32 } from './survi_world.js';

// ─── Paletas ───
const DIRT   = { base: '#7a4a2b', spk: ['#6a3f24', '#8a5836'] };
const SAND   = { base: '#dfc36b', spk: ['#cfb05a', '#ecd489'] };
const GRAVEL = { base: '#86827c', spk: ['#6b6762', '#a39f98', '#5a5652'] };
const CAVE   = { base: '#4b4a55', spk: ['#3f3e48', '#5a5966'], edge: '#6c6b78' };

// Tira de borde (de afuera hacia adentro) de cada familia "tierra con capa".
const TOP_STRIP = {
  grass:  ['#e8ffcf', '#5bab3d', '#2f6b1f'],       // blanco-verdoso / verde / verde oscuro
  snow:   ['#ffffff', '#e6f2ff', '#b9d3ea'],
  jgrass: ['#c9ff7a', '#3fa23a', '#1d5e22']
};

const STONE_BASES = ['#8b8b93', '#85858f', '#91919a', '#88878f'];
const STONE_SPK   = ['#74747c', '#a3a3ab'];
const DARK_BASES  = ['#4a4a56', '#45444f', '#504f5c', '#474655'];
const DARK_SPK    = ['#393844', '#5d5c6a'];

const ORES = {
  coal:        ['#1f1f24', '#3a3a42'],
  copper_ore:  ['#e07a45', '#3fb3a0'],   // naranja con toques verdosos (óxido)
  iron:        ['#d8a784', '#b27a55'],
  gold:        ['#ffd23f', '#c99a0f'],
  diamond_ore: ['#7ef0ff', '#d8fbff'],
  emerald_ore: ['#2fd36b', '#b6ffcf']
};
// minerales profundos: van sobre piedra oscura
const DEEP_ORES = new Set(['diamond_ore', 'emerald_ore']);

const TREE_PAL = {
  forest:  { leaf: ['#3f8f45', '#2b6b34', '#1b4524'], wood: ['#8a5a36', '#6b4226', '#4a2c18'] },
  pradera: { leaf: ['#8fdc5a', '#5bb33d', '#357a25'], wood: ['#9b6a40', '#7a4f2d', '#54351d'] },
  jungle:  { leaf: ['#47c26a', '#1f8f4a', '#0f5a2e'], wood: ['#7a5a3a', '#5c3f26', '#3c2816'] }
};

// Bordes expuestos de cada pieza de terreno (mismo significado que
// MASK_PIECE.terrain en survi_config.js).
const EDGES = {
  C: [], T: ['top'], B: ['bottom'], L: ['left'], R: ['right'],
  TL: ['top', 'left'], TR: ['top', 'right'], BL: ['bottom', 'left'], BR: ['bottom', 'right'],
  S: ['top', 'bottom', 'left', 'right']
};
// Bordes expuestos de las hojas (mismo significado que MASK_PIECE.leaf).
const LEAF_EDGES = {
  LTL: ['top', 'left'], LT: ['top'], LTR: ['top', 'right'],
  LL: ['left'], LC: [], LR: ['right'],
  LL2: ['left'], LC2: [], LR2: ['right'],
  LBL: ['bottom', 'left'], LB: ['bottom'], LBR: ['bottom', 'right'],
  LVT: ['top', 'left', 'right'], LVM: ['left', 'right'], LVB: ['bottom', 'left', 'right'],
  LBLOB: ['top', 'bottom', 'left', 'right']
};

// ══════════════ helpers ══════════════
function makeTile(ts) {
  return { ctx: null, x: 0, y: 0, ts };
}
function rect(t, x, y, w, h, color) {
  t.ctx.fillStyle = color;
  t.ctx.fillRect(t.x + x, t.y + y, w, h);
}
function speckle(t, colors, count, rnd) {
  for (let i = 0; i < count; i++) {
    rect(t, Math.floor(rnd() * t.ts), Math.floor(rnd() * t.ts), 1, 1, colors[Math.floor(rnd() * colors.length)]);
  }
}
function edgeStrip(t, edge, colors) {
  const s = t.ts;
  colors.forEach((c, i) => {
    if (edge === 'top')    rect(t, 0, i, s, 1, c);
    if (edge === 'bottom') rect(t, 0, s - 1 - i, s, 1, c);
    if (edge === 'left')   rect(t, i, 0, 1, s, c);
    if (edge === 'right')  rect(t, s - 1 - i, 0, 1, s, c);
  });
}
// Esquina redondeada: borra un pixel en la esquina donde se juntan 2
// bordes expuestos (queda menos "cuadrado").
function roundCorners(t, edges) {
  const has = (e) => edges.includes(e);
  const s = t.ts;
  const clear = (x, y) => t.ctx.clearRect(t.x + x, t.y + y, 1, 1);
  if (has('top') && has('left'))     clear(0, 0);
  if (has('top') && has('right'))    clear(s - 1, 0);
  if (has('bottom') && has('left'))  clear(0, s - 1);
  if (has('bottom') && has('right')) clear(s - 1, s - 1);
}

// ══════════════ bloques ══════════════
function drawDirt(t, rnd) {
  rect(t, 0, 0, t.ts, t.ts, DIRT.base);
  speckle(t, DIRT.spk, 14, rnd);
}

function drawTerrainPiece(t, fam, piece, rnd) {
  const edges = EDGES[piece] || [];
  if (fam === 'sand') {
    rect(t, 0, 0, t.ts, t.ts, SAND.base);
    speckle(t, SAND.spk, 12, rnd);
  } else if (fam === 'cave') {
    rect(t, 0, 0, t.ts, t.ts, CAVE.base);
    speckle(t, CAVE.spk, 14, rnd);
    for (const e of edges) edgeStrip(t, e, [CAVE.edge]);
  } else {
    // grass / snow / jgrass: tierra + tira de color en los bordes expuestos
    drawDirt(t, rnd);
    for (const e of edges) edgeStrip(t, e, TOP_STRIP[fam]);
  }
  roundCorners(t, edges);
}

function drawStone(t, base, spk, rnd, crack) {
  rect(t, 0, 0, t.ts, t.ts, base);
  speckle(t, spk, 16, rnd);
  if (crack) {
    // grieta corta en diagonal
    let x = 3 + Math.floor(rnd() * 6), y = 3 + Math.floor(rnd() * 4);
    for (let i = 0; i < 6; i++) {
      rect(t, x, y, 1, 1, spk[0]);
      x += rnd() < 0.5 ? 1 : 0; y += 1;
    }
  }
}

function drawOre(t, ore, rnd) {
  if (DEEP_ORES.has(ore)) drawStone(t, DARK_BASES[0], DARK_SPK, rnd, false);
  else drawStone(t, STONE_BASES[0], STONE_SPK, rnd, false);
  const [c1, c2] = ORES[ore];
  for (let k = 0; k < 4; k++) {
    const x = 2 + Math.floor(rnd() * 11), y = 2 + Math.floor(rnd() * 11);
    rect(t, x, y, 2, 2, c1);
    rect(t, x + 1, y + 1, 1, 1, c2);
  }
}

function drawIce(t, rnd) {
  rect(t, 0, 0, t.ts, t.ts, '#a9dcf2');
  speckle(t, ['#93cde6'], 8, rnd);
  for (let i = 0; i < 5; i++) rect(t, 3 + i, 9 - i, 1, 1, '#e4f7ff');
  for (let i = 0; i < 3; i++) rect(t, 9 + i, 13 - i, 1, 1, '#e4f7ff');
}

function drawBedrock(t, rnd) {
  rect(t, 0, 0, t.ts, t.ts, '#2a2a30');
  speckle(t, ['#1a1a1f', '#3c3c44'], 26, rnd);
}

function drawGravel(t, rnd) {
  rect(t, 0, 0, t.ts, t.ts, GRAVEL.base);
  speckle(t, GRAVEL.spk, 30, rnd);
}

function drawCactus(t) {
  rect(t, 4, 0, 8, 16, '#3f9b3a');
  rect(t, 6, 0, 1, 16, '#2c7a2a');
  rect(t, 9, 0, 1, 16, '#2c7a2a');
  rect(t, 4, 0, 1, 16, '#2c7a2a');
  rect(t, 11, 0, 1, 16, '#5bb84f');
  for (let y = 2; y < 16; y += 4) { rect(t, 3, y, 1, 1, '#e8f5c8'); rect(t, 12, y + 2, 1, 1, '#e8f5c8'); }
}

// Antorcha: palito de madera con llama (fondo transparente, no es sólida).
function drawTorch(t) {
  rect(t, 7, 7, 2, 9, '#6b4226');      // palo
  rect(t, 7, 7, 1, 9, '#8a5a36');
  rect(t, 6, 6, 4, 2, '#3a2a1c');      // cabeza (tela con brea)
  rect(t, 6, 2, 4, 4, '#ff8a1c');      // llama
  rect(t, 7, 1, 2, 2, '#ffb640');
  rect(t, 7, 3, 2, 3, '#ffe27a');      // centro claro
  rect(t, 5, 4, 1, 2, '#ff6a00');
  rect(t, 10, 3, 1, 2, '#ff6a00');
}

// ══════════════ estaciones ══════════════
// Mesa de crafteo: tablero con grilla 3x3 grabada, sierra y martillo
// arriba, patas con travesaño. Fondo transparente (se pasa por delante).
function drawCraftTable(t) {
  const W = ['#c08a52', '#9c6a3a', '#6b4424', '#3e2614'];   // madera clara → oscura
  // herramientas apoyadas arriba
  rect(t, 3, 0, 5, 1, '#b8bcc4'); rect(t, 3, 1, 5, 1, '#7d828c');     // sierra
  rect(t, 8, 0, 2, 2, '#6b4424');
  rect(t, 11, 0, 3, 2, '#9aa0aa'); rect(t, 12, 2, 1, 1, '#6b4424');   // martillo
  // tablero
  rect(t, 0, 2, 16, 5, W[1]);
  rect(t, 0, 2, 16, 1, W[0]);
  rect(t, 0, 6, 16, 1, W[3]);
  for (const x of [5, 10]) rect(t, x, 3, 1, 3, W[2]);          // grilla grabada
  rect(t, 1, 4, 14, 1, W[2]);
  rect(t, 0, 2, 1, 5, W[3]); rect(t, 15, 2, 1, 5, W[3]);
  // patas + travesaño
  for (const x of [1, 12]) { rect(t, x, 7, 3, 9, W[2]); rect(t, x, 7, 1, 9, W[1]); rect(t, x + 2, 7, 1, 9, W[3]); }
  rect(t, 4, 11, 8, 2, W[2]); rect(t, 4, 11, 8, 1, W[1]);
}

// Horno de piedra: ladrillos, boca abajo. Prendido: fuego adentro y
// brillo en el marco de la boca.
function drawFurnace(t, lit) {
  const S = ['#9a9aa2', '#7c7c85', '#5d5d66', '#3d3d45'];
  rect(t, 0, 0, 16, 16, S[1]);
  // ladrillos
  for (let y = 0; y < 16; y += 4) {
    rect(t, 0, y, 16, 1, S[2]);
    const off = (y / 4) % 2 ? 4 : 0;
    for (let x = off; x < 16; x += 8) rect(t, x, y + 1, 1, 3, S[2]);
  }
  rect(t, 0, 0, 16, 1, S[0]);
  rect(t, 0, 0, 1, 16, S[0]);
  rect(t, 15, 0, 1, 16, S[3]); rect(t, 0, 15, 16, 1, S[3]);
  // boca
  rect(t, 3, 7, 10, 7, S[3]);
  rect(t, 4, 8, 8, 6, lit ? '#2a1206' : '#141418');
  rect(t, 3, 6, 10, 1, S[0]);
  if (lit) {
    rect(t, 3, 7, 10, 1, '#ff9a3c');                      // reflejo en el marco
    rect(t, 4, 12, 8, 2, '#ff6a00');                      // brasas
    rect(t, 5, 10, 2, 2, '#ff8a1c'); rect(t, 9, 10, 2, 2, '#ff8a1c');
    rect(t, 6, 9, 1, 3, '#ffd23f'); rect(t, 9, 9, 1, 2, '#ffd23f');
    rect(t, 7, 11, 2, 2, '#fff1a8');
  } else {
    rect(t, 5, 12, 6, 2, '#2c2c33'); rect(t, 6, 12, 1, 1, '#4a4a52'); // cenizas
  }
  // chimenea
  rect(t, 11, 1, 3, 3, S[2]); rect(t, 12, 2, 1, 2, S[3]);
}

// Cofre de madera con herrajes dorados y cerradura.
function drawChest(t) {
  const W = ['#c08a52', '#9c6a3a', '#6b4424', '#3e2614'];
  const G = ['#ffe07a', '#d9a520', '#8a6410'];
  rect(t, 1, 3, 14, 13, W[1]);                    // cuerpo
  rect(t, 1, 3, 14, 5, W[2]);                     // tapa
  rect(t, 1, 3, 14, 1, W[0]);
  rect(t, 2, 4, 12, 1, W[1]);
  rect(t, 1, 8, 14, 1, W[3]);                     // unión tapa/cuerpo
  for (const y of [10, 13]) rect(t, 2, y, 12, 1, W[2]);   // tablas
  rect(t, 1, 3, 1, 13, W[3]); rect(t, 14, 3, 1, 13, W[3]); rect(t, 1, 15, 14, 1, W[3]);
  // herrajes
  for (const x of [2, 12]) { rect(t, x, 3, 2, 13, G[1]); rect(t, x, 3, 1, 13, G[0]); rect(t, x + 1, 3, 1, 13, G[2]); }
  // cerradura
  rect(t, 6, 7, 4, 4, G[1]); rect(t, 6, 7, 4, 1, G[0]); rect(t, 7, 9, 2, 2, G[2]); rect(t, 7, 9, 1, 1, '#1a1206');
}

// ══════════════ árboles ══════════════
function drawLeaves(t, pal, edges, rnd, alt) {
  const [light, mid, dark] = pal.leaf;
  rect(t, 0, 0, t.ts, t.ts, mid);
  speckle(t, [light], alt ? 16 : 9, rnd);
  speckle(t, [dark], 9, rnd);
  for (const e of edges) edgeStrip(t, e, [dark]);
  roundCorners(t, edges);
}

function drawTrunk(t, pal) {
  const [light, mid, dark] = pal.wood;
  rect(t, 5, 0, 6, 16, mid);
  rect(t, 5, 0, 1, 16, dark);
  rect(t, 10, 0, 1, 16, dark);
  rect(t, 7, 0, 1, 16, light);
  rect(t, 8, 3, 1, 3, dark);
  rect(t, 8, 10, 1, 3, dark);
}

function drawBranchH(t, pal, y0, h, x0 = 0, x1 = 16) {
  const [light, mid, dark] = pal.wood;
  rect(t, x0, y0, x1 - x0, h, mid);
  rect(t, x0, y0, x1 - x0, 1, light);
  rect(t, x0, y0 + h - 1, x1 - x0, 1, dark);
}

function leafBlob(t, pal, cx, cy, r, rnd) {
  const [light, mid, dark] = pal.leaf;
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    const d = x * x + y * y;
    if (d > r * r) continue;
    const px = cx + x, py = cy + y;
    if (px < 0 || py < 0 || px >= t.ts || py >= t.ts) continue;
    const c = d > (r - 1) * (r - 1) ? dark : (rnd() < 0.2 ? light : mid);
    rect(t, px, py, 1, 1, c);
  }
}

function drawTreePiece(t, pal, piece, rnd) {
  if (LEAF_EDGES[piece]) {
    drawLeaves(t, pal, LEAF_EDGES[piece], rnd, piece.endsWith('2'));
    return;
  }
  const [, , dark] = pal.wood;
  switch (piece) {
    case 'LCAN':   // copa por donde entra el tronco
      drawLeaves(t, pal, [], rnd, false);
      rect(t, 5, 11, 6, 5, pal.wood[1]);
      rect(t, 5, 11, 1, 5, dark); rect(t, 10, 11, 1, 5, dark);
      break;
    case 'LARM_L': // rama que sale del tronco (derecha) con follaje a la izquierda
      drawBranchH(t, pal, 7, 3, 8, 16);
      leafBlob(t, pal, 5, 7, 5, rnd);
      break;
    case 'LARM_R':
      drawBranchH(t, pal, 7, 3, 0, 8);
      leafBlob(t, pal, 10, 7, 5, rnd);
      break;
    case 'TRUNK':
      drawTrunk(t, pal);
      break;
    case 'TRUNK_K': // tronco con nudo
      drawTrunk(t, pal);
      rect(t, 6, 6, 4, 4, dark);
      rect(t, 7, 7, 2, 2, pal.wood[0]);
      break;
    case 'TRUNK_BR': // salida de ramas a los dos lados
      drawBranchH(t, pal, 6, 3);
      drawTrunk(t, pal);
      break;
    case 'TRUNK_R':  // salida de rama a la derecha
      drawBranchH(t, pal, 6, 3, 10, 16);
      drawTrunk(t, pal);
      break;
    case 'TRUNK_BASE': // base con raíces
      drawTrunk(t, pal);
      rect(t, 3, 12, 10, 4, pal.wood[1]);
      rect(t, 2, 14, 2, 2, dark); rect(t, 12, 14, 2, 2, dark);
      rect(t, 3, 12, 10, 1, pal.wood[0]);
      break;
    case 'STUB':
      drawBranchH(t, pal, 7, 2, 2, 14);
      break;
    case 'BRANCH_H':
      drawBranchH(t, pal, 6, 3);
      break;
    case 'BRANCH_S': // rama que termina en una matita
      drawBranchH(t, pal, 8, 2, 0, 10);
      leafBlob(t, pal, 11, 7, 4, rnd);
      break;
  }
}

// ══════════════ armado del tileset ══════════════
// Devuelve un <canvas> con TODOS los tiles (TILE_COUNT) en su celda.
export function buildProceduralTileset(tilesetCols, tileSize) {
  const rows = Math.ceil(TILE_COUNT / tilesetCols);
  const canvas = document.createElement('canvas');
  canvas.width = tilesetCols * tileSize;
  canvas.height = rows * tileSize;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const t = makeTile(tileSize);
  t.ctx = ctx;
  const at = (id) => {
    const i = id - 1;
    t.x = (i % tilesetCols) * tileSize;
    t.y = Math.floor(i / tilesetCols) * tileSize;
    return mulberry32(id * 7919 + 17); // ruido estable por tile
  };

  for (const fam of FAM_KEYS) {
    for (const p of FAM_PIECES) drawTerrainPiece(t, fam, p, at(TID[`${fam}_${p}`]));
  }

  drawDirt(t, at(TID.dirt));
  drawStone(t, STONE_BASES[0], STONE_SPK, at(TID.stone), false);
  drawIce(t, at(TID.ice));
  drawBedrock(t, at(TID.bedrock));
  for (const ore of Object.keys(ORES)) drawOre(t, ore, at(TID[ore]));
  at(TID.cactus); drawCactus(t);
  drawGravel(t, at(TID.gravel));

  STONE_VARIANT_KEYS.forEach((k, i) => drawStone(t, STONE_BASES[i], STONE_SPK, at(TID[k]), i === 2));
  DARK_STONE_VARIANT_KEYS.forEach((k, i) => drawStone(t, DARK_BASES[i], DARK_SPK, at(TID[k]), i === 2));

  for (const tree of TREE_KEYS) {
    const pal = TREE_PAL[tree];
    for (const p of [...LEAF_PIECES, ...WOOD_PIECES]) drawTreePiece(t, pal, p, at(TID[`${tree}_${p}`]));
  }

  at(TID.torch); drawTorch(t);
  at(TID.craft_table); drawCraftTable(t);
  at(TID.furnace); drawFurnace(t, false);
  at(TID.furnace_on); drawFurnace(t, true);
  at(TID.chest); drawChest(t);

  return canvas;
}
