// ══════════════════════════════════════════════════════════════
//   Pixel Survi — survi_config.js
//   Solo datos: constantes del mundo, ids de tile, familias de autotile,
//   biomas, drops e ítems. No importa nada, así lo puede leer cualquier
//   módulo (sprites.js incluido).
// ══════════════════════════════════════════════════════════════

export const TILE = 16;
export const COLS = 200;
export const ROWS = 200;
export const WORLD_W = COLS * TILE;
export const WORLD_H = ROWS * TILE;
export const VIEW_W = 480;   // resolución interna del canvas (30 tiles)
export const VIEW_H = 288;   // 18 tiles de alto

export const COVER_SRC = 'src/motor2d/games/pixel-survi/models/portada.png';

// ══════════════════════════════════════════════════════════════
//  IDs de tile
//
//  OJO: id-1 es el índice dentro de assets/tiles.png. El orden de abajo
//  es EXACTAMENTE el que usa tools/build_assets.py para armar el PNG: si
//  se agrega, saca o reordena algo hay que volver a correr el script.
//
//  Estructura:
//    1) 5 familias de terreno x 10 piezas de autotile  (50)
//    2) 8 tiles simples (relleno, piedra, vetas, cactus) (8)
//    3) 3 paletas de árbol x 27 piezas                  (81)
// ══════════════════════════════════════════════════════════════

// Las 10 piezas del "blob" 3x3 de cada hoja de assert/world:
//   C  = relleno (interior)          T/B/L/R = bordes
//   TL/TR/BL/BR = esquinas           S = bloque suelto
export const FAM_PIECES = ['C', 'T', 'B', 'L', 'R', 'TL', 'TR', 'BL', 'BR', 'S'];
export const FAM_KEYS = ['grass', 'sand', 'snow', 'jgrass', 'cave'];

export const SIMPLE_KEYS = ['dirt', 'stone', 'ice', 'bedrock', 'coal', 'iron', 'gold', 'cactus'];

// Piezas de hoja: el blob 4x3 (dos variantes de fila media), la columna
// angosta, la mata suelta, la copa por donde entra el tronco y las dos
// ramas con follaje.
export const LEAF_PIECES = [
  'LTL', 'LT', 'LTR',
  'LL', 'LC', 'LR',
  'LL2', 'LC2', 'LR2',
  'LBL', 'LB', 'LBR',
  'LVT', 'LVM', 'LVB',
  'LBLOB', 'LCAN',
  'LARM_L', 'LARM_R'
];
// Piezas de madera.
export const WOOD_PIECES = [
  'TRUNK', 'TRUNK_K', 'TRUNK_BR', 'TRUNK_BASE', 'TRUNK_R',
  'STUB', 'BRANCH_H', 'BRANCH_S'
];
export const TREE_PIECES = [...LEAF_PIECES, ...WOOD_PIECES];
export const TREE_KEYS = ['forest', 'pradera', 'jungle'];

// TID.grass_T, TID.stone, TID.jungle_TRUNK_K, …
export const TID = {};
{
  let n = 0;
  for (const f of FAM_KEYS) for (const p of FAM_PIECES) TID[`${f}_${p}`] = ++n;
  for (const s of SIMPLE_KEYS) TID[s] = ++n;
  for (const t of TREE_KEYS) for (const p of TREE_PIECES) TID[`${t}_${p}`] = ++n;
}
export const TILE_COUNT = Object.keys(TID).length;   // 139
export const TILESET_COLS = 8;

