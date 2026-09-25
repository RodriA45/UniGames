// ══════════════════════════════════════════════════════════════
//   Pixel Survi — survi_config.js
//   Solo datos: constantes del mundo, ids de tile, familias de autotile,
//   biomas, drops e ítems. No importa nada, así lo puede leer cualquier
//   módulo (models/sprites-survi.js incluido).
//
//   Clase SurviConfig: configuración del juego (tamaños, tiles, ítems, herramientas, armaduras, recetas, hornos, biomas, física) y las reglas de equipo y crafteo. Solo miembros static: no se instancia.
// ══════════════════════════════════════════════════════════════

export class SurviConfig {
  static TILE = 16;
  // 500 x 250: el mundo es más ancho que hondo (se explora más de costado).
  // No afecta los FPS: el mapa se dibuja por chunks (solo los visibles) y la
  // luz se calcula solo en la zona de la cámara. Lo que crece es la
  // generación (una vez, ~60 ms) y el guardado (comprimido, ver GestorGuardado).
  static COLS = 500;
  static ROWS = 250;
  static WORLD_W = SurviConfig.COLS * SurviConfig.TILE;
  static WORLD_H = SurviConfig.ROWS * SurviConfig.TILE;
  static VIEW_W = 480; // resolución interna del canvas (30 tiles)
  static VIEW_H = 288; // 18 tiles de alto
  static COVER_SRC = 'src/motor2d/games/pixel-survi/models/portada.png';
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
  // Las 10 piezas del "blob" 3x3 de cada hoja de assert/world:
  //   C  = relleno (interior)          T/B/L/R = bordes
  //   TL/TR/BL/BR = esquinas           S = bloque suelto
  static FAM_PIECES = ['C', 'T', 'B', 'L', 'R', 'TL', 'TR', 'BL', 'BR', 'S'];
  static FAM_KEYS = ['grass', 'sand', 'snow', 'jgrass', 'cave'];
  static SIMPLE_KEYS = ['dirt', 'stone', 'ice', 'bedrock', 'coal', 'iron', 'gold', 'cactus', 'gravel'];
  // Variantes de piedra: NO son autotile (no conectan con vecinos, es puro
  // ruido visual) — las 4 comparten drop/dureza/herramienta con TID.stone
  // (ver DROPS/HARDNESS/TOOL_FOR más abajo), así que minar cualquiera te da
  // el mismo ítem "Piedra" de siempre. A partir de DEEP_STONE_ROW (los
  // últimos 100 bloques de profundidad, de las 250 filas del mapa) se usa
  // la paleta oscura en vez de la normal — ver generateWorld.
  static STONE_VARIANT_KEYS = ['stone_1', 'stone_2', 'stone_3', 'stone_4'];
  static DARK_STONE_VARIANT_KEYS = ['darkstone_1', 'darkstone_2', 'darkstone_3', 'darkstone_4'];
  static DEEP_STONE_ROW = SurviConfig.ROWS - 100;
  // Piezas de hoja: el blob 4x3 (dos variantes de fila media), la columna
  // angosta, la mata suelta, la copa por donde entra el tronco y las dos
  // ramas con follaje.
  static LEAF_PIECES = [
    'LTL',
    'LT',
    'LTR',
    'LL',
    'LC',
    'LR',
    'LL2',
    'LC2',
    'LR2',
    'LBL',
    'LB',
    'LBR',
    'LVT',
    'LVM',
    'LVB',
    'LBLOB',
    'LCAN',
    'LARM_L',
    'LARM_R',
  ];
  // Piezas de madera.
  static WOOD_PIECES = ['TRUNK', 'TRUNK_K', 'TRUNK_BR', 'TRUNK_BASE', 'TRUNK_R', 'STUB', 'BRANCH_H', 'BRANCH_S'];
  static TREE_PIECES = [...SurviConfig.LEAF_PIECES, ...SurviConfig.WOOD_PIECES];
  static TREE_KEYS = ['forest', 'pradera', 'jungle'];
  // TID.grass_T, TID.stone, TID.jungle_TRUNK_K, …
  static TID = {};
  static {
    let n = 0;
    for (const f of SurviConfig.FAM_KEYS) for (const p of SurviConfig.FAM_PIECES) SurviConfig.TID[`${f}_${p}`] = ++n;
    for (const s of SurviConfig.SIMPLE_KEYS) SurviConfig.TID[s] = ++n;
    for (const s of SurviConfig.STONE_VARIANT_KEYS) SurviConfig.TID[s] = ++n;
    for (const s of SurviConfig.DARK_STONE_VARIANT_KEYS) SurviConfig.TID[s] = ++n;
    for (const t of SurviConfig.TREE_KEYS) for (const p of SurviConfig.TREE_PIECES) SurviConfig.TID[`${t}_${p}`] = ++n;
    // Agregados después: SIEMPRE al final, así no se corren los ids de los
    // bloques que ya están guardados en los mundos.
    SurviConfig.TID.torch = ++n;
    SurviConfig.TID.copper_ore = ++n;
    SurviConfig.TID.diamond_ore = ++n;
    SurviConfig.TID.emerald_ore = ++n;
    SurviConfig.TID.craft_table = ++n;
    SurviConfig.TID.furnace = ++n;
    SurviConfig.TID.furnace_on = ++n; // horno prendido (misma cosa, otro dibujo + da luz)
    SurviConfig.TID.chest = ++n;
  }

  static TILE_COUNT = Object.keys(SurviConfig.TID).length; // 139
  static TILESET_COLS = 8;
  //  Autotile
  //
  //  Cada familia sabe qué pieza usar según los 4 vecinos. La máscara es
  //  U=8, D=4, L=2, R=1 (1 = hay vecino que "conecta").
  //
  //  Con 10 piezas se cubren las 16 combinaciones: las que pedirían una
  //  columna angosta (solo arriba, solo abajo, arriba+abajo) caen en
  //  T / B / C, que a 16px se lee igual. Las hojas sí tienen columna
  //  angosta propia (LVT/LVM/LVB).
  static MASK_PIECE = {
    //        0     1     2     3     4     5     6     7
    terrain: [
      'S',
      'TL',
      'TR',
      'T',
      'T',
      'TL',
      'TR',
      'T',
      //        8     9    10    11    12    13    14    15
      'B',
      'BL',
      'BR',
      'B',
      'C',
      'L',
      'R',
      'C',
    ],
    leaf: ['LBLOB', 'LTL', 'LTR', 'LT', 'LVT', 'LTL', 'LTR', 'LT', 'LVB', 'LBL', 'LBR', 'LB', 'LVM', 'LL', 'LR', 'LC'],
  };
  // Variantes alternativas (la segunda fila del blob de hojas), para que una
  // copa grande no sea un bloque plano de un solo tile repetido.
  static LEAF_ALT = {
    LL: 'LL2',
    LC: 'LC2',
    LR: 'LR2',
  };
  static FAMILIES = {};
  static {
    for (const k of SurviConfig.FAM_KEYS) {
      const pieces = {};
      for (const p of SurviConfig.FAM_PIECES) pieces[p] = SurviConfig.TID[`${k}_${p}`];
      SurviConfig.FAMILIES[k] = {
        kind: 'terrain',
        pieces,
        ids: new Set(Object.values(pieces)),
      };
    }
  }

  static {
    for (const k of SurviConfig.TREE_KEYS) {
      const pieces = {};
      for (const p of SurviConfig.LEAF_PIECES)
        if (p !== 'LCAN' && p !== 'LARM_L' && p !== 'LARM_R') {
          pieces[p] = SurviConfig.TID[`${k}_${p}`];
        }
      SurviConfig.FAMILIES[`${k}Leaf`] = {
        kind: 'leaf',
        pieces,
        // LCAN y las ramas con follaje cuentan como hoja para la máscara, pero
        // NO se recalculan (si no, el autotile borraría la copa del tronco).
        ids: new Set([
          ...Object.values(pieces),
          SurviConfig.TID[`${k}_LCAN`],
          SurviConfig.TID[`${k}_LARM_L`],
          SurviConfig.TID[`${k}_LARM_R`],
        ]),
      };
    }
  }

