// ══════════════════════════════════════════════════════════════
//   Pixel Survi — survi_world.js
//   Generación del mundo (biomas + cuevas + árboles), autotile y
//   elección del punto de aparición. Todo determinístico por seed:
//   mismo seed = mismo mundo, así el guardado no necesita guardar
//   biomas ni alturas.
//
//   Los gráficos no se dibujan a mano: el tileset es assets/tiles.png,
//   armado desde las texturas de assert/world con build_assets.py.
// ══════════════════════════════════════════════════════════════

import {
  COLS, ROWS, TILE, TID, FAMILIES, FAMILY_OF, MASK_PIECE, LEAF_ALT,
  BIOMES, BIOME_NAMES, SPAWN_TOP_IDS
} from './survi_config.js';

// PRNG determinístico (mulberry32)
export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ══════════════════════════════════════════════════════════════
//  Autotile
//
//  Devuelve el id que le corresponde a (col,row) según sus 4 vecinos, o
//  el mismo id si el tile no pertenece a ninguna familia (piedra, vetas,
//  cactus, troncos…). Lo usan los dos lados: el generador en una pasada
//  final, y el juego cada vez que se rompe o se coloca un bloque.
//
//  `get(col,row)` lo provee quien llama — así sirve igual para el
//  Uint16Array del generador que para el TileMap del motor.
// ══════════════════════════════════════════════════════════════
export function autotileId(get, col, row, rnd = null) {
  const id = get(col, row);
  const key = FAMILY_OF.get(id);
  if (!key) return id;
  const fam = FAMILIES[key];
  const c = fam.connect;

  let mask = 0;
  if (c.has(get(col, row - 1))) mask |= 8;
  if (c.has(get(col, row + 1))) mask |= 4;
  if (c.has(get(col - 1, row))) mask |= 2;
  if (c.has(get(col + 1, row))) mask |= 1;

  let piece = MASK_PIECE[fam.kind][mask];
  // Las copas grandes usan las dos variantes de hoja para no quedar como
  // un bloque plano del mismo tile repetido.
  if (rnd && fam.kind === 'leaf' && LEAF_ALT[piece] && rnd() < 0.45) piece = LEAF_ALT[piece];
  return fam.pieces[piece] || id;
}

// ─── Mapa de biomas: regiones de ancho variable sorteadas con el seed,
// sin repetir dos iguales pegadas. ───
function buildBiomeMap(rnd) {
  const map = new Array(COLS);
  let col = 0, prev = null;
  while (col < COLS) {
    let name;
    do { name = BIOME_NAMES[Math.floor(rnd() * BIOME_NAMES.length)]; } while (name === prev);
    prev = name;
    const width = Math.round(28 + rnd() * 34);
    for (let k = 0; k < width && col < COLS; k++, col++) map[col] = name;
  }
  return map;
}

