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
//  es EXACTAMENTE el orden de las celdas dentro de ese PNG: si se agrega,
//  saca o reordena algo acá, hay que actualizar tiles.png a mano para que
//  las celdas sigan coincidiendo con estos ids.
//
//  Estructura:
//    1) 5 familias de terreno x 10 piezas de autotile  (50)
//    2) 9 tiles simples (relleno, piedra, vetas, cactus, grava) (9)
//    3) 4 variantes de piedra + 4 de piedra oscura, sin autotile (8)
//    4) 3 paletas de árbol x 27 piezas                  (81)
// ══════════════════════════════════════════════════════════════

// Las 10 piezas del "blob" 3x3 de cada hoja de assert/world:
//   C  = relleno (interior)          T/B/L/R = bordes
//   TL/TR/BL/BR = esquinas           S = bloque suelto
export const FAM_PIECES = ['C', 'T', 'B', 'L', 'R', 'TL', 'TR', 'BL', 'BR', 'S'];
export const FAM_KEYS = ['grass', 'sand', 'snow', 'jgrass', 'cave'];

export const SIMPLE_KEYS = ['dirt', 'stone', 'ice', 'bedrock', 'coal', 'iron', 'gold', 'cactus', 'gravel'];

// Variantes de piedra: NO son autotile (no conectan con vecinos, es puro
// ruido visual) — las 4 comparten drop/dureza/herramienta con TID.stone
// (ver DROPS/HARDNESS/TOOL_FOR más abajo), así que minar cualquiera te da
// el mismo ítem "Piedra" de siempre. A partir de DEEP_STONE_ROW (los
// últimos 100 bloques de profundidad, de las 200 filas del mapa) se usa
// la paleta oscura en vez de la normal — ver generateWorld.
export const STONE_VARIANT_KEYS = ['stone_1', 'stone_2', 'stone_3', 'stone_4'];
export const DARK_STONE_VARIANT_KEYS = ['darkstone_1', 'darkstone_2', 'darkstone_3', 'darkstone_4'];
export const DEEP_STONE_ROW = ROWS - 100;

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
  for (const s of STONE_VARIANT_KEYS) TID[s] = ++n;
  for (const s of DARK_STONE_VARIANT_KEYS) TID[s] = ++n;
  for (const t of TREE_KEYS) for (const p of TREE_PIECES) TID[`${t}_${p}`] = ++n;
  // Agregados después: SIEMPRE al final, así no se corren los ids de los
  // bloques que ya están guardados en los mundos.
  TID.torch = ++n;
  TID.copper_ore = ++n;
  TID.diamond_ore = ++n;
  TID.emerald_ore = ++n;
  TID.craft_table = ++n;
  TID.furnace = ++n;
  TID.furnace_on = ++n;   // horno prendido (misma cosa, otro dibujo + da luz)
  TID.chest = ++n;
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
// rellenos simples (tierra, piedra, vetas, hielo, bedrock) + las variantes
// de piedra (normal y oscura) — así el pasto/tierra de arriba las trata
// como piso sólido de siempre y no les dibuja un borde expuesto de más.
export const TERRAIN_IDS = new Set();
for (const k of FAM_KEYS) for (const id of FAMILIES[k].ids) TERRAIN_IDS.add(id);
for (const k of ['dirt', 'stone', 'ice', 'bedrock', 'coal', 'iron', 'gold', 'gravel', 'copper_ore', 'diamond_ore', 'emerald_ore']) {
  TERRAIN_IDS.add(TID[k]);
}
for (const k of [...STONE_VARIANT_KEYS, ...DARK_STONE_VARIANT_KEYS]) TERRAIN_IDS.add(TID[k]);
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
  GRAVEL: TID.gravel,
  COPPER_ORE: TID.copper_ore,
  DIAMOND_ORE: TID.diamond_ore,
  EMERALD_ORE: TID.emerald_ore,
  TORCH: TID.torch,
  CRAFT_TABLE: TID.craft_table,
  FURNACE: TID.furnace,
  FURNACE_ON: TID.furnace_on,
  CHEST: TID.chest,
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
  // Las 8 variantes de piedra (normal + oscura) son puro dibujo — al
  // picarlas dan la misma "Piedra" de siempre (TID.stone), no un ítem
  // por variante.
  for (const k of [...STONE_VARIANT_KEYS, ...DARK_STONE_VARIANT_KEYS]) DROPS[TID[k]] = TID.stone;
  DROPS[TID.torch] = TID.torch;
  DROPS[TID.craft_table] = TID.craft_table;
  DROPS[TID.furnace] = TID.furnace;
  DROPS[TID.furnace_on] = TID.furnace;
  DROPS[TID.chest] = TID.chest;
  for (const pal of TREE_KEYS) {
    for (const p of WOOD_PIECES) DROPS[TID[`${pal}_${p}`]] = TID[`${pal}_TRUNK`];
    // las hojas sueltan el ítem "Hojas" (MAT.leaves): ver más abajo, en Materiales
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
    gold: [1.60, 'pickaxe'], cactus: [0.40, 'axe'], gravel: [0.50, 'shovel']
  };
  for (const [k, [h, tool]] of Object.entries(simple)) {
    HARDNESS[TID[k]] = h; TOOL_FOR[TID[k]] = tool;
  }
  // Mismo pico/dureza que la piedra normal para las 8 variantes.
  for (const k of [...STONE_VARIANT_KEYS, ...DARK_STONE_VARIANT_KEYS]) {
    HARDNESS[TID[k]] = HARDNESS[TID.stone]; TOOL_FOR[TID[k]] = 'pickaxe';
  }
  HARDNESS[TID.torch] = 0.05; TOOL_FOR[TID.torch] = 'axe'; // sale al toque con cualquier cosa
  HARDNESS[TID.copper_ore] = 1.20; TOOL_FOR[TID.copper_ore] = 'pickaxe';
  HARDNESS[TID.diamond_ore] = 2.20; TOOL_FOR[TID.diamond_ore] = 'pickaxe';
  HARDNESS[TID.emerald_ore] = 2.60; TOOL_FOR[TID.emerald_ore] = 'pickaxe';
  HARDNESS[TID.craft_table] = 0.8; TOOL_FOR[TID.craft_table] = 'axe';
  HARDNESS[TID.furnace] = 1.2;     TOOL_FOR[TID.furnace] = 'pickaxe';
  HARDNESS[TID.furnace_on] = 1.2;  TOOL_FOR[TID.furnace_on] = 'pickaxe';
  HARDNESS[TID.chest] = 0.8;       TOOL_FOR[TID.chest] = 'axe';
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
    [TID.gravel]:   'Grava',
    [TID.stone]:    'Piedra',
    [TID.ice]:      'Hielo',
    [TID.coal]:     'Mineral de carbón',
    [TID.iron]:     'Mineral de hierro',
    [TID.gold]:     'Mineral de oro',
    [TID.cactus]:   'Cactus',
    [TID.forest_TRUNK]:  'Tronco de roble',
    [TID.pradera_TRUNK]: 'Tronco claro',
    [TID.jungle_TRUNK]:  'Tronco de selva',
    [TID.forest_LC]:  'Bloque de hojas',
    [TID.pradera_LC]: 'Hojas de pradera',
    [TID.jungle_LC]:  'Follaje de selva',
    [TID.torch]:      'Antorcha',
    [TID.craft_table]: 'Mesa de crafteo',
    [TID.furnace]:     'Horno',
    [TID.chest]:       'Cofre'
  };
  for (const [id, name] of Object.entries(blocks)) {
    ITEM_INFO[id] = { name, place: Number(id) };
  }
}

