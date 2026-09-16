// ══════════════════════════════════════════════════════════════
//   Pixel Survi — sprites.js
//   Atlas de TODOS los gráficos del juego. Los PNG se arman con
//   tools/build_assets.py a partir de los modelos originales
//   (assert/world, assert/item, assert/particle, junior/junior.png)
//   recortados y escalados a 16px por tile — ver assets/README.md.
//
//   Acá va solo la geometría (qué celda es qué) y los helpers:
//     drawSprite()    → para el canvas
//     tileIconStyle() → para los íconos DOM del hotbar / inventario
// ══════════════════════════════════════════════════════════════

import { TILE_COUNT, TILESET_COLS } from './survi_config.js';

// Rutas relativas al DOCUMENTO (index.html), igual que ensureCSS en app2.js.
const BASE = 'src/motor2d/games/pixel-survi/assets/';

export const ASSETS = {
  tiles:     BASE + 'tiles.png',
  junior:    BASE + 'junior.png',
  toolsHeld: BASE + 'tools-held.png',
  toolsIcon: BASE + 'tools-icon.png',
  cracks:    BASE + 'cracks.png'
};

// Lista para precargar todo de una con Engine2D.loadAll()
export const PRELOAD = Object.values(ASSETS);

// ─── Tileset del mundo (lo consume Engine2D.TileMap) ───
// 8 columnas, 16px por tile, id-1 = índice. El orden lo fija survi_config.js
// (TID): si se agrega o reordena un tile hay que regenerar tiles.png con
// build_assets.py, que usa exactamente el mismo orden.
export const TILESET = {
  src:  ASSETS.tiles,
  cols: TILESET_COLS,
  rows: Math.ceil(TILE_COUNT / TILESET_COLS),
  size: 16
};

// ─── Junior (personaje jugable) ───
// El modelo original (junior.png de 7x2) trae poses sueltas, no un ciclo de
// caminata: no hay ninguna con los brazos abajo y las piernas abiertas.
// build_assets.py rearma una tira de 8 frames pegando el torso de la pose
// quieta con las piernas de la pose de zancada (y la zancada opuesta
// espejando SOLO las piernas).
//
// Todos los frames miran a la derecha: cuando el jugador va a la izquierda
// se dibuja espejado (ver drawSprite con flip), así no hace falta un
// segundo set de gráficos.
export const JUNIOR = {
  src: ASSETS.junior,
  fw: 24, fh: 36, cols: 8, rows: 1,
  frames: {
    idle:  0,
    walk: [1, 2, 3, 4],   // zancada · quieto · zancada opuesta · quieto
    jump:  5,
    swing: 6,             // brazo en alto = golpe / picado
    hurt:  7
  },
  walkFps: 8
};

// ─── Herramientas ───
// "held" = la que se ve en la mano (los sprites grandes, fila de arriba del
// modelo original). "icon" = la chica, para el inventario y la hotbar.
export const TOOLS_HELD = {
  src: ASSETS.toolsHeld, cell: 16,
  tools: ['sword', 'shovel', 'pickaxe', 'axe', 'scythe'],
  mats:  ['copper', 'silver', 'gold', 'diamond']
};
export const TOOLS_ICON = {
  src: ASSETS.toolsIcon, cell: 16,
  tools: ['sword', 'dagger', 'shovel', 'pickaxe', 'axe', 'scythe'],
  mats:  ['copper', 'silver', 'gold', 'diamond', 'crimson']
};

// ─── Grietas de picado (4 etapas, de la textura particle/cracks.png) ───
export const CRACKS = { src: ASSETS.cracks, cell: 16, stages: 4 };

// ═══════════ Helpers ═══════════

// Celda de una herramienta dentro de su atlas. Si el material no existe en
// el sheet (el carmesí solo está en los íconos), cae al último disponible.
export function toolCell(atlas, tool, mat) {
  const c = atlas.tools.indexOf(tool);
  let r = atlas.mats.indexOf(mat);
  if (c < 0) return null;
  if (r < 0) r = atlas.mats.length - 1;
  return { sx: c * atlas.cell, sy: r * atlas.cell, w: atlas.cell, h: atlas.cell };
}

// Celda de un tile dentro de tiles.png (id 1 = primer tile).
export function tileCell(tileId) {
  const i = tileId - 1;
  if (i < 0) return null;
  return {
    sx: (i % TILESET.cols) * TILESET.size,
    sy: Math.floor(i / TILESET.cols) * TILESET.size,
    w: TILESET.size, h: TILESET.size
  };
}

// Dibuja un recorte de un atlas, opcionalmente espejado en horizontal.
// flip = true dibuja el sprite mirando a la izquierda.
export function drawSprite(ctx, img, sx, sy, sw, sh, dx, dy, dw, dh, flip = false) {
  if (!img) return;
  if (!flip) { ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh); return; }
  ctx.save();
  ctx.translate(dx + dw, dy);
  ctx.scale(-1, 1);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
  ctx.restore();
}

// Estilo inline para un ícono DOM recortado de un atlas (hotbar/inventario).
// Se usa background-position escalado en vez de <img> + clip: un solo
// request de imagen y sin nodos extra por slot.
export function spriteStyle(src, col, row, cell, sheetCols, sheetRows, px) {
  const k = px / cell;
  return `background-image:url('${src}');` +
         `background-size:${sheetCols * cell * k}px ${sheetRows * cell * k}px;` +
         `background-position:${-col * cell * k}px ${-row * cell * k}px;` +
         `background-repeat:no-repeat;image-rendering:pixelated;` +
         `width:${px}px;height:${px}px;`;
}

// Ícono de un tile del mundo (usa el mismo tiles.png que dibuja el mapa).
export function tileIconStyle(tileId, px) {
  const i = tileId - 1;
  if (i < 0) return '';
  return spriteStyle(TILESET.src, i % TILESET.cols, Math.floor(i / TILESET.cols),
                     TILESET.size, TILESET.cols, TILESET.rows, px);
}

// Ícono de una herramienta.
export function toolIconStyle(tool, mat, px) {
  const c = TOOLS_ICON.tools.indexOf(tool);
  let r = TOOLS_ICON.mats.indexOf(mat);
  if (c < 0) return '';
  if (r < 0) r = TOOLS_ICON.mats.length - 1;
  return spriteStyle(TOOLS_ICON.src, c, r, TOOLS_ICON.cell,
                     TOOLS_ICON.tools.length, TOOLS_ICON.mats.length, px);
}
