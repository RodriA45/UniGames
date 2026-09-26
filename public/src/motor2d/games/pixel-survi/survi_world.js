// ══════════════════════════════════════════════════════════════
//   Pixel Survi — survi_world.js
//   Clase GeneradorMundo: generación del mundo (biomas + cuevas +
//   árboles), autotile y elección del punto de aparición.
//     new GeneradorMundo(seed).generar()      → { seed, data, ... }
//     GeneradorMundo.elegirSpawn(mundo)       → { x, y }
//     GeneradorMundo.autotileId(get, c, r)    → id de tile (lo usa el juego)
//     GeneradorMundo.mulberry32(seed)         → PRNG (lo usa el tileset) Todo determinístico por seed:
//   mismo seed = mismo mundo, así el guardado no necesita guardar
//   biomas ni alturas.
//
//   Tierra/pasto/arena/grava se dibujan por código al cargar el juego
//   (ver survi_proc_tiles.js) — el resto (piedra, piedra oscura,
//   minerales, árboles) sigue siendo textura real dentro de
//   assets/tiles.png.
// ══════════════════════════════════════════════════════════════

import { SurviConfig } from './survi_config.js';
import { BiomasCueva } from './survi_cuevas.js';
import { CapaFluidos } from './survi_fluidos.js';

export class GeneradorMundo {
  constructor(seed) {
    this.seed = seed;
  }

  // PRNG determinístico (mulberry32)
  static mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
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
  static autotileId(get, col, row, rnd = null) {
    const id = get(col, row);
    const key = SurviConfig.FAMILY_OF.get(id);
    if (!key) return id;
    const fam = SurviConfig.FAMILIES[key];
    const c = fam.connect;
    let mask = 0;
    if (c.has(get(col, row - 1))) mask |= 8;
    if (c.has(get(col, row + 1))) mask |= 4;
    if (c.has(get(col - 1, row))) mask |= 2;
    if (c.has(get(col + 1, row))) mask |= 1;
    let piece = SurviConfig.MASK_PIECE[fam.kind][mask];
    // Las copas grandes usan las dos variantes de hoja para no quedar como
    // un bloque plano del mismo tile repetido.
    if (rnd && fam.kind === 'leaf' && SurviConfig.LEAF_ALT[piece] && rnd() < 0.45) piece = SurviConfig.LEAF_ALT[piece];
    return fam.pieces[piece] || id;
  }

  // ─── Mapa de biomas: regiones de ancho variable sorteadas con el seed,
  // sin repetir dos iguales pegadas. ───
  static buildBiomeMap(rnd, seed = 0) {
    const map = new Array(SurviConfig.COLS);
    let col = 0,
      prev = null;
    while (col < SurviConfig.COLS) {
      let name;
      do {
        name = SurviConfig.BIOME_NAMES[Math.floor(rnd() * SurviConfig.BIOME_NAMES.length)];
      } while (name === prev);
      prev = name;
      const width = Math.round(28 + rnd() * 34);
      // Bosque oscuro: algunos bosques se vuelven oscuros. Se decide con un
      // hash de la semilla y la columna (NO con rnd), así el resto del mundo
      // sale igual que antes y los mundos guardados no cambian de bioma.
      const oscuro = name === 'bosque' && GeneradorMundo.hash2(col, 777, seed) < SurviConfig.BOSQUE_OSCURO_CHANCE;
      for (let k = 0; k < width && col < SurviConfig.COLS; k++, col++) map[col] = oscuro ? 'oscuro' : name;
    }
    return map;
  }