// ══════════ Comida ══════════
// Ids >= 2000 para no pisar bloques (van por id de tile) ni herramientas
// (1000+). No son colocables (no tienen `place`): se comen con clic
// derecho estando seleccionadas en la hotbar (ver survi_game.js `_eat`).
export const FOOD_IDS = { berry: 2001, apple: 2002 };

// Estaciones: bloques que se usan con clic derecho (abren una pantalla).
// No son sólidos (se pasan por delante, como en Terraria) y se apoyan
// sobre un bloque sólido.
export const STATION_IDS = new Set([TID.craft_table, TID.furnace, TID.furnace_on, TID.chest]);
export const CHEST_SLOTS = 16;   // tipos de ítem distintos que entran en un cofre

// Comida que se consigue cruda y se cocina en el horno (carne, huevo y
// pescado llegan con animales/pesca; las recetas ya quedan listas).
export const FOOD = {
  meatRaw: 2010, meatCooked: 2011, meatRotten: 2012, egg: 2013, eggCooked: 2014,
  potato: 2015, potatoBaked: 2016, bread: 2017, watermelon: 2018, carrot: 2019,
  fishRaw: 2020, fish2Raw: 2021, fishCooked: 2022, squidRaw: 2023, squidCooked: 2024,
  eelRaw: 2025, eelCooked: 2026
};
{
  const f = [
    ['meatRaw', 'Carne cruda', 6, 'meat_raw'], ['meatCooked', 'Carne cocida', 32, 'meat_cooked'],
    ['meatRotten', 'Carne podrida', 4, 'meat_rotten'], ['egg', 'Huevo', 4, 'egg'],
    ['eggCooked', 'Huevo frito', 18, 'egg_cooked'], ['potato', 'Papa', 8, 'potato'],
    ['potatoBaked', 'Papa al horno', 26, 'potato_baked'], ['bread', 'Pan', 28, 'bread'],
    ['watermelon', 'Sandía', 12, 'watermelon_slice'], ['carrot', 'Zanahoria', 12, 'carrot'],
    ['fishRaw', 'Pescado crudo', 6, 'fish_raw'], ['fish2Raw', 'Salmón crudo', 6, 'fish2_raw'],
    ['fishCooked', 'Pescado cocido', 24, 'fish_cooked'], ['squidRaw', 'Calamar crudo', 6, 'squid_raw'],
    ['squidCooked', 'Calamar cocido', 22, 'squid_cooked'], ['eelRaw', 'Anguila cruda', 6, 'eel_raw'],
    ['eelCooked', 'Anguila cocida', 24, 'eel_cooked']
  ];
  for (const [k, name, food, sprite] of f) ITEM_INFO[FOOD[k]] = { name, food, sprite };
}
ITEM_INFO[FOOD_IDS.berry] = { name: 'Bayas', food: 14 };
ITEM_INFO[FOOD_IDS.apple] = { name: 'Manzana', food: 26, sprite: 'apple' };