  // Todo lo que "conecta" para el autotile de terreno: las 5 familias + los
  // rellenos simples (tierra, piedra, vetas, hielo, bedrock) + las variantes
  // de piedra (normal y oscura) — así el pasto/tierra de arriba las trata
  // como piso sólido de siempre y no les dibuja un borde expuesto de más.
  static TERRAIN_IDS = new Set();
  static {
    for (const k of SurviConfig.FAM_KEYS) for (const id of SurviConfig.FAMILIES[k].ids) SurviConfig.TERRAIN_IDS.add(id);
  }

  static {
    for (const k of [
      'dirt',
      'stone',
      'ice',
      'bedrock',
      'coal',
      'iron',
      'gold',
      'gravel',
      'copper_ore',
      'diamond_ore',
      'emerald_ore',
    ]) {
      SurviConfig.TERRAIN_IDS.add(SurviConfig.TID[k]);
    }
  }

  static {
    for (const k of [...SurviConfig.STONE_VARIANT_KEYS, ...SurviConfig.DARK_STONE_VARIANT_KEYS])
      SurviConfig.TERRAIN_IDS.add(SurviConfig.TID[k]);
  }

  static {
    for (const k of SurviConfig.FAM_KEYS) SurviConfig.FAMILIES[k].connect = SurviConfig.TERRAIN_IDS;
  }

  static {
    for (const k of SurviConfig.TREE_KEYS)
      SurviConfig.FAMILIES[`${k}Leaf`].connect = SurviConfig.FAMILIES[`${k}Leaf`].ids;
  }

  // id de tile → clave de familia. Solo las piezas que el autotile puede
  // generar: lo que no está acá se deja como está.
  static FAMILY_OF = new Map();
  static {
    for (const [key, fam] of Object.entries(SurviConfig.FAMILIES)) {
      for (const id of Object.values(fam.pieces)) SurviConfig.FAMILY_OF.set(id, key);
    }
  }

  // ─── Compatibilidad / atajos de lectura ───
  // Ids "canónicos": el que representa al material (y el que se coloca).
  static T = {
    DIRT: SurviConfig.TID.dirt,
    GRASS: SurviConfig.TID.grass_C,
    SAND: SurviConfig.TID.sand_C,
    SNOW: SurviConfig.TID.snow_C,
    JGRASS: SurviConfig.TID.jgrass_C,
    CAVESTONE: SurviConfig.TID.cave_C,
    STONE: SurviConfig.TID.stone,
    ICE: SurviConfig.TID.ice,
    BEDROCK: SurviConfig.TID.bedrock,
    COAL: SurviConfig.TID.coal,
    IRON: SurviConfig.TID.iron,
    GOLD: SurviConfig.TID.gold,
    CACTUS: SurviConfig.TID.cactus,
    GRAVEL: SurviConfig.TID.gravel,
    COPPER_ORE: SurviConfig.TID.copper_ore,
    DIAMOND_ORE: SurviConfig.TID.diamond_ore,
    EMERALD_ORE: SurviConfig.TID.emerald_ore,
    TORCH: SurviConfig.TID.torch,
    CRAFT_TABLE: SurviConfig.TID.craft_table,
    FURNACE: SurviConfig.TID.furnace,
    FURNACE_ON: SurviConfig.TID.furnace_on,
    CHEST: SurviConfig.TID.chest,
    WOOD: SurviConfig.TID.forest_TRUNK,
    LEAVES: SurviConfig.TID.forest_LC,
    JLEAVES: SurviConfig.TID.jungle_LC,
  };
  // Sólidos: el terreno y el cactus. Los árboles NO frenan — se atraviesan,
  // como en Terraria (si el tronco frenara, un bosque sería una pared).
  static SOLID_IDS = new Set([...SurviConfig.TERRAIN_IDS, SurviConfig.TID.cactus]);
  // ══════════ Drops ══════════
  // Cualquier variante de una familia deja el material de esa familia;
  // cualquier tronco o rama deja el TRONCO de su paleta; cualquier hoja,
  // el FOLLAJE de su paleta.
  static DROPS = {};
  static {
    const famDrop = {
      grass: SurviConfig.TID.grass_C,
      sand: SurviConfig.TID.sand_C,
      snow: SurviConfig.TID.snow_C,
      jgrass: SurviConfig.TID.jgrass_C,
      cave: SurviConfig.TID.cave_C,
    };
    for (const [k, drop] of Object.entries(famDrop)) {
      for (const id of SurviConfig.FAMILIES[k].ids) SurviConfig.DROPS[id] = drop;
    }
    for (const k of SurviConfig.SIMPLE_KEYS) SurviConfig.DROPS[SurviConfig.TID[k]] = SurviConfig.TID[k];
    // Las 8 variantes de piedra (normal + oscura) son puro dibujo — al
    // picarlas dan la misma "Piedra" de siempre (TID.stone), no un ítem
    // por variante.
    for (const k of [...SurviConfig.STONE_VARIANT_KEYS, ...SurviConfig.DARK_STONE_VARIANT_KEYS])
      SurviConfig.DROPS[SurviConfig.TID[k]] = SurviConfig.TID.stone;
    SurviConfig.DROPS[SurviConfig.TID.torch] = SurviConfig.TID.torch;
    SurviConfig.DROPS[SurviConfig.TID.craft_table] = SurviConfig.TID.craft_table;
    SurviConfig.DROPS[SurviConfig.TID.furnace] = SurviConfig.TID.furnace;
    SurviConfig.DROPS[SurviConfig.TID.furnace_on] = SurviConfig.TID.furnace;
    SurviConfig.DROPS[SurviConfig.TID.chest] = SurviConfig.TID.chest;
    for (const pal of SurviConfig.TREE_KEYS) {
      for (const p of SurviConfig.WOOD_PIECES)
        SurviConfig.DROPS[SurviConfig.TID[`${pal}_${p}`]] = SurviConfig.TID[`${pal}_TRUNK`];
      // las hojas sueltan el ítem "Hojas" (MAT.leaves): ver más abajo, en Materiales
      for (const p of SurviConfig.LEAF_PIECES)
        SurviConfig.DROPS[SurviConfig.TID[`${pal}_${p}`]] = SurviConfig.TID[`${pal}_LC`];
    }
  }