  // ─── Un árbol ───
  // Con las 27 piezas de la paleta sale un árbol distinto cada vez: tronco
  // de 4 a 8 tiles con nudos y base con raíces, 1 a 3 ramas (algunas con
  // follaje propio, otras con una mata en la punta) y una copa elíptica de
  // ancho y alto variables, con huecos. Romper cualquier tronco o rama
  // devuelve el TRONCO de esa paleta (ver DROPS en survi_config.js).
  static plantTree(set, get, col, surfaceRow, pal, rnd) {
    const P = (p) => SurviConfig.TID[`${pal}_${p}`];
    const h = 4 + Math.floor(rnd() * 5); // 4..8 tiles de tronco
    const topRow = surfaceRow - h;
    if (topRow < 6) return;
    // tronco
    set(col, surfaceRow - 1, P('TRUNK_BASE'));
    for (let k = 2; k <= h - 1; k++) set(col, surfaceRow - k, rnd() < 0.2 ? P('TRUNK_K') : P('TRUNK'));

    // ── Ramas ──
    // Reglas para que no se vean mal:
    //  • van en filas del tronco con al menos 1 fila de aire entre la rama
    //    y la copa (antes se metían adentro de las hojas);
    //  • como mucho una por lado, y en filas separadas (nunca dos pegadas);
    //  • la salida del tronco es la del lado correcto (TRUNK_L / TRUNK_R) y
    //    el muñón y la rama con matita tienen su versión izquierda y derecha
    //    (antes las izquierdas usaban piezas de la derecha y quedaban cortadas).
    const filaMin = topRow + 2, filaMax = surfaceRow - 3;
    const nidos = []; // celdas donde puede ir un nido (arriba de una rama)
    if (filaMax >= filaMin) {
      const cantidad = rnd() < 0.2 ? 0 : rnd() < 0.55 ? 1 : 2;
      const lados = rnd() < 0.5 ? [-1, 1] : [1, -1];
      const usadas = [];
      for (let b = 0; b < cantidad; b++) {
        const dc = lados[b];
        let r = -1;
        for (let t = 0; t < 6 && r < 0; t++) {
          const f = filaMin + Math.floor(rnd() * (filaMax - filaMin + 1));
          if (usadas.every((u) => Math.abs(u - f) >= 2)) r = f;
        }
        if (r < 0 || get(col + dc, r) !== 0) continue;
        const tipo = rnd();
        if (tipo < 0.4) {
          set(col + dc, r, dc < 0 ? P('LARM_L') : P('LARM_R')); // rama con follaje
        } else if (tipo < 0.72 && get(col + 2 * dc, r) === 0) {
          set(col + dc, r, P('BRANCH_H')); // rama larga
          set(col + 2 * dc, r, rnd() < 0.35 ? P('LBLOB') : dc > 0 ? P('BRANCH_S') : P('BRANCH_SL'));
          nidos.push([col + dc, r]); // el tramo del medio puede llevar nido
        } else {
          set(col + dc, r, dc > 0 ? P('STUB_R') : P('STUB_L')); // muñón
        }
        set(col, r, dc > 0 ? P('TRUNK_R') : P('TRUNK_L'));
        usadas.push(r);
      }
    }
    // algunos árboles tienen un nido sobre la rama larga (suelta huevos)
    if (nidos.length && rnd() < SurviConfig.NIDO_CHANCE) {
      const [nc, nr] = nidos[Math.floor(rnd() * nidos.length)];
      set(nc, nr, P('NEST'));
    }

    // copa: el tile por donde entra el tronco + un blob elíptico de hojas.
    // Se pintan todas con LC y la pasada de autotile les pone los bordes.
    set(col, topRow, P('LCAN'));
    const rx = 2 + Math.floor(rnd() * 2); // 2..3 de radio horizontal
    const ry = 2 + Math.floor(rnd() * 2); // 2..3 de radio vertical
    const cy = topRow - ry + 1;
    for (let dc = -rx; dc <= rx; dc++) {
      for (let dr = -ry; dr <= ry; dr++) {
        const nx = dc / (rx + 0.5),
          ny = dr / (ry + 0.5);
        if (nx * nx + ny * ny > 1) continue;
        if (rnd() < 0.05) continue; // huecos: nada de óvalos perfectos
        const c = col + dc,
          r = cy + dr;
        if (r > topRow || r < 1 || c < 1 || c >= SurviConfig.COLS - 1) continue;
        if (get(c, r) !== 0) continue;
        set(c, r, P('LC'));
      }
    }
  }