// Al romper hojas hay una chance de que además caiga comida — cada
// paleta de árbol (forest/pradera/jungle) tiene la suya.
export const LEAF_FOOD_DROP = {
  forest:  { id: FOOD_IDS.apple, chance: 0.045 },
  pradera: { id: FOOD_IDS.berry, chance: 0.05 },
  jungle:  { id: FOOD_IDS.berry, chance: 0.06 }
};

// Palabra de la paleta de árbol si el tile roto era una hoja (para el
// drop de comida de arriba), o null si no es una hoja.
export function leafPalette(tileId) {
  const key = FAMILY_OF.get(tileId);
  if (key && key.endsWith('Leaf')) return key.slice(0, -4);
  return null;
}

// ══════════ Materiales sueltos (no se colocan) ══════════
// Ids 4000+. `sprite` = nombre en el atlas de ítems (models/sprites.js).
export const MAT = {
  string: 4001, leaves: 4002, sticks: 4003, flint: 4004, leather: 4005,
  copperRaw: 4006, ironRaw: 4007, goldRaw: 4008, coal: 4009,
  copperIngot: 4010, ironIngot: 4011, goldIngot: 4012, diamond: 4013, emerald: 4014,
  arrow: 4015
};
{
  const m = [
    ['string', 'Hilo', 'string'], ['leaves', 'Hojas', 'leaves'], ['sticks', 'Palo', 'sticks'],
    ['flint', 'Flint', 'flint'], ['leather', 'Cuero', 'leather'],
    ['copperRaw', 'Cobre crudo', 'copper_raw'], ['ironRaw', 'Hierro crudo', 'iron_raw'],
    ['goldRaw', 'Oro crudo', 'gold_raw'], ['coal', 'Carbón', 'coal'],
    ['copperIngot', 'Lingote de cobre', 'copper_ingot'], ['ironIngot', 'Lingote de hierro', 'iron_ingot'],
    ['goldIngot', 'Lingote de oro', 'gold_ingot'], ['diamond', 'Diamante', 'diamond'], ['emerald', 'Esmeralda', 'emerald'],
    ['arrow', 'Flecha', 'arrow']
  ];
  for (const [k, name, sprite] of m) ITEM_INFO[MAT[k]] = { name, sprite };
}

// Drops de los minerales: sueltan su versión cruda (o la gema/carbón).
// `tier` = pico mínimo para que suelte algo (ver MATERIALS.tier): con un
// pico peor el bloque se rompe igual, pero no da nada (como en Minecraft).
export const ORE_DROPS = {
  [TID.coal]:        { drop: MAT.coal,      tier: 0 },
  [TID.copper_ore]:  { drop: MAT.copperRaw, tier: 1 },
  [TID.iron]:        { drop: MAT.ironRaw,   tier: 2 },
  [TID.gold]:        { drop: MAT.goldRaw,   tier: 3 },
  [TID.diamond_ore]: { drop: MAT.diamond,   tier: 4 },
  [TID.emerald_ore]: { drop: MAT.emerald,   tier: 5 }
};
for (const [id, o] of Object.entries(ORE_DROPS)) DROPS[id] = o.drop;
// Las hojas sueltan el ítem Hojas (ya no el bloque de hoja).
for (const pal of TREE_KEYS) for (const p of LEAF_PIECES) DROPS[TID[`${pal}_${p}`]] = MAT.leaves;