// ─── Un árbol ───
// Con las 27 piezas de la paleta sale un árbol distinto cada vez: tronco
// de 4 a 8 tiles con nudos y base con raíces, 1 a 3 ramas (algunas con
// follaje propio, otras con una mata en la punta) y una copa elíptica de
// ancho y alto variables, con huecos. Romper cualquier tronco o rama
// devuelve el TRONCO de esa paleta (ver DROPS en survi_config.js).
function plantTree(set, get, col, surfaceRow, pal, rnd) {
  const P = (p) => TID[`${pal}_${p}`];
  const h = 4 + Math.floor(rnd() * 5);       // 4..8 tiles de tronco
  const topRow = surfaceRow - h;
  if (topRow < 6) return;

  // tronco
  set(col, surfaceRow - 1, P('TRUNK_BASE'));
  for (let k = 2; k <= h - 1; k++) {
    const r = rnd();
    set(col, surfaceRow - k, r < 0.20 ? P('TRUNK_K') : P('TRUNK'));
  }

  // ramas (nunca en los dos primeros tiles, para que se vea el tronco)
  const branches = 1 + Math.floor(rnd() * 3);
  for (let b = 0; b < branches; b++) {
    const r = surfaceRow - (3 + Math.floor(rnd() * Math.max(1, h - 3)));
    const dc = rnd() < 0.5 ? -1 : 1;
    if (get(col + dc, r) !== 0) continue;
    const kind = rnd();
    if (kind < 0.45) {
      set(col + dc, r, dc < 0 ? P('LARM_L') : P('LARM_R'));   // rama con follaje
    } else if (kind < 0.75) {
      set(col + dc, r, P('BRANCH_H'));
      if (get(col + 2 * dc, r) === 0) {
        set(col + 2 * dc, r, rnd() < 0.5 ? P('LBLOB') : P('BRANCH_S'));
      }
    } else {
      set(col + dc, r, P('STUB'));                            // muñón corto
    }
    // el tronco muestra la salida: a la derecha tiene pieza propia, para
    // los dos lados se usa la de ramas dobles.
    set(col, r, dc > 0 && rnd() < 0.6 ? P('TRUNK_R') : P('TRUNK_BR'));
  }

  // copa: el tile por donde entra el tronco + un blob elíptico de hojas.
  // Se pintan todas con LC y la pasada de autotile les pone los bordes.
  set(col, topRow, P('LCAN'));
  const rx = 2 + Math.floor(rnd() * 2);      // 2..3 de radio horizontal
  const ry = 2 + Math.floor(rnd() * 2);      // 2..3 de radio vertical
  const cy = topRow - ry + 1;
  for (let dc = -rx; dc <= rx; dc++) {
    for (let dr = -ry; dr <= ry; dr++) {
      const nx = dc / (rx + 0.5), ny = dr / (ry + 0.5);
      if (nx * nx + ny * ny > 1) continue;
      if (rnd() < 0.05) continue;            // huecos: nada de óvalos perfectos
      const c = col + dc, r = cy + dr;
      if (r > topRow || r < 1 || c < 1 || c >= COLS - 1) continue;
      if (get(c, r) !== 0) continue;
      set(c, r, P('LC'));
    }
  }
}

export function generateWorld(seed) {
  const rnd = mulberry32(seed);
  const data = new Uint16Array(COLS * ROWS);
  const surfaceByCol = new Int16Array(COLS);
  const biomeByCol = buildBiomeMap(rnd);
  const phaseX = rnd() * 1000;
  const caveSeedA = rnd() * 1000;
  const caveSeedB = rnd() * 1000;

  const idx = (col, row) => row * COLS + col;
  // get/set con los bordes pegados: afuera del mapa devuelve el tile del
  // borde, así el autotile no dibuja pasto en las paredes laterales.
  const clampC = (c) => c < 0 ? 0 : (c >= COLS ? COLS - 1 : c);
  const clampR = (r) => r < 0 ? 0 : (r >= ROWS ? ROWS - 1 : r);
  const get = (c, r) => (r < 0 ? 0 : data[idx(clampC(c), clampR(r))]);
  const set = (c, r, id) => { if (c >= 0 && c < COLS && r >= 0 && r < ROWS) data[idx(c, r)] = id; };

  // Altura cruda por columna y después promediada: suaviza el borde entre
  // biomas para que no queden acantilados de golpe.
  const raw = new Float32Array(COLS);
  for (let col = 0; col < COLS; col++) {
    const b = BIOMES[biomeByCol[col]];
    const noise = Math.sin((col + phaseX) * 0.15) * 0.6 + Math.sin((col + phaseX) * 0.045 + 2) * 0.4;
    raw[col] = b.base + noise * b.amp;
  }
  const SMOOTH = 5;
  for (let col = 0; col < COLS; col++) {
    let sum = 0, n = 0;
    for (let k = -SMOOTH; k <= SMOOTH; k++) {
      sum += raw[Math.min(COLS - 1, Math.max(0, col + k))]; n++;
    }
    surfaceByCol[col] = Math.round(sum / n);
  }

  // ─── Pasada 1: terreno ───
  // Se pintan los rellenos (la pieza "C" de cada familia); los bordes los
  // pone la pasada de autotile del final.
  for (let col = 0; col < COLS; col++) {
    const name = biomeByCol[col];
    const b = BIOMES[name];
    const topId = FAMILIES[b.fam].pieces.C;
    const subId = b.sub === 'dirt' ? TID.dirt : FAMILIES[b.sub].pieces.C;
    const caveId = FAMILIES.cave.pieces.C;
    const surfaceRow = surfaceByCol[col];
    const soilEnd = surfaceRow + 3;                                  // capa de arriba
    const stoneStart = surfaceRow + (name === 'desierto' ? 10 : 7);
    const caveStart = stoneStart + 25;

    for (let row = 0; row < ROWS; row++) {
      let id = 0;
      if (row < surfaceRow) id = 0;                       // cielo
      else if (row >= ROWS - 3) id = TID.bedrock;         // piso del mundo
      else if (row < soilEnd) id = topId;
      else if (row < stoneStart) id = subId;
      else if (row < caveStart) {
        const r = rnd();
        if (name === 'nieve' && row < stoneStart + 6 && r < 0.18) id = TID.ice;
        else if (r < 0.02) id = TID.coal;
        else id = TID.stone;
      } else {
        // zona de cuevas: ruido 2D simple para tallar túneles + vetas
        const n = Math.sin((col + caveSeedA) * 0.35 + row * 0.5) *
                  Math.sin((row + caveSeedB) * 0.28 - col * 0.2);
        if (n > 0.3) id = 0;
        else {
          const r = rnd();
          if (r < 0.025) id = TID.coal;
          else if (r < 0.045) id = TID.iron;
          else if (r < 0.055 && row > ROWS * 0.6) id = TID.gold;
          else id = caveId;
        }
      }
      data[idx(col, row)] = id;
    }
  }

  // ─── Pasada 2: vegetación ───
  // Los árboles piden 3 columnas de separación para que no salga una pared
  // de troncos pegados.
  let lastTree = -10;
  for (let col = 4; col < COLS - 4; col++) {
    const name = biomeByCol[col];
    const b = BIOMES[name];
    const surfaceRow = surfaceByCol[col];
    const onTop = FAMILIES[b.fam].ids.has(data[idx(col, surfaceRow)]);

    if (b.tree && onTop && col - lastTree >= 3 && rnd() < b.treeChance) {
      plantTree(set, get, col, surfaceRow, b.tree, rnd);
      lastTree = col;
    } else if (name === 'desierto' && onTop && rnd() < 0.05) {
      const h = 1 + Math.floor(rnd() * 3);
      for (let k = 1; k <= h; k++) set(col, surfaceRow - k, TID.cactus);
    }
  }

  // ─── Pasada 3: autotile ───
  // Recién acá el pasto queda arriba, la tierra expuesta a los costados y
  // las copas de los árboles redondeadas.
  const out = new Uint16Array(data);
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (data[idx(col, row)] === 0) continue;
      out[idx(col, row)] = autotileId(get, col, row, rnd);
    }
  }
  data.set(out);

  return { seed, data, surfaceByCol, biomeByCol };
}