  // ─── Ruido 2D con semilla (value noise + fBm) para las cuevas ───
  // Reemplaza al viejo sin()*sin(), que por ser periódico repetía el mismo
  // dibujo de túneles cada pocas filas al ir bajando.
  static hash2(ix, iy, seed) {
    let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 144664597)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  static valueNoise(x, y, seed) {
    const ix = Math.floor(x),
      iy = Math.floor(y);
    const fx = x - ix,
      fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx),
      sy = fy * fy * (3 - 2 * fy);
    const a = GeneradorMundo.hash2(ix, iy, seed),
      b = GeneradorMundo.hash2(ix + 1, iy, seed);
    const c = GeneradorMundo.hash2(ix, iy + 1, seed),
      d = GeneradorMundo.hash2(ix + 1, iy + 1, seed);
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
  }

  // 3 octavas → 0..1, con detalle grande (cavernas) y chico (bordes irregulares).
  static fbm(x, y, seed) {
    let sum = 0,
      amp = 0.5,
      freq = 1,
      norm = 0;
    for (let o = 0; o < 3; o++) {
      sum += GeneradorMundo.valueNoise(x * freq, y * freq, seed + o * 1013) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm;
  }

  // ¿Se talla aire en (col,row)? Mezcla dos capas:
  //  - cavernas: manchas grandes de fBm (más frecuentes cuanto más hondo)
  //  - túneles: ruido "ridged" (1-|2n-1|) → vetas largas y finas que conectan
  static isCaveAir(col, row, seedA, seedB) {
    const depth = row / SurviConfig.ROWS;
    const cavern = GeneradorMundo.fbm(col / 16, row / 11, seedA);
    if (cavern > 0.71 - depth * 0.05) return true;
    const ridge = 1 - Math.abs(2 * GeneradorMundo.fbm(col / 26, row / 20, seedB) - 1);
    return ridge > 0.955;
  }

  // Gusanos: túneles serpenteantes que se tallan DESPUÉS, cruzando las
  // cavernas. Rompen cualquier patrón que pudiera quedar y conectan zonas.
  static carveWorms(data, surfaceByCol, rnd) {
    // 10-15 gusanos cada 200x200 bloques: se escala con el área del mundo
    // para que un mapa más grande no quede con los túneles ralos.
    const escala = (SurviConfig.COLS * SurviConfig.ROWS) / (200 * 200);
    const count = Math.round((10 + Math.floor(rnd() * 6)) * escala);
    for (let w = 0; w < count; w++) {
      let x = 5 + rnd() * (SurviConfig.COLS - 10);
      const minRow = surfaceByCol[Math.floor(x)] + 14;
      let y = minRow + rnd() * (SurviConfig.ROWS - 4 - minRow);
      let ang = rnd() * Math.PI * 2;
      const steps = 40 + Math.floor(rnd() * 90);
      for (let i = 0; i < steps; i++) {
        const r = rnd() < 0.3 ? 2 : 1;
        for (let dy = -r; dy <= r; dy++)
          for (let dx = -r; dx <= r; dx++) {
            if (dx * dx + dy * dy > r * r + 1) continue;
            const c = Math.round(x) + dx,
              rr = Math.round(y) + dy;
            if (c < 1 || c >= SurviConfig.COLS - 1 || rr >= SurviConfig.ROWS - 3) continue;
            if (rr < surfaceByCol[c] + 12) continue; // nunca rompe la superficie
            data[rr * SurviConfig.COLS + c] = 0;
          }
        ang += (rnd() - 0.5) * 0.7;
        // tendencia leve a ir en horizontal (más jugables que los pozos verticales)
        x += Math.cos(ang) * 1.2;
        y += Math.sin(ang) * 0.7;
        if (x < 2 || x > SurviConfig.COLS - 3 || y > SurviConfig.ROWS - 5) break;
      }
    }
  }

  // Vetas: cada bloque de mineral que dejó la pasada 1 "crece" unos pasos
  // al azar, pisando solo piedra (normal, oscura o roca de cueva). Así
  // aparecen grupitos en vez de bloques sueltos aislados.
  static VEIN_ORES = new Set([
    SurviConfig.TID.coal,
    SurviConfig.TID.copper_ore,
    SurviConfig.TID.iron,
    SurviConfig.TID.gold,
    SurviConfig.TID.diamond_ore,
    SurviConfig.TID.emerald_ore,
  ]);
  static growOreVeins(data, rnd) {
    const host = new Set([
      SurviConfig.TID.stone,
      SurviConfig.TID[SurviConfig.STONE_VARIANT_KEYS[0]],
      SurviConfig.TID[SurviConfig.STONE_VARIANT_KEYS[1]],
      SurviConfig.TID[SurviConfig.STONE_VARIANT_KEYS[2]],
      SurviConfig.TID[SurviConfig.STONE_VARIANT_KEYS[3]],
      ...SurviConfig.DARK_STONE_VARIANT_KEYS.map((k) => SurviConfig.TID[k]),
      SurviConfig.FAMILIES.cave.pieces.C,
    ]);
    const seeds = [];
    for (let i = 0; i < data.length; i++) if (GeneradorMundo.VEIN_ORES.has(data[i])) seeds.push(i);
    for (const i0 of seeds) {
      const ore = data[i0];
      // las gemas quedan en grupos más chicos (son las más raras)
      const steps =
        ore === SurviConfig.TID.diamond_ore || ore === SurviConfig.TID.emerald_ore
          ? 1 + Math.floor(rnd() * 2)
          : 1 + Math.floor(rnd() * 4);
      let c = i0 % SurviConfig.COLS,
        r = Math.floor(i0 / SurviConfig.COLS);
      for (let k = 0; k < steps; k++) {
        const d = Math.floor(rnd() * 4);
        c += d === 0 ? 1 : d === 1 ? -1 : 0;
        r += d === 2 ? 1 : d === 3 ? -1 : 0;
        if (c < 1 || c >= SurviConfig.COLS - 1 || r < 1 || r >= SurviConfig.ROWS - 3) break;
        const j = r * SurviConfig.COLS + c;
        if (host.has(data[j])) data[j] = ore;
      }
    }
  }

  // Elige una variante de piedra al azar (sin autotile, puro ruido visual):
  // la oscura a partir de DEEP_STONE_ROW (los últimos 100 bloques del
  // mapa), la normal arriba de esa fila.
  static pickStoneVariant(rnd, row) {
    const keys =
      row >= SurviConfig.DEEP_STONE_ROW ? SurviConfig.DARK_STONE_VARIANT_KEYS : SurviConfig.STONE_VARIANT_KEYS;
    return SurviConfig.TID[keys[Math.floor(rnd() * keys.length)]];
  }

  // Genera el mundo completo. Determinístico: mismo seed → mismo mundo.
  generar() {
    const seed = this.seed;
    const rnd = GeneradorMundo.mulberry32(seed);
    const data = new Uint16Array(SurviConfig.COLS * SurviConfig.ROWS);
    const surfaceByCol = new Int16Array(SurviConfig.COLS);
    const biomeByCol = GeneradorMundo.buildBiomeMap(rnd, seed);
    const phaseX = rnd() * 1000;
    const caveSeedA = Math.floor(rnd() * 1e9);
    const caveSeedB = Math.floor(rnd() * 1e9);
    const idx = (col, row) => row * SurviConfig.COLS + col;
    // get/set con los bordes pegados: afuera del mapa devuelve el tile del
    // borde, así el autotile no dibuja pasto en las paredes laterales.
    const clampC = (c) => (c < 0 ? 0 : c >= SurviConfig.COLS ? SurviConfig.COLS - 1 : c);
    const clampR = (r) => (r < 0 ? 0 : r >= SurviConfig.ROWS ? SurviConfig.ROWS - 1 : r);
    const get = (c, r) => (r < 0 ? 0 : data[idx(clampC(c), clampR(r))]);
    const set = (c, r, id) => {
      if (c >= 0 && c < SurviConfig.COLS && r >= 0 && r < SurviConfig.ROWS) data[idx(c, r)] = id;
    };
    // Altura cruda por columna y después promediada: suaviza el borde entre
    // biomas para que no queden acantilados de golpe.
    const raw = new Float32Array(SurviConfig.COLS);
    for (let col = 0; col < SurviConfig.COLS; col++) {
      const b = SurviConfig.BIOMES[biomeByCol[col]];
      const noise = Math.sin((col + phaseX) * 0.15) * 0.6 + Math.sin((col + phaseX) * 0.045 + 2) * 0.4;
      raw[col] = b.base + noise * b.amp;
    }
    const SMOOTH = 5;
    for (let col = 0; col < SurviConfig.COLS; col++) {
      let sum = 0,
        n = 0;
      for (let k = -SMOOTH; k <= SMOOTH; k++) {
        sum += raw[Math.min(SurviConfig.COLS - 1, Math.max(0, col + k))];
        n++;
      }
      surfaceByCol[col] = Math.round(sum / n);
    }
    // ─── Pasada 1: terreno ───
    // Se pintan los rellenos (la pieza "C" de cada familia); los bordes los
    // pone la pasada de autotile del final.
    for (let col = 0; col < SurviConfig.COLS; col++) {
      const name = biomeByCol[col];
      const b = SurviConfig.BIOMES[name];
      const topId = SurviConfig.FAMILIES[b.fam].pieces.C;
      const subId = b.sub === 'dirt' ? SurviConfig.TID.dirt : SurviConfig.FAMILIES[b.sub].pieces.C;
      const caveId = SurviConfig.FAMILIES.cave.pieces.C;
      const surfaceRow = surfaceByCol[col];
      const soilEnd = surfaceRow + 3; // capa de arriba
      const stoneStart = surfaceRow + (name === 'desierto' ? 10 : 7);
      const caveStart = stoneStart + 25;
      for (let row = 0; row < SurviConfig.ROWS; row++) {
        let id = 0;
        if (row < surfaceRow)
          id = 0; // cielo
        else if (row >= SurviConfig.ROWS - 3)
          id = SurviConfig.TID.bedrock; // piso del mundo
        else if (row < soilEnd) id = topId;
        else if (row < stoneStart) id = subId;
        else if (row < caveStart) {
          const r = rnd();
          if (name === 'nieve' && row < stoneStart + 6 && r < 0.18) id = SurviConfig.TID.ice;
          else if (r < 0.018) id = SurviConfig.TID.coal;
          else if (r < 0.042)
            id = SurviConfig.TID.copper_ore; // el cobre aparece cerca de la superficie
          else if (r < 0.085)
            id = SurviConfig.TID.gravel; // bolsones de grava
          else id = GeneradorMundo.pickStoneVariant(rnd, row);
        } else {
          // zona de cuevas: ruido 2D simple para tallar túneles + vetas
          if (GeneradorMundo.isCaveAir(col, row, caveSeedA, caveSeedB)) id = 0;
          else {
            const r = rnd();
            // Cuanto más hondo, mejores minerales (cada uno se agranda en
            // una veta de 2-5 bloques más abajo, en growOreVeins).
            if (r < 0.02) id = SurviConfig.TID.coal;
            else if (r < 0.044 && row < SurviConfig.DEEP_STONE_ROW) id = SurviConfig.TID.copper_ore;
            else if (r < 0.056) id = SurviConfig.TID.iron;
            else if (r < 0.064 && row > SurviConfig.ROWS * 0.6) id = SurviConfig.TID.gold;
            else if (r < 0.067 && row >= SurviConfig.DEEP_STONE_ROW) id = SurviConfig.TID.diamond_ore;
            else if (r < 0.0685 && row >= SurviConfig.ROWS - 40) id = SurviConfig.TID.emerald_ore;
            else if (r < 0.11) id = SurviConfig.TID.gravel;
            // Últimos 100 bloques: piedra oscura al azar, sin el autotile de
            // bordes de túnel de acá arriba (pickStoneVariant ya elige del
            // set oscuro solo por el row, ver DEEP_STONE_ROW).
            else if (row >= SurviConfig.DEEP_STONE_ROW) id = GeneradorMundo.pickStoneVariant(rnd, row);
            else id = caveId;
          }
        }
        data[idx(col, row)] = id;
      }
    }
    // ─── Pasada 2a: vetas (cada mineral suelto crece a 2-5 bloques) ───
    GeneradorMundo.growOreVeins(data, rnd);
    // ─── Pasada 2b: gusanos (túneles serpenteantes) ───
    GeneradorMundo.carveWorms(data, surfaceByCol, rnd);
    // ─── Pasada 2b': cavernas grandes + regiones de cueva (musgo, hielo, goteo) ───
    const fbm = (x, y, s) => GeneradorMundo.fbm(x, y, s);
    const grande = BiomasCueva.tallarCavernas(data, surfaceByCol, rnd, fbm, caveSeedA ^ 0x5bd1);
    const regionCueva = BiomasCueva.mapaRegiones(surfaceByCol, biomeByCol, fbm, caveSeedB ^ 0x3c6e);
    // ─── Pasada 2c: agua y lava (lagos en la superficie, pozos en cuevas) ───
    const fluidos = CapaFluidos.generar(data, surfaceByCol, biomeByCol, rnd, SurviConfig.FAMILIES.sand.pieces.C);
    // ─── Pasada 2c': minas abandonadas con cofres (en las cuevas) ───
    const cofres = GeneradorMundo.generarMinas(data, surfaceByCol, fluidos, rnd);
    // ─── Pasada 2c'': paredes y decoración de cada región de cueva ───
    BiomasCueva.decorar(data, fluidos, surfaceByCol, regionCueva, grande, rnd);
    // ─── Pasada 2d: vegetación ───
    // Va DESPUÉS de los lagos: antes se plantaban primero y el lago se cavaba
    // debajo, así que quedaban árboles flotando arriba del agua. Ahora un
    // lago ya bajó el suelo (y tiene arena, que no es la tapa del bioma), así
    // que ahí no sale nada; igual se chequea que no haya agua encima.
    // Los árboles piden 3 columnas de separación para que no salga una pared
    // de troncos pegados.
    let lastTree = -10;
    for (let col = 4; col < SurviConfig.COLS - 4; col++) {
      const name = biomeByCol[col];
      const b = SurviConfig.BIOMES[name];
      const surfaceRow = surfaceByCol[col];
      const seco = !fluidos.tipo(col, surfaceRow - 1) && !fluidos.tipo(col - 1, surfaceRow - 1) && !fluidos.tipo(col + 1, surfaceRow - 1);
      const onTop = seco && SurviConfig.FAMILIES[b.fam].ids.has(data[idx(col, surfaceRow)]);
      if (b.tree && onTop && col - lastTree >= 3 && rnd() < b.treeChance) {
        GeneradorMundo.plantTree(set, get, col, surfaceRow, b.tree, rnd);
        lastTree = col;
      } else if (name === 'desierto' && onTop && rnd() < 0.05) {
        const h = 1 + Math.floor(rnd() * 3);
        for (let k = 1; k <= h; k++) set(col, surfaceRow - k, SurviConfig.TID.cactus);
      }
    }
    // ─── Pasada 2e: pasto alto, flores y arbustos secos ───
    // Decoración no sólida arriba del suelo: se pasa por delante, se rompe al
    // toque y no suelta nada. Solo en celdas de aire sin agua.
    for (let col = 2; col < SurviConfig.COLS - 2; col++) {
      const deco = GeneradorMundo.DECO_POR_BIOMA[biomeByCol[col]];
      if (!deco) continue;
      const s = surfaceByCol[col];
      const top = data[idx(col, s)];
      if (!SurviConfig.FAMILIES[SurviConfig.BIOMES[biomeByCol[col]].fam].ids.has(top)) continue;
      if (data[idx(col, s - 1)] !== 0 || fluidos.tipo(col, s - 1)) continue;
      const r = rnd();
      let acum = 0;
      for (const [k, p] of deco) {
        acum += p;
        if (r < acum) {
          data[idx(col, s - 1)] = SurviConfig.TID[k];
          break;
        }
      }
    }
    // ─── Pasada 3: autotile ───
    // Recién acá el pasto queda arriba, la tierra expuesta a los costados y
    // las copas de los árboles redondeadas.
    const out = new Uint16Array(data);
    for (let row = 0; row < SurviConfig.ROWS; row++) {
      for (let col = 0; col < SurviConfig.COLS; col++) {
        if (data[idx(col, row)] === 0) continue;
        out[idx(col, row)] = GeneradorMundo.autotileId(get, col, row, rnd);
      }
    }
    data.set(out);
    return {
      seed,
      data,
      surfaceByCol,
      biomeByCol,
      fluidos,
      cofres, // contenido de los cofres de las minas: { "col,row": { id: cantidad } }
      regionCueva, // región de cada celda bajo tierra (SurviConfig.REGION_CUEVA)
    };
  }

  // ══════════════════════════════════════════════════════════════
  //  Minas abandonadas
  //
  //  Cada mina es un pasillo principal (3 de alto) con 1 o 2 ramales que
  //  suben o bajan por una escalera. El piso es de tablones donde falta
  //  suelo (puentes sobre los huecos), cada 4 columnas hay un marco (poste +
  //  tablones de techo), hay rieles en el piso, alguna telaraña en el techo
  //  y cofres con botín (SurviConfig.BOTIN_MINA). Todo oscuro: ahí aparecen
  //  zombies y esqueletos.
  // ══════════════════════════════════════════════════════════════
  static generarMinas(data, surfaceByCol, fluidos, rnd) {
    const COLS = SurviConfig.COLS, ROWS = SurviConfig.ROWS, TID = SurviConfig.TID;
    const idx = (c, r) => r * COLS + c;
    const cofres = {};
    const cantidad = Math.round(4 * ((COLS * ROWS) / (500 * 250))) + Math.floor(rnd() * 3); // 4 a 6
    const dentro = (c, r) => c >= 2 && c < COLS - 2 && r >= 4 && r < ROWS - 5; // nunca toca la roca madre

    // Un tramo de pasillo: `cols` = [{ c, piso }] (piso = fila del aire donde se para).
    const tallar = (cols) => {
      for (const { c, piso } of cols) {
        for (let r = piso - 2; r <= piso; r++) {
          data[idx(c, r)] = 0;
          fluidos.set(c, r, 0, 0);
        }
        if (!SurviConfig.SOLID_IDS.has(data[idx(c, piso + 1)])) {
          data[idx(c, piso + 1)] = TID.planks; // puente
          fluidos.set(c, piso + 1, 0, 0);
        }
      }
    };
    const decorar = (cols) => {
      cols.forEach(({ c, piso }, i) => {
        if (i % 4 === 0) {
          // marco: poste + tablones de techo (3 de ancho)
          data[idx(c, piso)] = TID.beam;
          data[idx(c, piso - 1)] = TID.beam;
          for (const dc of [-1, 0, 1]) if (dentro(c + dc, piso - 2)) data[idx(c + dc, piso - 2)] = TID.planks;
        } else {
          if (rnd() < 0.7 && data[idx(c, piso)] === 0) data[idx(c, piso)] = TID.rail;
          if (rnd() < 0.07 && data[idx(c, piso - 2)] === 0) data[idx(c, piso - 2)] = TID.cobweb;
        }
      });
    };
    const ponerCofre = (cols, chance) => {
      if (rnd() >= chance) return;
      const libres = cols.filter(({ c, piso }, i) => i % 4 !== 0 && i > 1 && SurviConfig.SOLID_IDS.has(data[idx(c, piso + 1)]));
      if (!libres.length) return;
      const { c, piso } = libres[Math.floor(rnd() * libres.length)];
      data[idx(c, piso)] = TID.chest;
      cofres[`${c},${piso}`] = GeneradorMundo.botinMina(rnd);
    };
    // pasillo recto de `largo` columnas hacia `dir`
    const pasillo = (x, piso, dir, largo) => {
      const cols = [];
      for (let i = 0; i < largo; i++) {
        const c = x + dir * i;
        if (!dentro(c, piso - 2) || !dentro(c, piso + 1) || piso - 2 <= surfaceByCol[c] + 20) break;
        cols.push({ c, piso });
      }
      return cols;
    };
    // escalera: sube/baja 1 fila por columna hasta cambiar `dy` filas
    const escalera = (x, piso, dir, dy) => {
      const cols = [];
      const paso = Math.sign(dy);
      for (let i = 0; i < Math.abs(dy); i++) {
        const c = x + dir * i, p = piso + paso * (i + 1);
        if (!dentro(c, p - 2) || !dentro(c, p + 1) || p - 2 <= surfaceByCol[c] + 20) break;
        cols.push({ c, piso: p });
      }
      return cols;
    };

    for (let m = 0; m < cantidad; m++) {
      for (let intento = 0; intento < 30; intento++) {
        const x = 30 + Math.floor(rnd() * (COLS - 60));
        const desde = surfaceByCol[x] + 45, hasta = ROWS - 14;
        if (desde >= hasta) continue;
        const piso = desde + Math.floor(rnd() * (hasta - desde));
        const dir = rnd() < 0.5 ? -1 : 1;
        const principal = pasillo(x, piso, dir, 24 + Math.floor(rnd() * 26));
        if (principal.length < 16) continue;
        const tramos = [principal];
        // 1 o 2 ramales desde un punto del pasillo principal
        const ramales = 1 + Math.floor(rnd() * 2);
        for (let k = 0; k < ramales; k++) {
          const base = principal[4 + Math.floor(rnd() * (principal.length - 8))];
          const rdir = rnd() < 0.5 ? -1 : 1;
          const dy = (rnd() < 0.5 ? -1 : 1) * (4 + Math.floor(rnd() * 4));
          const esc = escalera(base.c + rdir, base.piso, rdir, dy);
          if (esc.length < Math.abs(dy)) continue;
          const fin = esc[esc.length - 1];
          const ram = pasillo(fin.c + rdir, fin.piso, rdir, 10 + Math.floor(rnd() * 16));
          tramos.push(esc, ram);
        }
        for (const t of tramos) tallar(t);
        for (const t of tramos) decorar(t);
        ponerCofre(principal, 0.75);
        for (let k = 2; k < tramos.length; k += 2) ponerCofre(tramos[k], 0.4);
        break;
      }
    }
    return cofres;
  }

  // Contenido al azar de un cofre de mina: { id: cantidad }.
  static botinMina(rnd) {
    for (let tirada = 0; tirada < 3; tirada++) {
      const cofre = {};
      for (const [id, p, min, max] of SurviConfig.BOTIN_MINA) {
        if (rnd() < p) cofre[id] = (cofre[id] || 0) + min + Math.floor(rnd() * (max - min + 1));
      }
      if (Object.keys(cofre).length >= SurviConfig.BOTIN_MINA_MIN_ITEMS) return cofre;
    }
    return { [SurviConfig.MAT.coal]: 4, [SurviConfig.TID.torch]: 3, [SurviConfig.MAT.ironIngot]: 2 };
  }

  // Qué decoración sale arriba del suelo de cada bioma: [tile, probabilidad por columna].
  static DECO_POR_BIOMA = {
    bosque: [['tallgrass', 0.35], ['tallgrass2', 0.15], ['flower_red', 0.05], ['flower_yellow', 0.05], ['flower_blue', 0.03]],
    // la sandía es un bloque sólido (no decoración): solo sale al crear el mundo
    pradera: [['melon', 0.025], ['tallgrass', 0.32], ['tallgrass2', 0.12], ['flower_red', 0.08], ['flower_yellow', 0.09], ['flower_blue', 0.06]],
    jungla: [['tallgrass2', 0.3], ['tallgrass', 0.2], ['flower_red', 0.04], ['flower_blue', 0.03]],
    desierto: [['deadbush', 0.04]],
    nieve: [['snowgrass', 0.25], ['snowpile', 0.14]],
    oscuro: [['tallgrass2', 0.3], ['tallgrass', 0.2], ['flower_blue', 0.03]],
  };

  // ─── Punto de aparición ALEATORIO pero válido ───
  // Válido = columna cuyo tile de superficie es pisable (cualquier variante
  // de pasto/nieve/selva/arena, nunca piedra ni roca de cueva), con 3 tiles
  // de aire encima (no dentro de un árbol) y aire a algún costado. Nunca en
  // el cielo ni bajo tierra: la posición sale DESDE la fila de superficie de
  // esa columna.
  static elegirSpawn(world, randomFn = Math.random) {
    const { data, surfaceByCol } = world;
    const idx = (col, row) => row * SurviConfig.COLS + col;
    // strict = solo pasto / selva / nieve (nada de desierto)
    const isValid = (col, strict) => {
      const s = surfaceByCol[col];
      if (s < 4 || s > SurviConfig.ROWS - 20) return false;
      const top = data[idx(col, s)];
      if (!SurviConfig.SPAWN_TOP_IDS.has(top)) return false;
      if (strict && SurviConfig.FAMILIES.sand.ids.has(top)) return false;
      for (let k = 1; k <= 3; k++) if (!SurviConfig.esAire(data[idx(col, s - k)])) return false; // el pasto no molesta
      if (world.fluidos) for (let k = 0; k <= 3; k++) if (world.fluidos.tipo(col, s - k)) return false; // ni en un lago
      const aire = (c, r) => SurviConfig.esAire(data[idx(c, r)]);
      const leftFree = aire(col - 1, s - 1) && aire(col - 1, s - 2);
      const rightFree = aire(col + 1, s - 1) && aire(col + 1, s - 2);
      return leftFree || rightFree;
    };
    for (const strict of [true, false]) {
      for (let i = 0; i < 300; i++) {
        // Zona central (20%..80% del ancho): hay mundo para explorar hacia
        // los dos lados y nunca aparecés pegado al borde del mapa.
        const margen = Math.floor(SurviConfig.COLS * 0.2);
        const col = margen + Math.floor(randomFn() * (SurviConfig.COLS - 2 * margen));
        if (isValid(col, strict)) return GeneradorMundo.spawnAt(col, surfaceByCol[col]);
      }
    }
    for (let col = 3; col < SurviConfig.COLS - 3; col++) {
      if (isValid(col, false)) return GeneradorMundo.spawnAt(col, surfaceByCol[col]);
    }
    return GeneradorMundo.spawnAt(3, surfaceByCol[3]);
  }

  // 24 = alto del jugador (22) + 2px de aire: aparece apoyado, sin cobrar
  // daño de caída al empezar.
  static spawnAt(col, surfaceRow) {
    return {
      col,
      row: surfaceRow,
      x: col * SurviConfig.TILE + 2,
      y: surfaceRow * SurviConfig.TILE - 24,
    };
  }
}