// ══════════ Materiales de herramienta ══════════
// Cada uno mejor que el anterior. power = velocidad de picado extra y
// daño de la espada; tier = qué minerales puede sacar el pico.
// El orden de las 4 primeras claves NO se toca: los ids de herramienta
// salen del índice, y así las partidas viejas (cobre/plata/oro/diamante)
// siguen teniendo sus herramientas (la vieja "plata" pasa a ser hierro).
export const MATERIALS = {
  copper:  { label: 'cobre',    power: 1.0, tier: 2 },
  iron:    { label: 'hierro',   power: 1.6, tier: 3 },
  gold:    { label: 'oro',      power: 2.2, tier: 4 },
  diamond: { label: 'diamante', power: 3.0, tier: 5 },
  wood:    { label: 'madera',   power: 0.3, tier: 0 },
  stone:   { label: 'piedra',   power: 0.6, tier: 1 },
  emerald: { label: 'esmeralda', power: 3.8, tier: 6 }
};
// Orden de progresión (para listas y recetas)
export const MATERIAL_ORDER = ['wood', 'stone', 'copper', 'iron', 'gold', 'diamond', 'emerald'];
const TOOL_LABEL = { pickaxe: 'Pico', axe: 'Hacha', shovel: 'Pala', sword: 'Espada' };
const TOOL_KINDS = ['pickaxe', 'axe', 'shovel', 'sword'];

// Ids de herramienta: 1000 + índiceMaterial*10 + índiceTipo
export const TOOLS = {};
Object.keys(MATERIALS).forEach((mat, mi) => {
  TOOL_KINDS.forEach((tool, ti) => {
    const id = 1000 + mi * 10 + ti;
    TOOLS[`${tool}_${mat}`] = id;
    ITEM_INFO[id] = {
      name: `${TOOL_LABEL[tool]} de ${MATERIALS[mat].label}`,
      tool, mat, power: MATERIALS[mat].power, tier: MATERIALS[mat].tier,
      sprite: `${tool}_${mat}`
    };
  });
});

// Con lo que arranca una partida nueva: herramientas de madera.
export const STARTER_TOOLS = [
  TOOLS.pickaxe_wood, TOOLS.axe_wood, TOOLS.shovel_wood, TOOLS.sword_wood
];

// Antorchas con las que arranca una partida nueva (para la primera cueva).
export const STARTER_TORCHES = 5;

export const HOTBAR_SIZE = 8;

// ══════════ Día / noche + iluminación ══════════
// Un día completo dura DAY_CYCLE_MS. timeOfDay va de 0 a 1:
//   0.00 – 0.50  día pleno
//   0.50 – 0.60  atardecer (baja la luz)
//   0.60 – 0.90  noche
//   0.90 – 1.00  amanecer (sube la luz)
export const DAY_CYCLE_MS = 10 * 60 * 1000;
export const NIGHT_SUN = 0.12;          // luz del cielo de noche (0 = negro total)
export const NIGHT_SKY = '#0b1030';      // color del cielo de noche
export const START_TIME_OF_DAY = 0.05;  // mundo nuevo: arranca de mañana

// Luz (0..1). Cada tile que atraviesa le resta *_DECAY; con 1 / DECAY se
// saca el alcance en tiles. Los sólidos frenan mucho: iluminan su cara
// pero la luz no los atraviesa (no se ve a través de las paredes).
export const LIGHT_AIR_DECAY = 0.11;     // ~9 tiles de alcance
export const LIGHT_SOLID_DECAY = 0.28;   // entra 2-3 tiles en la pared
export const TORCH_LIGHT = 1.0;          // antorcha: círculo grande (~9 tiles)
export const PLAYER_VISION = 0.6;        // visión propia: círculo chico (~5 tiles)
export const DARK_COLOR = [4, 6, 14];    // color de la oscuridad

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
// Celda de 36x36 del sprite nuevo, centrada en la caja de colisión y con
// los pies apoyados en su borde de abajo.
export const PLAYER_SPRITE = { w: 36, h: 36, offX: -12, offY: -14 };