  // ══════════ Dureza (segundos de picado a mano) y herramienta ══════════
  static HARDNESS = {};
  static TOOL_FOR = {};
  static {
    const setFam = (k, hard, tool) => {
      for (const id of SurviConfig.FAMILIES[k].ids) {
        SurviConfig.HARDNESS[id] = hard;
        if (tool) SurviConfig.TOOL_FOR[id] = tool;
      }
    };
    setFam('grass', 0.35, 'shovel');
    setFam('sand', 0.3, 'shovel');
    setFam('snow', 0.28, 'shovel');
    setFam('jgrass', 0.35, 'shovel');
    setFam('cave', 0.95, 'pickaxe');
    const simple = {
      dirt: [0.35, 'shovel'],
      stone: [0.85, 'pickaxe'],
      ice: [0.55, 'pickaxe'],
      bedrock: [999, 'pickaxe'],
      coal: [1.1, 'pickaxe'],
      iron: [1.4, 'pickaxe'],
      gold: [1.6, 'pickaxe'],
      cactus: [0.4, 'axe'],
      gravel: [0.5, 'shovel'],
    };
    for (const [k, [h, tool]] of Object.entries(simple)) {
      SurviConfig.HARDNESS[SurviConfig.TID[k]] = h;
      SurviConfig.TOOL_FOR[SurviConfig.TID[k]] = tool;
    }
    // Mismo pico/dureza que la piedra normal para las 8 variantes.
    for (const k of [...SurviConfig.STONE_VARIANT_KEYS, ...SurviConfig.DARK_STONE_VARIANT_KEYS]) {
      SurviConfig.HARDNESS[SurviConfig.TID[k]] = SurviConfig.HARDNESS[SurviConfig.TID.stone];
      SurviConfig.TOOL_FOR[SurviConfig.TID[k]] = 'pickaxe';
    }
    SurviConfig.HARDNESS[SurviConfig.TID.torch] = 0.05;
    SurviConfig.TOOL_FOR[SurviConfig.TID.torch] = 'axe'; // sale al toque con cualquier cosa
    SurviConfig.HARDNESS[SurviConfig.TID.copper_ore] = 1.2;
    SurviConfig.TOOL_FOR[SurviConfig.TID.copper_ore] = 'pickaxe';
    SurviConfig.HARDNESS[SurviConfig.TID.diamond_ore] = 2.2;
    SurviConfig.TOOL_FOR[SurviConfig.TID.diamond_ore] = 'pickaxe';
    SurviConfig.HARDNESS[SurviConfig.TID.emerald_ore] = 2.6;
    SurviConfig.TOOL_FOR[SurviConfig.TID.emerald_ore] = 'pickaxe';
    SurviConfig.HARDNESS[SurviConfig.TID.craft_table] = 0.8;
    SurviConfig.TOOL_FOR[SurviConfig.TID.craft_table] = 'axe';
    SurviConfig.HARDNESS[SurviConfig.TID.furnace] = 1.2;
    SurviConfig.TOOL_FOR[SurviConfig.TID.furnace] = 'pickaxe';
    SurviConfig.HARDNESS[SurviConfig.TID.furnace_on] = 1.2;
    SurviConfig.TOOL_FOR[SurviConfig.TID.furnace_on] = 'pickaxe';
    SurviConfig.HARDNESS[SurviConfig.TID.chest] = 0.8;
    SurviConfig.TOOL_FOR[SurviConfig.TID.chest] = 'axe';
    for (const pal of SurviConfig.TREE_KEYS) {
      for (const p of SurviConfig.WOOD_PIECES) {
        SurviConfig.HARDNESS[SurviConfig.TID[`${pal}_${p}`]] = 0.55;
        SurviConfig.TOOL_FOR[SurviConfig.TID[`${pal}_${p}`]] = 'axe';
      }
      for (const p of SurviConfig.LEAF_PIECES) {
        SurviConfig.HARDNESS[SurviConfig.TID[`${pal}_${p}`]] = 0.15;
      }
    }
  }

  // ══════════ Ítems ══════════
  // Los bloques usan el mismo id que el tile canónico (son colocables: al
  // colocarlos el juego les recalcula la variante con el autotile).
  // Las herramientas usan ids >= 1000 y NO se pueden colocar.
  static ITEM_INFO = {};
  static {
    const blocks = {
      [SurviConfig.TID.grass_C]: 'Tierra con pasto',
      [SurviConfig.TID.dirt]: 'Tierra',
      [SurviConfig.TID.sand_C]: 'Arena',
      [SurviConfig.TID.snow_C]: 'Nieve',
      [SurviConfig.TID.jgrass_C]: 'Tierra de selva',
      [SurviConfig.TID.cave_C]: 'Roca de cueva',
      [SurviConfig.TID.gravel]: 'Grava',
      [SurviConfig.TID.stone]: 'Piedra',
      [SurviConfig.TID.ice]: 'Hielo',
      [SurviConfig.TID.coal]: 'Mineral de carbón',
      [SurviConfig.TID.iron]: 'Mineral de hierro',
      [SurviConfig.TID.gold]: 'Mineral de oro',
      [SurviConfig.TID.cactus]: 'Cactus',
      [SurviConfig.TID.forest_TRUNK]: 'Tronco de roble',
      [SurviConfig.TID.pradera_TRUNK]: 'Tronco claro',
      [SurviConfig.TID.jungle_TRUNK]: 'Tronco de selva',
      [SurviConfig.TID.forest_LC]: 'Bloque de hojas',
      [SurviConfig.TID.pradera_LC]: 'Hojas de pradera',
      [SurviConfig.TID.jungle_LC]: 'Follaje de selva',
      [SurviConfig.TID.torch]: 'Antorcha',
      [SurviConfig.TID.craft_table]: 'Mesa de crafteo',
      [SurviConfig.TID.furnace]: 'Horno',
      [SurviConfig.TID.chest]: 'Cofre',
    };
    for (const [id, name] of Object.entries(blocks)) {
      SurviConfig.ITEM_INFO[id] = {
        name,
        place: Number(id),
      };
    }
  }

  // ══════════ Comida ══════════
  // Ids >= 2000 para no pisar bloques (van por id de tile) ni herramientas
  // (1000+). No son colocables (no tienen `place`): se comen con clic
  // derecho estando seleccionadas en la hotbar (ver survi_game.js `_eat`).
  static FOOD_IDS = {
    berry: 2001,
    apple: 2002,
  };
  // Estaciones: bloques que se usan con clic derecho (abren una pantalla).
  // No son sólidos (se pasan por delante, como en Terraria) y se apoyan
  // sobre un bloque sólido.
  static STATION_IDS = new Set([
    SurviConfig.TID.craft_table,
    SurviConfig.TID.furnace,
    SurviConfig.TID.furnace_on,
    SurviConfig.TID.chest,
  ]);
  static CHEST_SLOTS = 16; // tipos de ítem distintos que entran en un cofre
  // Comida que se consigue cruda y se cocina en el horno (carne, huevo y
  // pescado llegan con animales/pesca; las recetas ya quedan listas).
  static FOOD = {
    meatRaw: 2010,
    meatCooked: 2011,
    meatRotten: 2012,
    egg: 2013,
    eggCooked: 2014,
    potato: 2015,
    potatoBaked: 2016,
    bread: 2017,
    watermelon: 2018,
    carrot: 2019,
    fishRaw: 2020,
    fish2Raw: 2021,
    fishCooked: 2022,
    squidRaw: 2023,
    squidCooked: 2024,
    eelRaw: 2025,
    eelCooked: 2026,
  };
  static {
    const f = [
      ['meatRaw', 'Carne cruda', 6, 'meat_raw'],
      ['meatCooked', 'Carne cocida', 32, 'meat_cooked'],
      ['meatRotten', 'Carne podrida', 4, 'meat_rotten'],
      ['egg', 'Huevo', 4, 'egg'],
      ['eggCooked', 'Huevo frito', 18, 'egg_cooked'],
      ['potato', 'Papa', 8, 'potato'],
      ['potatoBaked', 'Papa al horno', 26, 'potato_baked'],
      ['bread', 'Pan', 28, 'bread'],
      ['watermelon', 'Sandía', 12, 'watermelon_slice'],
      ['carrot', 'Zanahoria', 12, 'carrot'],
      ['fishRaw', 'Pescado crudo', 6, 'fish_raw'],
      ['fish2Raw', 'Salmón crudo', 6, 'fish2_raw'],
      ['fishCooked', 'Pescado cocido', 24, 'fish_cooked'],
      ['squidRaw', 'Calamar crudo', 6, 'squid_raw'],
      ['squidCooked', 'Calamar cocido', 22, 'squid_cooked'],
      ['eelRaw', 'Anguila cruda', 6, 'eel_raw'],
      ['eelCooked', 'Anguila cocida', 24, 'eel_cooked'],
    ];
    for (const [k, name, food, sprite] of f)
      SurviConfig.ITEM_INFO[SurviConfig.FOOD[k]] = {
        name,
        food,
        sprite,
      };
  }

  static {
    SurviConfig.ITEM_INFO[SurviConfig.FOOD_IDS.berry] = {
      name: 'Bayas',
      food: 14,
    };
  }

  static {
    SurviConfig.ITEM_INFO[SurviConfig.FOOD_IDS.apple] = {
      name: 'Manzana',
      food: 26,
      sprite: 'apple',
    };
  }