// ══════════════════════════════════════════════════════════════
//  Autotile
//
//  Cada familia sabe qué pieza usar según los 4 vecinos. La máscara es
//  U=8, D=4, L=2, R=1 (1 = hay vecino que "conecta").
//
//  Con 10 piezas se cubren las 16 combinaciones: las que pedirían una
//  columna angosta (solo arriba, solo abajo, arriba+abajo) caen en
//  T / B / C, que a 16px se lee igual. Las hojas sí tienen columna
//  angosta propia (LVT/LVM/LVB).
// ══════════════════════════════════════════════════════════════
export const MASK_PIECE = {
  //        0     1     2     3     4     5     6     7
  terrain: ['S', 'TL', 'TR', 'T', 'T', 'TL', 'TR', 'T',
  //        8     9    10    11    12    13    14    15
            'B', 'BL', 'BR', 'B', 'C', 'L', 'R', 'C'],
  leaf:    ['LBLOB', 'LTL', 'LTR', 'LT', 'LVT', 'LTL', 'LTR', 'LT',
            'LVB', 'LBL', 'LBR', 'LB', 'LVM', 'LL', 'LR', 'LC']
};

// Variantes alternativas (la segunda fila del blob de hojas), para que una
// copa grande no sea un bloque plano de un solo tile repetido.
export const LEAF_ALT = { LL: 'LL2', LC: 'LC2', LR: 'LR2' };

export const FAMILIES = {};
for (const k of FAM_KEYS) {
  const pieces = {};
  for (const p of FAM_PIECES) pieces[p] = TID[`${k}_${p}`];
  FAMILIES[k] = { kind: 'terrain', pieces, ids: new Set(Object.values(pieces)) };
}
for (const k of TREE_KEYS) {
  const pieces = {};
  for (const p of LEAF_PIECES) if (p !== 'LCAN' && p !== 'LARM_L' && p !== 'LARM_R') {
    pieces[p] = TID[`${k}_${p}`];
  }
  FAMILIES[`${k}Leaf`] = {
    kind: 'leaf',
    pieces,
    // LCAN y las ramas con follaje cuentan como hoja para la máscara, pero
    // NO se recalculan (si no, el autotile borraría la copa del tronco).
    ids: new Set([...Object.values(pieces),
                  TID[`${k}_LCAN`], TID[`${k}_LARM_L`], TID[`${k}_LARM_R`]])
  };
}

// Todo lo que "conecta" para el autotile de terreno: las 5 familias + los
// rellenos simples (tierra, piedra, vetas, hielo, bedrock).
export const TERRAIN_IDS = new Set();
for (const k of FAM_KEYS) for (const id of FAMILIES[k].ids) TERRAIN_IDS.add(id);
for (const k of ['dirt', 'stone', 'ice', 'bedrock', 'coal', 'iron', 'gold']) {
  TERRAIN_IDS.add(TID[k]);
}
for (const k of FAM_KEYS) FAMILIES[k].connect = TERRAIN_IDS;
for (const k of TREE_KEYS) FAMILIES[`${k}Leaf`].connect = FAMILIES[`${k}Leaf`].ids;

// id de tile → clave de familia. Solo las piezas que el autotile puede
// generar: lo que no está acá se deja como está.
export const FAMILY_OF = new Map();
for (const [key, fam] of Object.entries(FAMILIES)) {
  for (const id of Object.values(fam.pieces)) FAMILY_OF.set(id, key);
}

// ─── Compatibilidad / atajos de lectura ───
// Ids "canónicos": el que representa al material (y el que se coloca).
export const T = {
  DIRT: TID.dirt,
  GRASS: TID.grass_C,
  SAND: TID.sand_C,
  SNOW: TID.snow_C,
  JGRASS: TID.jgrass_C,
  CAVESTONE: TID.cave_C,
  STONE: TID.stone,
  ICE: TID.ice,
  BEDROCK: TID.bedrock,
  COAL: TID.coal,
  IRON: TID.iron,
  GOLD: TID.gold,
  CACTUS: TID.cactus,
  WOOD: TID.forest_TRUNK,
  LEAVES: TID.forest_LC,
  JLEAVES: TID.jungle_LC
};

// Sólidos: el terreno y el cactus. Los árboles NO frenan — se atraviesan,
// como en Terraria (si el tronco frenara, un bosque sería una pared).
export const SOLID_IDS = new Set([...TERRAIN_IDS, TID.cactus]);