export const MODES = {
  normal:   { label: 'Modo normal', desc: 'Si morís, reaparecés y conservás el mundo.' },
  hardcore: { label: 'Hardcore',    desc: 'Si morís, se borra el mundo. Sin respawn.' }
};

// ─── Hambre ───
// Se vacía sola con el tiempo jugado; en 0 empieza a pegar daño cada
// STARVE_INTERVAL_MS. Arriba de HUNGER_REGEN_THRESHOLD (bien alimentado)
// regenera vida de a poco, como premio por comer.
export const MAX_HUNGER = 100;
export const HUNGER_DRAIN_PER_MS = MAX_HUNGER / (10 * 60 * 1000); // se vacía en ~10min jugados
export const HUNGER_REGEN_THRESHOLD = 70;
export const STARVE_DAMAGE = 1;
export const STARVE_INTERVAL_MS = 4000;
export const HP_REGEN_INTERVAL_MS = 5000;
export const HP_REGEN_AMOUNT = 1;

// ─── Ataque cuerpo a cuerpo por arma ───
// Antes cualquier ítem en la mano pegaba lo mismo (ATTACK_DMG) salvo la
// espada, que sumaba su power. Ahora cada arma tiene su propio alcance,
// cadencia y multiplicador de daño: la espada es la única pensada para
// pelear (más rápida, más alcance, daño completo + su power); el resto
// de las herramientas golpea pero peor, y a mano limpia es lo más flojo
// de todo. `dmgMult` se aplica sobre ATTACK_DMG.
export const WEAPON_STATS = {
  sword:   { cooldown: 260, reach: 22, dmgMult: 1 },
  pickaxe: { cooldown: ATTACK_COOLDOWN, reach: 18, dmgMult: 0.75 },
  axe:     { cooldown: ATTACK_COOLDOWN, reach: 18, dmgMult: 0.75 },
  shovel:  { cooldown: ATTACK_COOLDOWN, reach: 16, dmgMult: 0.65 }
};
export const BARE_HAND_ATTACK = { cooldown: ATTACK_COOLDOWN + 40, reach: 14, dmgMult: 0.5 };

// ─── Feedback de golpe recibido ───
// _hitFlashMs es un flash corto y bien visible (además del parpadeo largo
// de invulnerabilidad, que ya existía). El shake es un temblor de cámara
// breve — Engine2D.Camera.shake() ya lo soporta, solo faltaba dispararlo.
export const HIT_FLASH_MS = 140;
export const HIT_SHAKE_INTENSITY = 3;
export const HIT_SHAKE_MS = 180;

// ─── Cámara: deadzone vertical para que saltar no la mueva ───
// Con JUMP_VEL y la gravedad de Physics (0.6 px/step²) un salto sube
// ~48px (v²/2g). Con una deadzone vertical de 110px (55px para cada
// lado del centro) todo salto normal queda adentro y la cámara no se
// mueve — así no se pierde la puntería al colocar bloques mientras se
// salta. El ancho horizontal queda chico porque ahí sí conviene seguir
// de cerca. followSmooth() + smoothing evita el corte brusco cuando sí
// hace falta moverse (caídas largas, cruzar el mapa).
export const CAMERA_DEADZONE_W = 24;
export const CAMERA_DEADZONE_H = 110;
export const CAMERA_SMOOTHING = 0.85;

// ══════════════════════════════════════════════════════════════
//  Inventario general (el de la pantalla de Inventario, aparte de los
//  8 huecos de la hotbar que ya se ven abajo en el HUD).
// ══════════════════════════════════════════════════════════════
export const GENERAL_INV_SLOTS = 10;

// ══════════════════════════════════════════════════════════════
//  Equipamiento — 6 huecos:
//    head/chest/legs/boots → armadura (suman `defense`, reduce el daño
//      de los golpes cuerpo a cuerpo; NO el de caída ni el de hambre).
//    bag                   → agranda el inventario general (`bonusSlots`).
//    special               → reservado para objetos especiales que se
//      van a agregar más adelante — el slot ya está listo, por ahora no
//      hay ningún ítem con equip:'special'.
//
//  Sin arte propio todavía (no hay sprites de armadura), así que cada
//  slot tiene un ícono de emoji de placeholder — mismo criterio que la
//  portada (survi-cover-fallback), que muestra un logo de texto hasta
//  que exista el PNG real.
// ══════════════════════════════════════════════════════════════
// icon = nombre de ícono de survi_icons.js (no emoji)
export const EQUIP_SLOTS = [
  { key: 'head',    label: 'Casco',    icon: 'hardHat' },
  { key: 'chest',   label: 'Pecho',    icon: 'shirt' },
  { key: 'legs',    label: 'Pantalón', icon: 'pants' },
  { key: 'boots',   label: 'Botas',    icon: 'footprints' },
  { key: 'bag',     label: 'Mochila',  icon: 'backpack' },
  { key: 'special', label: 'Especial', icon: 'sparkles' }
];
export const EQUIP_SLOT_ICON = Object.fromEntries(EQUIP_SLOTS.map(s => [s.key, s.icon]));
export const EQUIP_SLOT_KEYS = EQUIP_SLOTS.map(s => s.key);

