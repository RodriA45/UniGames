// ══════════════════════════════════════════════════════════════
//   Pixel Survi — sprites.js
//   Atlas de TODOS los gráficos del juego. Los PNG se arman a partir
//   de los modelos originales (assert/world, assert/item,
//   assert/particle, player/player.png) recortados y escalados a 16px
//   por tile — ver assets/README.md.
//
//   Acá va solo la geometría (qué celda es qué) y dos helpers:
//     drawSprite()  → para el canvas
//     iconStyle()   → para los íconos DOM del hotbar / inventario
// ══════════════════════════════════════════════════════════════

// survi_config.js no importa nada (es solo datos), así que cualquier
// módulo lo puede leer — incluido este. Lo usamos para el total de tiles
// del atlas, así tileIconStyle() no depende de que cada caller se
// acuerde de pasarlo.
import { TILE_COUNT } from '../survi_config.js';

// Rutas relativas al DOCUMENTO (index.html), igual que ensureCSS en app2.js.
// OJO con la estructura real en disco: todo cuelga de models/, y adentro
// los assets NO están todos sueltos en una sola carpeta — están separados
// por tipo (world/ para el tileset, item/ para herramientas, particle/
// para las grietas) y player.png vive en su propia carpeta player/, al
// lado de assets/, no adentro. Si se mueve algo en models/ hay que
// actualizar esto (y COVER_SRC en survi_config.js).
const BASE = 'src/motor2d/games/pixel-survi/models/';

export const ASSETS = {
  tiles:     BASE + 'assets/world/tiles.png',
  player:    BASE + 'player/player.png',
  cracks:    BASE + 'assets/particle/cracks.png',
  items:     BASE + 'assets/item/items.png'
};

// Lista para precargar todo de una con Engine2D.loadAll()
// tiles.png ya no existe (el tileset se genera por código, ver
// survi_proc_tiles.js), así que no se precarga: evita un 404 al entrar.
export const PRELOAD = Object.values(ASSETS).filter(src => src !== ASSETS.tiles);

// ─── Tileset del mundo (lo consume Engine2D.TileMap) ───
// 8 columnas, 16px por tile, id-1 = índice. Tiene que coincidir con el
// orden de survi_config.js: si se agrega/saca/reordena un tile, hay que
// actualizar tiles.png a mano con el mismo orden (tierra/pasto/arena/
// grava no cuentan para esto — se dibujan por código, ver
// survi_proc_tiles.js).
export const TILESET = { src: ASSETS.tiles, cols: 8, size: 16 };

// URL que usan los íconos DOM (background-image) del tileset. Arranca en
// la ruta de siempre y survi_game.js la reemplaza por el data URL del
// canvas generado apenas lo arma.
let tilesetUrl = TILESET.src;
export function setTilesetUrl(url) { tilesetUrl = url; }

// ─── Personaje jugable (player/player.png) ───
// 2 filas x 10 celdas cuadradas de `cell` px (la resolución original de
// los dibujos, sin achicar). fw/fh = tamaño lógico en el juego (36 px).
//   fila 0: con brazo  → animación normal
//   fila 1: sin brazo  → se usa mientras dura el golpe, así el único
//           brazo visible es el que gira (celda `arm`, en las dos filas)
// Mismo orden de frames en las dos filas. Pies abajo y centrados.
// Caminar y saltar tienen frames propios para cada lado; idle y muerte
// miran a la derecha y se espejan.
export const PLAYER = {
  src: ASSETS.player,
  cell: 184, fw: 36, fh: 36, cols: 10, rows: 2,
  armlessRow: 1,
  frames: {
    idle:  [0],   // 1 solo frame (el 2º no tenía mochila)
    walkL: [2, 3],
    walkR: [4, 5],
    jumpL: 6,
    jumpR: 7,
    death: 8,
    arm:   9      // brazo suelto para el golpe (se gira por código)
  },
  idleFps: 2,
  walkFps: 6,
  // Brazo: pivote (hombro) y mano, en px lógicos dentro de su celda.
  arm: { pivotX: 18, pivotY: 2, handY: 11.7 },
  // Dónde va el hombro sobre el cuerpo (px lógicos, mirando a la derecha).
  shoulder: { x: 20.3, y: 16.4 }
};