// ══════════ Drops ══════════
// Cualquier variante de una familia deja el material de esa familia;
// cualquier tronco o rama deja el TRONCO de su paleta; cualquier hoja,
// el FOLLAJE de su paleta.
export const DROPS = {};
{
  const famDrop = {
    grass: TID.grass_C, sand: TID.sand_C, snow: TID.snow_C,
    jgrass: TID.jgrass_C, cave: TID.cave_C
  };
  for (const [k, drop] of Object.entries(famDrop)) {
    for (const id of FAMILIES[k].ids) DROPS[id] = drop;
  }
  for (const k of SIMPLE_KEYS) DROPS[TID[k]] = TID[k];
  for (const pal of TREE_KEYS) {
    for (const p of WOOD_PIECES) DROPS[TID[`${pal}_${p}`]] = TID[`${pal}_TRUNK`];
    for (const p of LEAF_PIECES) DROPS[TID[`${pal}_${p}`]] = TID[`${pal}_LC`];
  }
}

// ══════════ Dureza (segundos de picado a mano) y herramienta ══════════
export const HARDNESS = {};
export const TOOL_FOR = {};
{
  const setFam = (k, hard, tool) => {
    for (const id of FAMILIES[k].ids) { HARDNESS[id] = hard; if (tool) TOOL_FOR[id] = tool; }
  };
  setFam('grass', 0.35, 'shovel');
  setFam('sand', 0.30, 'shovel');
  setFam('snow', 0.28, 'shovel');
  setFam('jgrass', 0.35, 'shovel');
  setFam('cave', 0.95, 'pickaxe');

  const simple = {
    dirt: [0.35, 'shovel'], stone: [0.85, 'pickaxe'], ice: [0.55, 'pickaxe'],
    bedrock: [999, 'pickaxe'], coal: [1.10, 'pickaxe'], iron: [1.40, 'pickaxe'],
    gold: [1.60, 'pickaxe'], cactus: [0.40, 'axe']
  };
  for (const [k, [h, tool]] of Object.entries(simple)) {
    HARDNESS[TID[k]] = h; TOOL_FOR[TID[k]] = tool;
  }
  for (const pal of TREE_KEYS) {
    for (const p of WOOD_PIECES) { HARDNESS[TID[`${pal}_${p}`]] = 0.55; TOOL_FOR[TID[`${pal}_${p}`]] = 'axe'; }
    for (const p of LEAF_PIECES) { HARDNESS[TID[`${pal}_${p}`]] = 0.15; }
  }
}

// ══════════ Ítems ══════════
// Los bloques usan el mismo id que el tile canónico (son colocables: al
// colocarlos el juego les recalcula la variante con el autotile).
// Las herramientas usan ids >= 1000 y NO se pueden colocar.
export const ITEM_INFO = {};
{
  const blocks = {
    [TID.grass_C]:  'Tierra con pasto',
    [TID.dirt]:     'Tierra',
    [TID.sand_C]:   'Arena',
    [TID.snow_C]:   'Nieve',
    [TID.jgrass_C]: 'Tierra de selva',
    [TID.cave_C]:   'Roca de cueva',
    [TID.stone]:    'Piedra',
    [TID.ice]:      'Hielo',
    [TID.coal]:     'Carbón',
    [TID.iron]:     'Hierro',
    [TID.gold]:     'Oro',
    [TID.cactus]:   'Cactus',
    [TID.forest_TRUNK]:  'Tronco de roble',
    [TID.pradera_TRUNK]: 'Tronco claro',
    [TID.jungle_TRUNK]:  'Tronco de selva',
    [TID.forest_LC]:  'Hojas',
    [TID.pradera_LC]: 'Hojas de pradera',
    [TID.jungle_LC]:  'Follaje de selva'
  };
  for (const [id, name] of Object.entries(blocks)) {
    ITEM_INFO[id] = { name, place: Number(id) };
  }
}