// Ids de equipo: 3000+ (bloques van por id de tile, comida 2000+,
// herramientas 1000+ — ver arriba). Este es el primer set de armadura
// (piedra, barata, se junta picando desde el arranque); agregar más
// tiers más adelante es solo sumar entradas acá con el mismo patrón.
export const EQUIP = {
  // armadura vieja de piedra: queda para no romper partidas guardadas
  helmetStone: 3001, chestStone: 3002, legsStone: 3003, bootsStone: 3004,
  bag: 3010,          // mochila (mediana) — mismo id que la de antes
  bagSmall: 3011, bagLarge: 3012
};
ITEM_INFO[EQUIP.helmetStone] = { name: 'Casco de piedra',    equip: 'head',  defense: 1, sprite: 'helmet_iron' };
ITEM_INFO[EQUIP.chestStone]  = { name: 'Pechera de piedra',  equip: 'chest', defense: 2, sprite: 'chest_iron' };
ITEM_INFO[EQUIP.legsStone]   = { name: 'Pantalón de piedra', equip: 'legs',  defense: 2, sprite: 'legs_iron' };
ITEM_INFO[EQUIP.bootsStone]  = { name: 'Botas de piedra',    equip: 'boots', defense: 1, sprite: 'boots_iron' };
ITEM_INFO[EQUIP.bagSmall] = { name: 'Bolsa',           equip: 'bag', bonusSlots: 2, sprite: 'bag_small' };
ITEM_INFO[EQUIP.bag]      = { name: 'Mochila',         equip: 'bag', bonusSlots: 4, sprite: 'bag_medium' };
ITEM_INFO[EQUIP.bagLarge] = { name: 'Mochila grande',  equip: 'bag', bonusSlots: 6, sprite: 'bag_large' };

// Armaduras: cuero → esmeralda. Ids 3100 + material*10 + pieza.
// Defensa de cada pieza = base de la pieza × multiplicador del material.
export const ARMOR_MATS = {
  leather: { label: 'cuero',     mult: 1.0 },
  copper:  { label: 'cobre',     mult: 1.4 },
  iron:    { label: 'hierro',    mult: 2.0 },
  gold:    { label: 'oro',       mult: 2.6 },
  diamond: { label: 'diamante',  mult: 3.3 },
  emerald: { label: 'esmeralda', mult: 4.0 }
};
const ARMOR_PIECES = [
  { key: 'helmet', slot: 'head',  label: 'Casco',    base: 1, cost: 5 },
  { key: 'chest',  slot: 'chest', label: 'Pechera',  base: 3, cost: 8 },
  { key: 'legs',   slot: 'legs',  label: 'Pantalón', base: 2, cost: 7 },
  { key: 'boots',  slot: 'boots', label: 'Botas',    base: 1, cost: 4 }
];
export const ARMOR = {};
Object.keys(ARMOR_MATS).forEach((mat, mi) => {
  ARMOR_PIECES.forEach((pc, pi) => {
    const id = 3100 + mi * 10 + pi;
    ARMOR[`${pc.key}_${mat}`] = id;
    ITEM_INFO[id] = {
      name: `${pc.label} de ${ARMOR_MATS[mat].label}`,
      equip: pc.slot, defense: Math.round(pc.base * ARMOR_MATS[mat].mult),
      sprite: `${pc.key}_${mat}`
    };
  });
});

// La defensa ya no se resta entera: reduce un porcentaje del golpe, con
// tope, para que ninguna armadura te deje inmune (ver survi_game.js _damage).
export function armorReduction(defense) {
  return Math.min(0.75, defense / (defense + 18));
}

// Objeto de equipo vacío (los 6 slots en null) — lo usa una partida
// nueva y también sirve para completar los slots que falten en un save
// viejo (de antes de que existiera este sistema), igual que
// `new Array(HOTBAR_SIZE).fill(null)` hace con la hotbar.
export function emptyEquipment() {
  const eq = {};
  for (const s of EQUIP_SLOTS) eq[s.key] = null;
  return eq;
}