// ─── Ítems (assets/item/items.png) ───
// Atlas de 16 columnas, celdas de 32x32. Cada dibujo está en su resolución
// ORIGINAL (se recuperó alineado a la grilla de pixeles de las texturas, sin
// achicar), centrado en su celda. index: nombre → [celda, x, y, ancho, alto],
// donde x/y/ancho/alto es el recorte del dibujo dentro de la celda.
// En la mano: 1 pixel del dibujo = 1 pixel del mundo (misma densidad que
// los bloques). En el inventario: el recorte se ajusta al tamaño del slot.
export const ITEMS = {
  src: ASSETS.items, cell: 32, cols: 16, rows: 7,
  index: {
    string: [0, 4, 4, 23, 23], leaves: [1, 5, 4, 22, 23], sticks: [2, 4, 4, 23, 23], flint: [3, 7, 4, 18, 23],
    leather: [4, 5, 4, 21, 23], copper_raw: [5, 3, 4, 25, 23], iron_raw: [6, 4, 6, 23, 19], gold_raw: [7, 4, 6, 23, 20],
    coal: [8, 4, 5, 23, 22], copper_ingot: [9, 2, 5, 28, 22], iron_ingot: [10, 2, 5, 28, 22], gold_ingot: [11, 2, 5, 28, 22],
    diamond: [12, 4, 4, 23, 24], emerald: [13, 6, 4, 19, 24], arrow: [14, 3, 3, 25, 26], fishing_rod: [15, 1, 1, 30, 30],
    fish_raw: [16, 2, 1, 28, 29], fish2_raw: [17, 0, 7, 32, 17], fish_cooked: [18, 2, 2, 27, 28], ink_sac: [19, 6, 5, 20, 22],
    squid_raw: [20, 1, 1, 30, 30], squid_cooked: [21, 1, 1, 30, 30], turtle_shell: [22, 2, 4, 28, 23], eel_raw: [23, 2, 0, 28, 32],
    eel_cooked: [24, 2, 0, 28, 32], bucket: [25, 3, 1, 26, 30], bucket_water: [26, 3, 1, 26, 30], bucket_lava: [27, 2, 1, 28, 30],
    helmet_leather: [28, 6, 8, 20, 16], helmet_copper: [29, 6, 8, 20, 16], helmet_iron: [30, 6, 8, 20, 16], helmet_gold: [31, 6, 8, 20, 16],
    helmet_diamond: [32, 6, 8, 20, 16], helmet_emerald: [33, 6, 8, 20, 16], chest_leather: [34, 1, 3, 29, 26], chest_copper: [35, 0, 3, 31, 26],
    chest_iron: [36, 0, 3, 31, 26], chest_gold: [37, 1, 3, 30, 26], chest_diamond: [38, 1, 3, 29, 26], chest_emerald: [39, 1, 3, 29, 26],
    legs_leather: [40, 6, 4, 20, 24], legs_copper: [41, 5, 4, 21, 24], legs_iron: [42, 6, 4, 20, 24], legs_gold: [43, 6, 4, 20, 24],
    legs_diamond: [44, 6, 4, 20, 24], legs_emerald: [45, 6, 4, 20, 24], boots_leather: [46, 2, 7, 28, 18], boots_copper: [47, 1, 7, 30, 18],
    boots_iron: [48, 1, 7, 30, 18], boots_gold: [49, 2, 7, 28, 18], boots_diamond: [50, 2, 7, 28, 18], boots_emerald: [51, 2, 7, 28, 18],
    bag_small: [52, 8, 6, 16, 19], bag_medium: [53, 5, 6, 21, 19], bag_large: [54, 4, 5, 23, 22], sword_wood: [55, 6, 6, 20, 20],
    sword_stone: [56, 6, 6, 20, 20], sword_copper: [57, 6, 6, 20, 20], sword_iron: [58, 6, 6, 19, 20], sword_gold: [59, 6, 6, 19, 20],
    sword_diamond: [60, 6, 6, 19, 20], sword_emerald: [61, 6, 6, 19, 20], pickaxe_wood: [62, 6, 7, 19, 18], pickaxe_stone: [63, 6, 7, 19, 18],
    pickaxe_copper: [64, 6, 7, 19, 18], pickaxe_iron: [65, 6, 7, 19, 18], pickaxe_gold: [66, 6, 7, 19, 18], pickaxe_diamond: [67, 6, 7, 19, 18],
    pickaxe_emerald: [68, 6, 7, 19, 18], axe_wood: [69, 6, 6, 20, 19], axe_stone: [70, 6, 6, 20, 19], axe_copper: [71, 6, 6, 20, 19],
    axe_iron: [72, 6, 6, 19, 19], axe_gold: [73, 6, 6, 19, 19], axe_diamond: [74, 6, 6, 19, 19], axe_emerald: [75, 6, 6, 19, 19],
    shovel_wood: [76, 10, 1, 11, 30], shovel_stone: [77, 10, 1, 11, 30], shovel_copper: [78, 10, 1, 11, 30], shovel_iron: [79, 10, 1, 11, 30],
    shovel_gold: [80, 10, 1, 11, 30], shovel_diamond: [81, 10, 1, 11, 30], shovel_emerald: [82, 10, 1, 11, 30], hoe_wood: [83, 8, 7, 16, 18],
    hoe_stone: [84, 8, 7, 16, 18], hoe_copper: [85, 8, 7, 16, 18], hoe_iron: [86, 8, 7, 16, 18], hoe_gold: [87, 8, 7, 16, 18],
    hoe_diamond: [88, 8, 7, 16, 18], hoe_emerald: [89, 8, 7, 16, 18], bow_common: [90, 6, 7, 19, 18], bow_good: [91, 9, 6, 13, 20],
    bow_superior: [92, 9, 6, 14, 20], meat_raw: [93, 1, 3, 29, 25], meat_cooked: [94, 1, 3, 29, 25], meat_rotten: [95, 1, 3, 29, 25],
    egg: [96, 4, 2, 23, 27], egg_cooked: [97, 4, 4, 23, 23], apple: [98, 3, 2, 25, 28], potato: [99, 3, 3, 25, 25],
    potato_baked: [100, 2, 0, 28, 31], wheat: [101, 1, 1, 29, 29], bread: [102, 0, 4, 31, 23], watermelon_slice: [103, 2, 1, 28, 29],
    carrot: [104, 1, 1, 29, 29]
  }
};