  // Al romper hojas hay una chance de que además caiga comida — cada
  // paleta de árbol (forest/pradera/jungle) tiene la suya.
  static LEAF_FOOD_DROP = {
    forest: {
      id: SurviConfig.FOOD_IDS.apple,
      chance: 0.045,
    },
    pradera: {
      id: SurviConfig.FOOD_IDS.berry,
      chance: 0.05,
    },
    jungle: {
      id: SurviConfig.FOOD_IDS.berry,
      chance: 0.06,
    },
  };
  // Palabra de la paleta de árbol si el tile roto era una hoja (para el
  // drop de comida de arriba), o null si no es una hoja.
  static leafPalette(tileId) {
    const key = SurviConfig.FAMILY_OF.get(tileId);
    if (key && key.endsWith('Leaf')) return key.slice(0, -4);
    return null;
  }

  // ══════════ Materiales sueltos (no se colocan) ══════════
  // Ids 4000+. `sprite` = nombre en el atlas de ítems (models/sprites-survi.js).
  static MAT = {
    string: 4001,
    leaves: 4002,
    sticks: 4003,
    flint: 4004,
    leather: 4005,
    copperRaw: 4006,
    ironRaw: 4007,
    goldRaw: 4008,
    coal: 4009,
    copperIngot: 4010,
    ironIngot: 4011,
    goldIngot: 4012,
    diamond: 4013,
    emerald: 4014,
    arrow: 4015,
  };
  static {
    const m = [
      ['string', 'Hilo', 'string'],
      ['leaves', 'Hojas', 'leaves'],
      ['sticks', 'Palo', 'sticks'],
      ['flint', 'Flint', 'flint'],
      ['leather', 'Cuero', 'leather'],
      ['copperRaw', 'Cobre crudo', 'copper_raw'],
      ['ironRaw', 'Hierro crudo', 'iron_raw'],
      ['goldRaw', 'Oro crudo', 'gold_raw'],
      ['coal', 'Carbón', 'coal'],
      ['copperIngot', 'Lingote de cobre', 'copper_ingot'],
      ['ironIngot', 'Lingote de hierro', 'iron_ingot'],
      ['goldIngot', 'Lingote de oro', 'gold_ingot'],
      ['diamond', 'Diamante', 'diamond'],
      ['emerald', 'Esmeralda', 'emerald'],
      ['arrow', 'Flecha', 'arrow'],
    ];
    for (const [k, name, sprite] of m)
      SurviConfig.ITEM_INFO[SurviConfig.MAT[k]] = {
        name,
        sprite,
      };
  }

  // Drops de los minerales: sueltan su versión cruda (o la gema/carbón).
  // `tier` = pico mínimo para que suelte algo (ver MATERIALS.tier): con un
  // pico peor el bloque se rompe igual, pero no da nada (como en Minecraft).
  static ORE_DROPS = {
    [SurviConfig.TID.coal]: {
      drop: SurviConfig.MAT.coal,
      tier: 0,
    },
    [SurviConfig.TID.copper_ore]: {
      drop: SurviConfig.MAT.copperRaw,
      tier: 1,
    },
    [SurviConfig.TID.iron]: {
      drop: SurviConfig.MAT.ironRaw,
      tier: 2,
    },
    [SurviConfig.TID.gold]: {
      drop: SurviConfig.MAT.goldRaw,
      tier: 3,
    },
    [SurviConfig.TID.diamond_ore]: {
      drop: SurviConfig.MAT.diamond,
      tier: 4,
    },
    [SurviConfig.TID.emerald_ore]: {
      drop: SurviConfig.MAT.emerald,
      tier: 5,
    },
  };
  static {
    for (const [id, o] of Object.entries(SurviConfig.ORE_DROPS)) SurviConfig.DROPS[id] = o.drop;
  }

  // Las hojas sueltan el ítem Hojas (ya no el bloque de hoja).
  static {
    for (const pal of SurviConfig.TREE_KEYS)
      for (const p of SurviConfig.LEAF_PIECES)
        SurviConfig.DROPS[SurviConfig.TID[`${pal}_${p}`]] = SurviConfig.MAT.leaves;
  }

  // ══════════ Materiales de herramienta ══════════
  // Cada uno mejor que el anterior. power = velocidad de picado extra y
  // daño de la espada; tier = qué minerales puede sacar el pico.
  // El orden de las 4 primeras claves NO se toca: los ids de herramienta
  // salen del índice, y así las partidas viejas (cobre/plata/oro/diamante)
  // siguen teniendo sus herramientas (la vieja "plata" pasa a ser hierro).
  static MATERIALS = {
    copper: {
      durabilidad: 200, // usos: cada bloque roto o cada golpe a un mob
      label: 'cobre',
      power: 1.0,
      tier: 2,
    },
    iron: {
      durabilidad: 300, // usos: cada bloque roto o cada golpe a un mob
      label: 'hierro',
      power: 1.6,
      tier: 3,
    },
    gold: {
      durabilidad: 450, // usos: cada bloque roto o cada golpe a un mob
      label: 'oro',
      power: 2.2,
      tier: 4,
    },
    diamond: {
      durabilidad: 1000, // usos: cada bloque roto o cada golpe a un mob
      label: 'diamante',
      power: 3.0,
      tier: 5,
    },
    wood: {
      durabilidad: 60, // usos: cada bloque roto o cada golpe a un mob
      label: 'madera',
      power: 0.3,
      tier: 0,
    },
    stone: {
      durabilidad: 130, // usos: cada bloque roto o cada golpe a un mob
      label: 'piedra',
      power: 0.6,
      tier: 1,
    },
    emerald: {
      durabilidad: 1500, // usos: cada bloque roto o cada golpe a un mob
      label: 'esmeralda',
      power: 3.8,
      tier: 6,
    },
  };
  // Orden de progresión (para listas y recetas)
  static MATERIAL_ORDER = ['wood', 'stone', 'copper', 'iron', 'gold', 'diamond', 'emerald'];
  static TOOL_LABEL = {
    pickaxe: 'Pico',
    axe: 'Hacha',
    shovel: 'Pala',
    sword: 'Espada',
  };
  static TOOL_KINDS = ['pickaxe', 'axe', 'shovel', 'sword'];
  // Ids de herramienta: 1000 + índiceMaterial*10 + índiceTipo
  static TOOLS = {};
  static {
    Object.keys(SurviConfig.MATERIALS).forEach((mat, mi) => {
      SurviConfig.TOOL_KINDS.forEach((tool, ti) => {
        const id = 1000 + mi * 10 + ti;
        SurviConfig.TOOLS[`${tool}_${mat}`] = id;
        SurviConfig.ITEM_INFO[id] = {
          name: `${SurviConfig.TOOL_LABEL[tool]} de ${SurviConfig.MATERIALS[mat].label}`,
          tool,
          mat,
          power: SurviConfig.MATERIALS[mat].power,
          tier: SurviConfig.MATERIALS[mat].tier,
          durabilidad: SurviConfig.MATERIALS[mat].durabilidad,
          sprite: `${tool}_${mat}`,
        };
      });
    });
  }