// Cuánto suma la defensa de la armadura puesta (head/chest/legs/boots —
// bag y special no defienden). Se resta del daño de golpes cuerpo a
// cuerpo en survi_game.js `_damage()`.
export function totalDefense(equipment) {
  if (!equipment) return 0;
  let def = 0;
  for (const slot of ['head', 'chest', 'legs', 'boots']) {
    const id = equipment[slot];
    if (id && ITEM_INFO[id]) def += ITEM_INFO[id].defense || 0;
  }
  return def;
}

// Cupo del inventario general: la base + el bonus de la mochila puesta
// (si hay una). Sin mochila, GENERAL_INV_SLOTS a secas.
export function totalGeneralSlots(equipment) {
  const bagId = equipment && equipment.bag;
  const bonus = bagId && ITEM_INFO[bagId] ? (ITEM_INFO[bagId].bonusSlots || 0) : 0;
  return GENERAL_INV_SLOTS + bonus;
}

// Cupo total: hotbar (8, fijo) + general (10 + mochila).
export function totalInvSlots(equipment) {
  return HOTBAR_SIZE + totalGeneralSlots(equipment);
}

// ══════════════════════════════════════════════════════════════
//  Crafteo
//
//  Cada receta: { id, result, resultQty, inputs }. `inputs` es una lista
//  de ingredientes, cada uno { id, qty } o { anyOf: [ids], qty } —
//  `label` (opcional) = nombre corto a mostrar ("Madera" en vez de listar los 3 troncos).
//  anyOf sirve para "cualquiera de estos" (la madera, por ejemplo: no
//  tiene sentido pedir el tronco de un árbol puntual si el jugador
//  junta indistintamente de los 3 biomas con árbol).
// ══════════════════════════════════════════════════════════════
const WOOD_IDS = [T.WOOD, TID.pradera_TRUNK, TID.jungle_TRUNK];

export const RECIPES = [];
{
  // `cat` = pestaña de la pantalla de crafteo.
  // `station` = dónde se hace: 'hand' (desde el inventario) o 'table'
  // (mesa de crafteo). En la mesa también se ven las de mano.
  const add = (cat, id, result, resultQty, inputs, station = 'table') =>
    RECIPES.push({ cat, id, result, resultQty, inputs, station });
  const COAL = { anyOf: [MAT.coal, T.COAL], qty: 1, label: 'Carbón' };   // carbón (o el bloque viejo de carbón)
  const STICKS = (qty) => ({ id: MAT.sticks, qty });

  // ── Básicos (a mano, desde el inventario) ──
  const WOOD = (qty) => ({ anyOf: WOOD_IDS, qty, label: 'Madera' });
  add('basicos', 'sticks',      MAT.sticks,    4, [WOOD(1)], 'hand');
  add('basicos', 'torch',       T.TORCH,       4, [STICKS(1), COAL], 'hand');
  add('basicos', 'flint',       MAT.flint,     1, [{ id: T.GRAVEL, qty: 6 }], 'hand');
  add('basicos', 'arrow',       MAT.arrow,     3, [{ anyOf: [MAT.flint, MAT.ironIngot], qty: 2, label: 'Flint o lingote de hierro' }, STICKS(2)], 'hand');
  add('basicos', 'craft_table', T.CRAFT_TABLE, 1, [WOOD(4)], 'hand');

  // ── Estaciones (en la mesa) ──
  add('estaciones', 'furnace', T.FURNACE, 1, [{ id: T.STONE, qty: 8 }]);
  add('estaciones', 'chest',   T.CHEST,   1, [WOOD(8)]);

  // ── Herramientas: material de cada tier ──
  const toolMat = {
    wood: { anyOf: WOOD_IDS, label: 'Madera' }, stone: { id: T.STONE }, copper: { id: MAT.copperIngot },
    iron: { id: MAT.ironIngot }, gold: { id: MAT.goldIngot },
    diamond: { id: MAT.diamond }, emerald: { id: MAT.emerald }
  };
  // [cantidad de material, cantidad de palos]
  const toolCost = { pickaxe: [3, 2], axe: [3, 2], shovel: [1, 2], sword: [2, 1] };
  for (const mat of MATERIAL_ORDER) {
    for (const tool of TOOL_KINDS) {
      const [qm, qs] = toolCost[tool];
      add(tool === 'sword' ? 'armas' : 'herramientas', `${tool}_${mat}`, TOOLS[`${tool}_${mat}`], 1,
          [{ ...toolMat[mat], qty: qm }, STICKS(qs)]);
    }
  }

  // ── Armadura ──
  const armorMat = {
    leather: MAT.leather, copper: MAT.copperIngot, iron: MAT.ironIngot,
    gold: MAT.goldIngot, diamond: MAT.diamond, emerald: MAT.emerald
  };
  for (const mat of Object.keys(ARMOR_MATS)) {
    for (const pc of ARMOR_PIECES) {
      add('armadura', `${pc.key}_${mat}`, ARMOR[`${pc.key}_${mat}`], 1, [{ id: armorMat[mat], qty: pc.cost }]);
    }
  }

  // ── Mochilas ── (cuando haya animales, el cuero se puede sumar acá)
  add('mochilas', 'bag_small', EQUIP.bagSmall, 1, [{ id: MAT.leaves, qty: 8 }, STICKS(2)]);
  add('mochilas', 'bag',       EQUIP.bag,      1, [{ id: MAT.leaves, qty: 12 }, { id: MAT.copperIngot, qty: 3 }]);
  add('mochilas', 'bag_large', EQUIP.bagLarge, 1, [{ id: MAT.leaves, qty: 20 }, { id: MAT.ironIngot, qty: 4 }, { id: MAT.goldIngot, qty: 1 }]);
}