// ─── Punto de aparición ALEATORIO pero válido ───
// Válido = columna cuyo tile de superficie es pisable (cualquier variante
// de pasto/nieve/selva/arena, nunca piedra ni roca de cueva), con 3 tiles
// de aire encima (no dentro de un árbol) y aire a algún costado. Nunca en
// el cielo ni bajo tierra: la posición sale DESDE la fila de superficie de
// esa columna.
export function pickSpawn(world, randomFn = Math.random) {
  const { data, surfaceByCol } = world;
  const idx = (col, row) => row * COLS + col;

  // strict = solo pasto / selva / nieve (nada de desierto)
  const isValid = (col, strict) => {
    const s = surfaceByCol[col];
    if (s < 4 || s > ROWS - 20) return false;
    const top = data[idx(col, s)];
    if (!SPAWN_TOP_IDS.has(top)) return false;
    if (strict && FAMILIES.sand.ids.has(top)) return false;
    for (let k = 1; k <= 3; k++) if (data[idx(col, s - k)] !== 0) return false;
    const leftFree = data[idx(col - 1, s - 1)] === 0 && data[idx(col - 1, s - 2)] === 0;
    const rightFree = data[idx(col + 1, s - 1)] === 0 && data[idx(col + 1, s - 2)] === 0;
    return leftFree || rightFree;
  };

  for (const strict of [true, false]) {
    for (let i = 0; i < 300; i++) {
      const col = 3 + Math.floor(randomFn() * (COLS - 6));
      if (isValid(col, strict)) return spawnAt(col, surfaceByCol[col]);
    }
  }
  for (let col = 3; col < COLS - 3; col++) {
    if (isValid(col, false)) return spawnAt(col, surfaceByCol[col]);
  }
  return spawnAt(3, surfaceByCol[3]);
}

// 24 = alto del jugador (22) + 2px de aire: aparece apoyado, sin cobrar
// daño de caída al empezar.
function spawnAt(col, surfaceRow) {
  return { col, row: surfaceRow, x: col * TILE + 2, y: surfaceRow * TILE - 24 };
}