  // Con lo que arranca una partida nueva: herramientas de madera.
  static STARTER_TOOLS = [
    SurviConfig.TOOLS.pickaxe_wood,
    SurviConfig.TOOLS.axe_wood,
    SurviConfig.TOOLS.shovel_wood,
    SurviConfig.TOOLS.sword_wood,
  ];
  // Antorchas con las que arranca una partida nueva (para la primera cueva).
  static STARTER_TORCHES = 5;
  static HOTBAR_SIZE = 8;
  // ══════════ Día / noche + iluminación ══════════
  // Un día completo dura DAY_CYCLE_MS. timeOfDay va de 0 a 1:
  //   0.00 – 0.50  día pleno
  //   0.50 – 0.60  atardecer (baja la luz)
  //   0.60 – 0.90  noche
  //   0.90 – 1.00  amanecer (sube la luz)
  static DAY_CYCLE_MS = 10 * 60 * 1000;
  static NIGHT_SUN = 0.12; // luz del cielo de noche (0 = negro total)
  static NIGHT_SKY = '#0b1030'; // color del cielo de noche
  static START_TIME_OF_DAY = 0.05; // mundo nuevo: arranca de mañana
  // Luz (0..1). Cada tile que atraviesa le resta *_DECAY; con 1 / DECAY se
  // saca el alcance en tiles. Los sólidos frenan mucho: iluminan su cara
  // pero la luz no los atraviesa (no se ve a través de las paredes).
  static LIGHT_AIR_DECAY = 0.11; // ~9 tiles de alcance
  static LIGHT_SOLID_DECAY = 0.28; // entra 2-3 tiles en la pared
  static TORCH_LIGHT = 1.0; // antorcha: círculo grande (~9 tiles)
  static PLAYER_VISION = 0.6; // visión propia: círculo chico (~5 tiles)
  static DARK_COLOR = [4, 6, 14]; // color de la oscuridad
  // ══════════ Biomas de superficie ══════════
  // fam = familia de la capa de arriba, sub = la de abajo (el subsuelo).
  static BIOMES = {
    bosque: {
      label: 'Bosque',
      fam: 'grass',
      sub: 'dirt',
      base: 40,
      amp: 5,
      sky: '#7ec8e3',
      tree: 'forest',
      treeChance: 0.16,
    },
    pradera: {
      label: 'Pradera',
      fam: 'grass',
      sub: 'dirt',
      base: 41,
      amp: 2,
      sky: '#8fd3ef',
      tree: 'pradera',
      treeChance: 0.07,
    },
    desierto: {
      label: 'Desierto',
      fam: 'sand',
      sub: 'sand',
      base: 43,
      amp: 1.5,
      sky: '#f0d9a8',
      tree: null,
      treeChance: 0,
    },
    nieve: {
      label: 'Nieve',
      fam: 'snow',
      sub: 'dirt',
      base: 35,
      amp: 7,
      sky: '#cfe6f2',
      tree: 'forest',
      treeChance: 0.11,
    },
    jungla: {
      label: 'Jungla',
      fam: 'jgrass',
      sub: 'dirt',
      base: 42,
      amp: 4,
      sky: '#9fdcc0',
      tree: 'jungle',
      treeChance: 0.24,
    },
  };
  static BIOME_NAMES = Object.keys(SurviConfig.BIOMES);
  // Dónde puede aparecer el jugador: cualquier variante de pasto, nieve,
  // selva o arena. Nunca piedra ni roca de cueva.
  static SPAWN_TOP_IDS = new Set();
  static {
    for (const k of ['grass', 'snow', 'jgrass', 'sand']) {
      for (const id of SurviConfig.FAMILIES[k].ids) SurviConfig.SPAWN_TOP_IDS.add(id);
    }
  }

  // ─── Jugador / combate ───
  // ══════════ Animales ══════════
  // Aparecen de día sobre la superficie, lejos de la vista (entre 12 y 30
  // bloques del jugador), con un tope cerca tuyo. Qué animal sale depende del
  // bioma de esa columna: el peso es la chance relativa de cada uno.
  static ANIMAL_SPAWN_MS = 5000; // cada cuánto se intenta hacer aparecer uno
  static ANIMAL_MAX_CERCA = 6; // tope de animales a menos de 40 bloques
  static ANIMAL_SOL_MIN = 0.5; // luz del sol mínima (de noche no aparecen)
  static ANIMALES_POR_BIOMA = {
    pradera: { vaca: 4, cerdo: 3, gallina: 3 },
    bosque: { cerdo: 3, gallina: 2, vaca: 2 },
    jungla: { gallina: 3, cerdo: 2 },
    nieve: { vaca: 1 },
    desierto: {},
  };

  static MAX_HP = 20;
  static FALL_SAFE_TILES = 4;
  static FALL_DMG_PER_TILE = 1;
  static INVULN_MS = 700;
  static ATTACK_COOLDOWN = 380;
  static ATTACK_DMG = 3; // a mano; la espada suma su power
  static PLACE_COOLDOWN = 160;
  static MOVE_SPEED = 2.2;
  static JUMP_VEL = -7.6;
  // Salto automático (opción en Ajustes): al caminar contra un bloque de 1
  // de alto, lo sube solo. Con la gravedad del motor (0.6) sube ~26 px.
  static AUTOSALTO_VEL = -5.6;

  // ══════════ Agua y lava ══════════
  static LAVA_LUZ = 0.9; // la lava ilumina (~9 bloques)
  static LAVA_DANIO = 3; // por toque, cada LAVA_DANIO_MS
  static LAVA_DANIO_MS = 500;
  static QUEMADURA_MS = 4000; // después de salir de la lava seguís quemándote
  static QUEMADURA_DANIO = 1; // cada QUEMADURA_TICK_MS (el agua la apaga)
  static QUEMADURA_TICK_MS = 1000;
  static AIRE_MAX_MS = 10000; // aire bajo el agua (10 burbujas de 1 s)
  static AHOGO_DANIO = 2; // sin aire, cada AHOGO_TICK_MS
  static AHOGO_TICK_MS = 1000;
  // Nadar: en el fluido la gravedad y la velocidad bajan; mantener saltar sube.
  static NADO = {
    agua: { grav: 0.25, caidaMax: 1.8, velX: 0.7, subir: 2.4 },
    lava: { grav: 0.35, caidaMax: 1.2, velX: 0.45, subir: 1.4 },
  };
  static REACH_TILES = 5;
  // La caja de colisión es más chica que el dibujo a propósito: el sprite
  // sobresale, el choque no.
  static PLAYER_BOX = {
    w: 12,
    h: 22,
  };
  // Celda de 36x36 del sprite nuevo, centrada en la caja de colisión y con
  // los pies apoyados en su borde de abajo.
  static PLAYER_SPRITE = {
    w: 36,
    h: 36,
    offX: -12,
    offY: -14,
  };
  static MODES = {
    normal: {
      label: 'Modo normal',
      desc: 'Si morís, reaparecés y conservás el mundo.',
    },
    hardcore: {
      label: 'Hardcore',
      desc: 'Si morís, se borra el mundo. Sin respawn.',
    },
  };
  // ─── Hambre ───
  // Se vacía sola con el tiempo jugado; en 0 empieza a pegar daño cada
  // STARVE_INTERVAL_MS. Arriba de HUNGER_REGEN_THRESHOLD (bien alimentado)
  // regenera vida de a poco, como premio por comer.
  static MAX_HUNGER = 100;
  static HUNGER_DRAIN_PER_MS = SurviConfig.MAX_HUNGER / (10 * 60 * 1000); // se vacía en ~10min jugados
  static HUNGER_REGEN_THRESHOLD = 70;
  static STARVE_DAMAGE = 1;
  static STARVE_INTERVAL_MS = 4000;
  static HP_REGEN_INTERVAL_MS = 5000;
  static HP_REGEN_AMOUNT = 1;
  // ─── Ataque cuerpo a cuerpo por arma ───
  // Antes cualquier ítem en la mano pegaba lo mismo (ATTACK_DMG) salvo la
  // espada, que sumaba su power. Ahora cada arma tiene su propio alcance,
  // cadencia y multiplicador de daño: la espada es la única pensada para
  // pelear (más rápida, más alcance, daño completo + su power); el resto
  // de las herramientas golpea pero peor, y a mano limpia es lo más flojo
  // de todo. `dmgMult` se aplica sobre ATTACK_DMG.
  static WEAPON_STATS = {
    sword: {
      cooldown: 260,
      dmgMult: 1,
    },
    pickaxe: {
      cooldown: SurviConfig.ATTACK_COOLDOWN,
      dmgMult: 0.75,
    },
    axe: {
      cooldown: SurviConfig.ATTACK_COOLDOWN,
      dmgMult: 0.75,
    },
    shovel: {
      cooldown: SurviConfig.ATTACK_COOLDOWN,
      dmgMult: 0.65,
    },
  };
  static BARE_HAND_ATTACK = {
    cooldown: SurviConfig.ATTACK_COOLDOWN + 40,
    dmgMult: 0.5,
  };
  // ─── Alcance del golpe: un ARCO delante del personaje ───
  // Media elipse centrada en el medio del sprite, hacia donde mira: va de
  // arriba de la cabeza hasta abajo de los pies (el recorrido del brazo).
  //   adelante = radio horizontal, desde el centro del personaje
  //   vertical = radio hacia arriba y hacia abajo del centro
  //   atras    = cuánto arranca por detrás del centro (el borde recto)
  // En bloques de 16 px. La espada (cualquiera) tiene el arco grande; todo
  // lo demás (pico, hacha, pala, bloques, ítems, mano vacía) el normal.
  static GOLPE_ARCO = {
    normal: { adelante: 1.75, vertical: 2.25, atras: 0.55 },
    espada: { adelante: 3.1, vertical: 2.6, atras: 0.55 },
  };
  // true: dibuja el arco mientras dura el golpe (para ajustar los números).
  static DEBUG_GOLPE = false;