// Celda en el atlas + recorte del dibujo (px del atlas).
export function itemCell(name) {
  const e = ITEMS.index[name];
  if (!e) return null;
  const [i, bx, by, bw, bh] = e, c = ITEMS.cell;
  return { sx: (i % ITEMS.cols) * c, sy: Math.floor(i / ITEMS.cols) * c, w: c, h: c, bx, by, bw, bh };
}

// Cómo se sostiene en la mano (coords dentro de la celda de 32):
//   rot   = giro para que el ítem siga la línea del brazo
//   ax/ay = punto que queda en la mano (el mango)
//   scale = tamaño en la mano (la pala viene dibujada con pixeles más grandes)
export function itemHold(name) {
  const c = itemCell(name);
  if (!c) return null;
  if (name.startsWith('shovel_')) {                // vertical, pala arriba
    return { rot: Math.PI, ax: c.bx + c.bw / 2, ay: c.by + c.bh - 1, scale: 0.65 };
  }
  // diagonal: mango abajo-izquierda, punta arriba-derecha
  return { rot: Math.PI * 0.75, ax: c.bx + 2, ay: c.by + c.bh - 2, scale: 1 };
}

// Ícono DOM: el recorte del dibujo ajustado a px x px, centrado.
export function itemSpriteStyle(name, px) {
  const c = itemCell(name);
  if (!c) return '';
  const k = px / Math.max(c.bw, c.bh);
  const offX = (px - c.bw * k) / 2, offY = (px - c.bh * k) / 2;
  return `background-image:url('${ITEMS.src}');` +
         `background-size:${ITEMS.cols * ITEMS.cell * k}px ${ITEMS.rows * ITEMS.cell * k}px;` +
         `background-position:${-(c.sx + c.bx) * k + offX}px ${-(c.sy + c.by) * k + offY}px;` +
         `background-repeat:no-repeat;image-rendering:pixelated;` +
         `width:${px}px;height:${px}px;`;
}

// ─── Grietas de picado (4 etapas, de la textura particle/broken.png) ───
export const CRACKS = { src: ASSETS.cracks, cell: 16, stages: 4 };

// ═══════════ Helpers ═══════════

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
// totalTiles es opcional: si no se pasa, usa TILE_COUNT de survi_config.js
// (antes esto quedaba undefined cuando el caller no lo pasaba, y las filas
// del atlas daban NaN → el ícono se recortaba mal / no se veía).
export function tileIconStyle(tileId, px, totalTiles = TILE_COUNT) {
  const i = tileId - 1;
  const rows = Math.ceil(totalTiles / TILESET.cols);
  return spriteStyle(tilesetUrl, i % TILESET.cols, Math.floor(i / TILESET.cols),
                     TILESET.size, TILESET.cols, rows, px);
}