// ══════════ Horno ══════════
// Qué se transforma en qué (se completa abajo con los minerales).
export const SMELT = {
  [FOOD.meatRaw]: FOOD.meatCooked, [FOOD.egg]: FOOD.eggCooked, [FOOD.potato]: FOOD.potatoBaked,
  [FOOD.fishRaw]: FOOD.fishCooked, [FOOD.fish2Raw]: FOOD.fishCooked,
  [FOOD.squidRaw]: FOOD.squidCooked, [FOOD.eelRaw]: FOOD.eelCooked
};
SMELT[MAT.copperRaw] = MAT.copperIngot;
SMELT[MAT.ironRaw] = MAT.ironIngot;
SMELT[MAT.goldRaw] = MAT.goldIngot;
export const SMELT_MS = 4000;          // tiempo por ítem
// Combustible: cuántos ítems cocina cada unidad.
export const FUEL = { [MAT.coal]: 8, [T.COAL]: 8, [MAT.sticks]: 0.5 };
for (const id of WOOD_IDS) FUEL[id] = 1.5;

export const CRAFT_CATS = [
  { key: 'basicos',      label: 'Básicos' },
  { key: 'estaciones',   label: 'Estaciones' },
  { key: 'herramientas', label: 'Herramientas' },
  { key: 'armas',        label: 'Armas' },
  { key: 'armadura',     label: 'Armadura' },
  { key: 'mochilas',     label: 'Mochilas' }
];

export function ingredientHave(inventory, ingredient) {
  if (ingredient.anyOf) return ingredient.anyOf.reduce((s, id) => s + (inventory[id] || 0), 0);
  return inventory[ingredient.id] || 0;
}

function hasIngredient(inventory, ingredient) {
  return ingredientHave(inventory, ingredient) >= ingredient.qty;
}

// ¿Alcanzan los materiales para esta receta?
export function canCraft(inventory, recipe) {
  return recipe.inputs.every(ing => hasIngredient(inventory, ing));
}

// Descuenta los materiales de `inventory` (lo muta). Asume que ya se
// llamó canCraft() antes — no vuelve a validar. Con anyOf, gasta de la
// primera alternativa que tenga stock antes de pasar a la siguiente.
export function consumeRecipe(inventory, recipe) {
  for (const ing of recipe.inputs) {
    let left = ing.qty;
    const ids = ing.anyOf || [ing.id];
    for (const id of ids) {
      if (left <= 0) break;
      const have = inventory[id] || 0;
      const take = Math.min(have, left);
      if (take <= 0) continue;
      const remain = have - take;
      if (remain > 0) inventory[id] = remain; else delete inventory[id];
      left -= take;
    }
  }
}

// ¿El resultado va a entrar en el inventario una vez descontados los
// materiales? Simula el consumo sobre una COPIA (no toca `inventory`):
// si el resultado es un ítem que ya tenías, siempre entra (no ocupa un
// slot nuevo, solo suma al stack); si es nuevo, depende de si consumir
// los materiales liberó algún slot y de cuánto cupo total hay.
export function craftWouldFit(inventory, recipe, totalSlots) {
  const sim = { ...inventory };
  consumeRecipe(sim, recipe);
  if (recipe.result in sim) return true;
  return Object.keys(sim).length < totalSlots;
}