  // ─── Enemigos (slimes) ───
  // Pocos: se intenta uno cada ENEMIGO_SPAWN_MS; de día solo sale a veces.
  static ENEMIGO_SPAWN_MS = 12000;
  static ENEMIGO_MAX = 2; // tope de slimes a la vez
  static ENEMIGO_CHANCE_DIA = 0.3; // de noche siempre (si no se llegó al tope)
  // ─── Feedback de golpe recibido ───
  // _hitFlashMs es un flash corto y bien visible (además del parpadeo largo
  // de invulnerabilidad, que ya existía). El shake es un temblor de cámara
  // breve — Engine2D.Camera.shake() ya lo soporta, solo faltaba dispararlo.
  static HIT_FLASH_MS = 140;
  static HIT_SHAKE_INTENSITY = 3;
  static HIT_SHAKE_MS = 180;
  // ─── Cámara: deadzone vertical para que saltar no la mueva ───
  // Con JUMP_VEL y la gravedad de Physics (0.6 px/step²) un salto sube
  // ~48px (v²/2g). Con una deadzone vertical de 110px (55px para cada
  // lado del centro) todo salto normal queda adentro y la cámara no se
  // mueve — así no se pierde la puntería al colocar bloques mientras se
  // salta. El ancho horizontal queda chico porque ahí sí conviene seguir
  // de cerca. followSmooth() + smoothing evita el corte brusco cuando sí
  // hace falta moverse (caídas largas, cruzar el mapa).
  static CAMERA_DEADZONE_W = 24;
  static CAMERA_DEADZONE_H = 110;
  static CAMERA_SMOOTHING = 0.85;
  //  Inventario general (el de la pantalla de Inventario, aparte de los
  //  8 huecos de la hotbar que ya se ven abajo en el HUD).
  static GENERAL_INV_SLOTS = 10;
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
  // icon = nombre de ícono de survi_icons.js (no emoji)
  static EQUIP_SLOTS = [
    {
      key: 'head',
      label: 'Casco',
      icon: 'hardHat',
    },
    {
      key: 'chest',
      label: 'Pecho',
      icon: 'shirt',
    },
    {
      key: 'legs',
      label: 'Pantalón',
      icon: 'pants',
    },
    {
      key: 'boots',
      label: 'Botas',
      icon: 'footprints',
    },
    {
      key: 'bag',
      label: 'Mochila',
      icon: 'backpack',
    },
    {
      key: 'special',
      label: 'Especial',
      icon: 'sparkles',
    },
  ];
  static EQUIP_SLOT_ICON = Object.fromEntries(SurviConfig.EQUIP_SLOTS.map((s) => [s.key, s.icon]));
  static EQUIP_SLOT_KEYS = SurviConfig.EQUIP_SLOTS.map((s) => s.key);
  // Ids de equipo: 3000+ (bloques van por id de tile, comida 2000+,
  // herramientas 1000+ — ver arriba). Este es el primer set de armadura
  // (piedra, barata, se junta picando desde el arranque); agregar más
  // tiers más adelante es solo sumar entradas acá con el mismo patrón.
  static EQUIP = {
    // armadura vieja de piedra: queda para no romper partidas guardadas
    helmetStone: 3001,
    chestStone: 3002,
    legsStone: 3003,
    bootsStone: 3004,
    bag: 3010,
    // mochila (mediana) — mismo id que la de antes
    bagSmall: 3011,
    bagLarge: 3012,
  };
  static {
    SurviConfig.ITEM_INFO[SurviConfig.EQUIP.helmetStone] = {
      name: 'Casco de piedra',
      equip: 'head',
      durabilidad: 100,
      defense: 1,
      sprite: 'helmet_iron',
    };
  }

  static {
    SurviConfig.ITEM_INFO[SurviConfig.EQUIP.chestStone] = {
      name: 'Pechera de piedra',
      equip: 'chest',
      durabilidad: 100,
      defense: 2,
      sprite: 'chest_iron',
    };
  }

  static {
    SurviConfig.ITEM_INFO[SurviConfig.EQUIP.legsStone] = {
      name: 'Pantalón de piedra',
      equip: 'legs',
      durabilidad: 100,
      defense: 2,
      sprite: 'legs_iron',
    };
  }

  static {
    SurviConfig.ITEM_INFO[SurviConfig.EQUIP.bootsStone] = {
      name: 'Botas de piedra',
      equip: 'boots',
      durabilidad: 100,
      defense: 1,
      sprite: 'boots_iron',
    };
  }

  static {
    SurviConfig.ITEM_INFO[SurviConfig.EQUIP.bagSmall] = {
      name: 'Bolsa',
      equip: 'bag',
      bonusSlots: 2,
      sprite: 'bag_small',
    };
  }

  static {
    SurviConfig.ITEM_INFO[SurviConfig.EQUIP.bag] = {
      name: 'Mochila',
      equip: 'bag',
      bonusSlots: 4,
      sprite: 'bag_medium',
    };
  }

  static {
    SurviConfig.ITEM_INFO[SurviConfig.EQUIP.bagLarge] = {
      name: 'Mochila grande',
      equip: 'bag',
      bonusSlots: 6,
      sprite: 'bag_large',
    };
  }

  // Armaduras: cuero → esmeralda. Ids 3100 + material*10 + pieza.
  // Defensa de cada pieza = base de la pieza × multiplicador del material.
  static ARMOR_MATS = {
    leather: {
      durabilidad: 80, // golpes que aguanta la pechera (las otras piezas, un poco menos)
      label: 'cuero',
      mult: 1.0,
    },
    copper: {
      durabilidad: 120, // golpes que aguanta la pechera (las otras piezas, un poco menos)
      label: 'cobre',
      mult: 1.4,
    },
    iron: {
      durabilidad: 180, // golpes que aguanta la pechera (las otras piezas, un poco menos)
      label: 'hierro',
      mult: 2.0,
    },
    gold: {
      durabilidad: 240, // golpes que aguanta la pechera (las otras piezas, un poco menos)
      label: 'oro',
      mult: 2.6,
    },
    diamond: {
      durabilidad: 380, // golpes que aguanta la pechera (las otras piezas, un poco menos)
      label: 'diamante',
      mult: 3.3,
    },
    emerald: {
      durabilidad: 520, // golpes que aguanta la pechera (las otras piezas, un poco menos)
      label: 'esmeralda',
      mult: 4.0,
    },
  };
  static ARMOR_PIECES = [
    {
      key: 'helmet',
      durabilidad: 0.7, // x la del material
      slot: 'head',
      label: 'Casco',
      base: 1,
      cost: 5,
    },
    {
      key: 'chest',
      durabilidad: 1, // x la del material
      slot: 'chest',
      label: 'Pechera',
      base: 3,
      cost: 8,
    },
    {
      key: 'legs',
      durabilidad: 0.9, // x la del material
      slot: 'legs',
      label: 'Pantalón',
      base: 2,
      cost: 7,
    },
    {
      key: 'boots',
      durabilidad: 0.8, // x la del material
      slot: 'boots',
      label: 'Botas',
      base: 1,
      cost: 4,
    },
  ];
  static ARMOR = {};
  static {
    Object.keys(SurviConfig.ARMOR_MATS).forEach((mat, mi) => {
      SurviConfig.ARMOR_PIECES.forEach((pc, pi) => {
        const id = 3100 + mi * 10 + pi;
        SurviConfig.ARMOR[`${pc.key}_${mat}`] = id;
        SurviConfig.ITEM_INFO[id] = {
          name: `${pc.label} de ${SurviConfig.ARMOR_MATS[mat].label}`,
          equip: pc.slot,
          defense: Math.round(pc.base * SurviConfig.ARMOR_MATS[mat].mult),
          durabilidad: Math.round(SurviConfig.ARMOR_MATS[mat].durabilidad * pc.durabilidad),
          sprite: `${pc.key}_${mat}`,
        };
      });
    });
  }

