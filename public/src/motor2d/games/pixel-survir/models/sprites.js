// ══════════════════════════════════════════════════════════════
//   Pixel Survi — sprites.js
//   Atlas de TODOS los gráficos del juego. Los PNG se arman a partir
//   de los modelos originales (assert/world, assert/item,
//   assert/particle, junior/junior.png) recortados y escalados a 16px
//   por tile — ver assets/README.md.
//
//   Acá va solo la geometría (qué celda es qué) y dos helpers:
//     drawSprite()  → para el canvas
//     iconStyle()   → para los íconos DOM del hotbar / inventario
// ══════════════════════════════════════════════════════════════

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
// 4 columnas, 16px por tile, id-1 = índice. El orden está fijado en
// survi_config.js (TILE_ORDER): si se agrega un tile hay que regenerar
// tiles.png con el mismo orden.
export const TILESET = { src: ASSETS.tiles, cols: 4, size: 16 };

// ─── Junior (personaje jugable) ───
// Los sprites originales miran todos para el mismo lado: cuando camina a
// la izquierda se dibuja espejado (ver drawSprite con flip).
export const JUNIOR = {
  src: ASSETS.junior,
  fw: 24, fh: 36, cols: 7, rows: 2,
  // índices dentro de la grilla 7x2 (fila * 7 + columna)
  frames: {
    idle:   0,
    walk:  [1, 2],     // ciclo de caminata
    jump:   3,
    swing:  3,         // brazo arriba = golpe/picado
    hurt:   4
  },
  walkFps: 7
};

// ─── Herramientas ───
// "held" = la que se ve en la mano (sprites grandes del sheet original).
// "icon" = la chica, para el inventario y la hotbar.
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

// ─── Grietas de picado (4 etapas, de la textura particle/broken.png) ───
export const CRACKS = { src: ASSETS.cracks, cell: 16, stages: 4 };

// ═══════════ Helpers ═══════════

// Celda de una herramienta dentro de su atlas. Si el material no existe
// en el sheet "held" (carmesí), cae al último disponible.
export function toolCell(atlas, tool, mat) {
  const c = atlas.tools.indexOf(tool);
  let r = atlas.mats.indexOf(mat);
  if (c < 0) return null;
  if (r < 0) r = atlas.mats.length - 1;
  return { sx: c * atlas.cell, sy: r * atlas.cell, w: atlas.cell, h: atlas.cell };
}

// Dibuja un recorte de un atlas, opcionalmente espejado en horizontal.
// flip = true dibuja el sprite mirando a la izquierda sin necesitar un
// segundo set de gráficos.
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
export function tileIconStyle(tileId, px, totalTiles) {
  const i = tileId - 1;
  const rows = Math.ceil(totalTiles / TILESET.cols);
  return spriteStyle(TILESET.src, i % TILESET.cols, Math.floor(i / TILESET.cols),
                     TILESET.size, TILESET.cols, rows, px);
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