export const MATERIALS = {
  copper:  { label: 'cobre',    power: 1.0 },
  silver:  { label: 'plata',    power: 1.6 },
  gold:    { label: 'oro',      power: 2.2 },
  diamond: { label: 'diamante', power: 3.0 }
};
const TOOL_LABEL = { pickaxe: 'Pico', axe: 'Hacha', shovel: 'Pala', sword: 'Espada' };

// Ids de herramienta: 1000 + índiceMaterial*10 + índiceTipo
export const TOOLS = {};
Object.keys(MATERIALS).forEach((mat, mi) => {
  ['pickaxe', 'axe', 'shovel', 'sword'].forEach((tool, ti) => {
    const id = 1000 + mi * 10 + ti;
    TOOLS[`${tool}_${mat}`] = id;
    ITEM_INFO[id] = {
      name: `${TOOL_LABEL[tool]} de ${MATERIALS[mat].label}`,
      tool, mat, power: MATERIALS[mat].power
    };
  });
});

// Con lo que arranca una partida nueva, así se puede jugar de entrada.
export const STARTER_TOOLS = [
  TOOLS.pickaxe_copper, TOOLS.axe_copper, TOOLS.shovel_copper, TOOLS.sword_copper
];

export const HOTBAR_SIZE = 8;

// ══════════ Biomas de superficie ══════════
// fam = familia de la capa de arriba, sub = la de abajo (el subsuelo).
export const BIOMES = {
  bosque:   { label: 'Bosque',   fam: 'grass',  sub: 'dirt',    base: 40, amp: 5,   sky: '#7ec8e3', tree: 'forest',  treeChance: 0.16 },
  pradera:  { label: 'Pradera',  fam: 'grass',  sub: 'dirt',    base: 41, amp: 2,   sky: '#8fd3ef', tree: 'pradera', treeChance: 0.07 },
  desierto: { label: 'Desierto', fam: 'sand',   sub: 'sand',   base: 43, amp: 1.5, sky: '#f0d9a8', tree: null,      treeChance: 0 },
  nieve:    { label: 'Nieve',    fam: 'snow',   sub: 'dirt',    base: 35, amp: 7,   sky: '#cfe6f2', tree: 'forest',  treeChance: 0.11 },
  jungla:   { label: 'Jungla',   fam: 'jgrass', sub: 'dirt',   base: 42, amp: 4,   sky: '#9fdcc0', tree: 'jungle',  treeChance: 0.24 }
};
export const BIOME_NAMES = Object.keys(BIOMES);

// Dónde puede aparecer el jugador: cualquier variante de pasto, nieve,
// selva o arena. Nunca piedra ni roca de cueva.
export const SPAWN_TOP_IDS = new Set();
for (const k of ['grass', 'snow', 'jgrass', 'sand']) {
  for (const id of FAMILIES[k].ids) SPAWN_TOP_IDS.add(id);
}

// ─── Jugador / combate ───
export const MAX_HP = 20;
export const FALL_SAFE_TILES = 4;
export const FALL_DMG_PER_TILE = 1;
export const INVULN_MS = 700;
export const ATTACK_COOLDOWN = 380;
export const ATTACK_DMG = 3;          // a mano; la espada suma su power
export const PLACE_COOLDOWN = 160;
export const MOVE_SPEED = 2.2;
export const JUMP_VEL = -7.6;
export const REACH_TILES = 5;

// La caja de colisión es más chica que el dibujo a propósito: el sprite
// sobresale, el choque no.
export const PLAYER_BOX = { w: 12, h: 22 };
export const PLAYER_SPRITE = { w: 24, h: 36, offX: -6, offY: -14 };

export const MODES = {
  normal:   { label: 'Modo normal', desc: 'Si morís, reaparecés y conservás el mundo.' },
  hardcore: { label: 'Hardcore',    desc: 'Si morís, se borra el mundo. Sin respawn.' }
};