  // La defensa ya no se resta entera: reduce un porcentaje del golpe, con
  // tope, para que ninguna armadura te deje inmune (ver survi_game.js _damage).
  static armorReduction(defense) {
    return Math.min(0.75, defense / (defense + 18));
  }

  // Objeto de equipo vacío (los 6 slots en null) — lo usa una partida
  // nueva y también sirve para completar los slots que falten en un save
  // viejo (de antes de que existiera este sistema), igual que
  // `new Array(HOTBAR_SIZE).fill(null)` hace con la hotbar.
  static emptyEquipment() {
    const eq = {};
    for (const s of SurviConfig.EQUIP_SLOTS) eq[s.key] = null;
    return eq;
  }

  // Cuánto suma la defensa de la armadura puesta (head/chest/legs/boots —
  // bag y special no defienden). Se resta del daño de golpes cuerpo a
  // cuerpo en survi_game.js `_damage()`.
  static totalDefense(equipment) {
    if (!equipment) return 0;
    let def = 0;
    for (const slot of ['head', 'chest', 'legs', 'boots']) {
      const id = equipment[slot];
      if (id && SurviConfig.ITEM_INFO[id]) def += SurviConfig.ITEM_INFO[id].defense || 0;
    }
    return def;
  }

  // Cupo del inventario general: la base + el bonus de la mochila puesta
  // (si hay una). Sin mochila, GENERAL_INV_SLOTS a secas.
  static totalGeneralSlots(equipment) {
    const bagId = equipment && equipment.bag;
    const bonus = bagId && SurviConfig.ITEM_INFO[bagId] ? SurviConfig.ITEM_INFO[bagId].bonusSlots || 0 : 0;
    return SurviConfig.GENERAL_INV_SLOTS + bonus;
  }

  // Cupo total: hotbar (8, fijo) + general (10 + mochila).
  static totalInvSlots(equipment) {
    return SurviConfig.HOTBAR_SIZE + SurviConfig.totalGeneralSlots(equipment);
  }

  //  Crafteo
  //
  //  Cada receta: { id, result, resultQty, inputs }. `inputs` es una lista
  //  de ingredientes, cada uno { id, qty } o { anyOf: [ids], qty } —
  //  `label` (opcional) = nombre corto a mostrar ("Madera" en vez de listar los 3 troncos).
  //  anyOf sirve para "cualquiera de estos" (la madera, por ejemplo: no
  //  tiene sentido pedir el tronco de un árbol puntual si el jugador
  //  junta indistintamente de los 3 biomas con árbol).
  static WOOD_IDS = [SurviConfig.T.WOOD, SurviConfig.TID.pradera_TRUNK, SurviConfig.TID.jungle_TRUNK];
  static RECIPES = [];
  static {
    // `cat` = pestaña de la pantalla de crafteo.
    // `station` = dónde se hace: 'hand' (desde el inventario) o 'table'
    // (mesa de crafteo). En la mesa también se ven las de mano.
    const add = (cat, id, result, resultQty, inputs, station = 'table') =>
      SurviConfig.RECIPES.push({
        cat,
        id,
        result,
        resultQty,
        inputs,
        station,
      });
    const COAL = {
      anyOf: [SurviConfig.MAT.coal, SurviConfig.T.COAL],
      qty: 1,
      label: 'Carbón',
    }; // carbón (o el bloque viejo de carbón)
    const STICKS = (qty) => ({
      id: SurviConfig.MAT.sticks,
      qty,
    });
    // ── Básicos (a mano, desde el inventario) ──
    const WOOD = (qty) => ({
      anyOf: SurviConfig.WOOD_IDS,
      qty,
      label: 'Madera',
    });
    add('basicos', 'sticks', SurviConfig.MAT.sticks, 4, [WOOD(1)], 'hand');
    add('basicos', 'torch', SurviConfig.T.TORCH, 4, [STICKS(1), COAL], 'hand');
    add(
      'basicos',
      'flint',
      SurviConfig.MAT.flint,
      1,
      [
        {
          id: SurviConfig.T.GRAVEL,
          qty: 6,
        },
      ],
      'hand',
    );
    add(
      'basicos',
      'arrow',
      SurviConfig.MAT.arrow,
      3,
      [
        {
          anyOf: [SurviConfig.MAT.flint, SurviConfig.MAT.ironIngot],
          qty: 2,
          label: 'Flint o lingote de hierro',
        },
        STICKS(2),
      ],
      'hand',
    );
    add('basicos', 'craft_table', SurviConfig.T.CRAFT_TABLE, 1, [WOOD(4)], 'hand');
    // ── Estaciones (en la mesa) ──
    add('estaciones', 'furnace', SurviConfig.T.FURNACE, 1, [
      {
        id: SurviConfig.T.STONE,
        qty: 8,
      },
    ]);
    add('estaciones', 'chest', SurviConfig.T.CHEST, 1, [WOOD(8)]);
    // ── Herramientas: material de cada tier ──
    const toolMat = {
      wood: {
        anyOf: SurviConfig.WOOD_IDS,
        label: 'Madera',
      },
      stone: {
        id: SurviConfig.T.STONE,
      },
      copper: {
        id: SurviConfig.MAT.copperIngot,
      },
      iron: {
        id: SurviConfig.MAT.ironIngot,
      },
      gold: {
        id: SurviConfig.MAT.goldIngot,
      },
      diamond: {
        id: SurviConfig.MAT.diamond,
      },
      emerald: {
        id: SurviConfig.MAT.emerald,
      },
    };
    // [cantidad de material, cantidad de palos]
    const toolCost = {
      pickaxe: [3, 2],
      axe: [3, 2],
      shovel: [1, 2],
      sword: [2, 1],
    };
    for (const mat of SurviConfig.MATERIAL_ORDER) {
      for (const tool of SurviConfig.TOOL_KINDS) {
        const [qm, qs] = toolCost[tool];
        add(tool === 'sword' ? 'armas' : 'herramientas', `${tool}_${mat}`, SurviConfig.TOOLS[`${tool}_${mat}`], 1, [
          {
            ...toolMat[mat],
            qty: qm,
          },
          STICKS(qs),
        ]);
      }
    }
    // ── Armadura ──
    const armorMat = {
      leather: SurviConfig.MAT.leather,
      copper: SurviConfig.MAT.copperIngot,
      iron: SurviConfig.MAT.ironIngot,
      gold: SurviConfig.MAT.goldIngot,
      diamond: SurviConfig.MAT.diamond,
      emerald: SurviConfig.MAT.emerald,
    };
    for (const mat of Object.keys(SurviConfig.ARMOR_MATS)) {
      for (const pc of SurviConfig.ARMOR_PIECES) {
        add('armadura', `${pc.key}_${mat}`, SurviConfig.ARMOR[`${pc.key}_${mat}`], 1, [
          {
            id: armorMat[mat],
            qty: pc.cost,
          },
        ]);
      }
    }
    // ── Mochilas ── (cuando haya animales, el cuero se puede sumar acá)
    add('mochilas', 'bag_small', SurviConfig.EQUIP.bagSmall, 1, [
      {
        id: SurviConfig.MAT.leaves,
        qty: 8,
      },
      STICKS(2),
    ]);
    add('mochilas', 'bag', SurviConfig.EQUIP.bag, 1, [
      {
        id: SurviConfig.MAT.leaves,
        qty: 12,
      },
      {
        id: SurviConfig.MAT.copperIngot,
        qty: 3,
      },
    ]);
    add('mochilas', 'bag_large', SurviConfig.EQUIP.bagLarge, 1, [
      {
        id: SurviConfig.MAT.leaves,
        qty: 20,
      },
      {
        id: SurviConfig.MAT.ironIngot,
        qty: 4,
      },
      {
        id: SurviConfig.MAT.goldIngot,
        qty: 1,
      },
    ]);
  }

  // ══════════ Horno ══════════
  // Qué se transforma en qué (se completa abajo con los minerales).
  static SMELT = {
    [SurviConfig.FOOD.meatRaw]: SurviConfig.FOOD.meatCooked,
    [SurviConfig.FOOD.egg]: SurviConfig.FOOD.eggCooked,
    [SurviConfig.FOOD.potato]: SurviConfig.FOOD.potatoBaked,
    [SurviConfig.FOOD.fishRaw]: SurviConfig.FOOD.fishCooked,
    [SurviConfig.FOOD.fish2Raw]: SurviConfig.FOOD.fishCooked,
    [SurviConfig.FOOD.squidRaw]: SurviConfig.FOOD.squidCooked,
    [SurviConfig.FOOD.eelRaw]: SurviConfig.FOOD.eelCooked,
  };
  static {
    SurviConfig.SMELT[SurviConfig.MAT.copperRaw] = SurviConfig.MAT.copperIngot;
  }

  static {
    SurviConfig.SMELT[SurviConfig.MAT.ironRaw] = SurviConfig.MAT.ironIngot;
  }

  static {
    SurviConfig.SMELT[SurviConfig.MAT.goldRaw] = SurviConfig.MAT.goldIngot;
  }

  static SMELT_MS = 4000; // tiempo por ítem
  // Combustible: cuántos ítems cocina cada unidad.
  static FUEL = {
    [SurviConfig.MAT.coal]: 8,
    [SurviConfig.T.COAL]: 8,
    [SurviConfig.MAT.sticks]: 0.5,
  };
  static {
    for (const id of SurviConfig.WOOD_IDS) SurviConfig.FUEL[id] = 1.5;
  }

  // ══════════ Cubos (agua y lava) ══════════
  // Clic derecho con el cubo vacío sobre agua/lava la junta (hacen falta 8
  // unidades, una celda llena); con el cubo lleno, la vuelca.
  static CUBO = { vacio: 4201, agua: 4202, lava: 4203 };
  static {
    SurviConfig.ITEM_INFO[SurviConfig.CUBO.vacio] = { name: 'Cubo', sprite: 'bucket', cubo: 0 };
    SurviConfig.ITEM_INFO[SurviConfig.CUBO.agua] = { name: 'Cubo con agua', sprite: 'bucket_water', cubo: 1 };
    SurviConfig.ITEM_INFO[SurviConfig.CUBO.lava] = { name: 'Cubo con lava', sprite: 'bucket_lava', cubo: 2 };
    SurviConfig.RECIPES.push({
      cat: 'herramientas',
      id: 'cubo',
      result: SurviConfig.CUBO.vacio,
      resultQty: 1,
      inputs: [{ id: SurviConfig.MAT.ironIngot, qty: 3 }],
      station: 'table',
    });
  }

  // ══════════ Arcos y flechas ══════════
  // Con un arco en la mano, clic izquierdo dispara hacia el mouse (mantener
  // apretado = dispara seguido, según la cadencia). Cada tiro gasta 1 flecha
  // y 1 uso del arco. Mejor arco = más daño, dispara más rápido, la flecha
  // vuela más lejos y aguanta más usos.
  static ARCOS = { comun: 4301, bueno: 4302, superior: 4303 };
  static FLECHA = {
    rectaMs: 250, // al principio vuela recta (de cerca se apunta directo)…
    gravedad: 0.16, // …y después cae en arco (de lejos hay que apuntar más arriba)
    vueloMaxMs: 4000, // si no pega en nada, desaparece
    clavadaMs: 20000, // clavada en un bloque: se puede juntar (pasando por encima)
  };
  static {
    const arco = (key, name, sprite, stats, durabilidad) => {
      SurviConfig.ITEM_INFO[SurviConfig.ARCOS[key]] = { name, sprite, arco: stats, durabilidad };
    };
    //                                   daño  cadencia(ms) velocidad
    arco('comun', 'Arco común', 'bow_common', { danio: 3, cadenciaMs: 900, velocidad: 6.5 }, 80);
    arco('bueno', 'Arco bueno', 'bow_good', { danio: 5, cadenciaMs: 650, velocidad: 8 }, 220);
    arco('superior', 'Arco superior', 'bow_superior', { danio: 8, cadenciaMs: 420, velocidad: 9.5 }, 480);
    const M = SurviConfig.MAT;
    const receta = (cat, id, result, qty, inputs, station) => SurviConfig.RECIPES.push({ cat, id, result, resultQty: qty, inputs, station });
    // El hilo no salía de ningún lado: se hace con hojas (fibra vegetal).
    receta('basicos', 'string', M.string, 1, [{ id: M.leaves, qty: 2 }], 'hand');
    receta('armas', 'bow_common', SurviConfig.ARCOS.comun, 1, [{ id: M.sticks, qty: 3 }, { id: M.string, qty: 3 }], 'table');
    receta('armas', 'bow_good', SurviConfig.ARCOS.bueno, 1, [{ id: M.ironIngot, qty: 2 }, { id: M.sticks, qty: 3 }, { id: M.string, qty: 3 }], 'table');
    receta('armas', 'bow_superior', SurviConfig.ARCOS.superior, 1, [{ id: M.diamond, qty: 2 }, { id: M.goldIngot, qty: 2 }, { id: M.string, qty: 4 }], 'table');
  }

  static CRAFT_CATS = [
    {
      key: 'basicos',
      label: 'Básicos',
    },
    {
      key: 'estaciones',
      label: 'Estaciones',
    },
    {
      key: 'herramientas',
      label: 'Herramientas',
    },
    {
      key: 'armas',
      label: 'Armas',
    },
    {
      key: 'armadura',
      label: 'Armadura',
    },
    {
      key: 'mochilas',
      label: 'Mochilas',
    },
  ];
  static ingredientHave(inventory, ingredient) {
    if (ingredient.anyOf) return ingredient.anyOf.reduce((s, id) => s + (inventory[id] || 0), 0);
    return inventory[ingredient.id] || 0;
  }

  static hasIngredient(inventory, ingredient) {
    return SurviConfig.ingredientHave(inventory, ingredient) >= ingredient.qty;
  }

  // ¿Alcanzan los materiales para esta receta?
  static canCraft(inventory, recipe) {
    return recipe.inputs.every((ing) => SurviConfig.hasIngredient(inventory, ing));
  }

  // Descuenta los materiales de `inventory` (lo muta). Asume que ya se
  // llamó canCraft() antes — no vuelve a validar. Con anyOf, gasta de la
  // primera alternativa que tenga stock antes de pasar a la siguiente.
  static consumeRecipe(inventory, recipe) {
    for (const ing of recipe.inputs) {
      let left = ing.qty;
      const ids = ing.anyOf || [ing.id];
      for (const id of ids) {
        if (left <= 0) break;
        const have = inventory[id] || 0;
        const take = Math.min(have, left);
        if (take <= 0) continue;
        const remain = have - take;
        if (remain > 0) inventory[id] = remain;
        else delete inventory[id];
        left -= take;
      }
    }
  }

  // ¿El resultado va a entrar en el inventario una vez descontados los
  // materiales? Simula el consumo sobre una COPIA (no toca `inventory`):
  // si el resultado es un ítem que ya tenías, siempre entra (no ocupa un
  // slot nuevo, solo suma al stack); si es nuevo, depende de si consumir
  // los materiales liberó algún slot y de cuánto cupo total hay.
  static craftWouldFit(inventory, recipe, totalSlots) {
    const sim = {
      ...inventory,
    };
    SurviConfig.consumeRecipe(sim, recipe);
    if (recipe.result in sim) return true;
    return Object.keys(sim).length < totalSlots;
  }
}
