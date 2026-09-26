// ══════════════════════════════════════════════════════════════
//   Pixel Survi — survi_cuevas.js
//
//   Clase BiomasCueva: lo que hace distintas a las cuevas (solo al crear
//   el mundo; lo llama GeneradorMundo.generar()).
//
//   • Cavernas grandes → salones enormes con bordes irregulares y alguna
//                        columna de piedra en el medio (tallarCavernas).
//   • Regiones         → cada celda bajo tierra tiene una región según un
//                        ruido grande (mapaRegiones):
//        musgo       → paredes de musgo, pastito, enredaderas colgando y
//                      hongos que brillan. Más comunes debajo de la selva.
//        hielo       → debajo del bioma de nieve: paredes de hielo y hielo
//                      azul, nieve en el piso, carámbanos y charcos congelados.
//        goteo       → roca de goteo, estalactitas y estalagmitas.
//        normal      → la cueva de siempre (con alguna estalactita suelta;
//                      más en las cavernas grandes).
//   • decorar()       → pinta las paredes y pone la decoración.
//
//   El juego usa `region` para el color de fondo y el nombre en la pausa.
// ══════════════════════════════════════════════════════════════
import { SurviConfig } from './survi_config.js';

export class BiomasCueva {
  static R = SurviConfig.REGION_CUEVA;

  // Chances de cada cosa, por región: pared = convertir la roca expuesta,
  // piso / techo = decorar esa celda de aire.
  static DECO = {
    musgo: { pared: 0.8, pasto: 0.5, hongo: 0.06, enredadera: 0.28 },
    hielo: { pared: 0.75, nieve: 0.3, caramba: 0.3 },
    goteo: { pared: 0.45, estalagmita: 0.22, estalactita: 0.3 },
    normal: { estalagmita: 0.03, estalactita: 0.05, hongo: 0.008 },
    grande: { estalagmita: 0.12, estalactita: 0.2 }, // extra en las cavernas grandes
  };

  // ─── Regiones ───
  // Uint8Array COLS*ROWS con la región de cada celda (0 = normal).
  static mapaRegiones(surfaceByCol, biomeByCol, fbm, seed) {
    const { COLS, ROWS } = SurviConfig, R = BiomasCueva.R;
    const region = new Uint8Array(COLS * ROWS);
    for (let c = 0; c < COLS; c++) {
      const b = biomeByCol[c];
      const desde = surfaceByCol[c] + 12;
      for (let r = desde; r < ROWS; r++) {
        const n = fbm(c / 55, r / 34, seed);
        let reg = R.normal;
        if (b === 'nieve' && r < SurviConfig.DEEP_STONE_ROW) reg = n > 0.66 ? R.goteo : R.hielo;
        else if (n < 0.36 || (b === 'jungla' && n < 0.5)) reg = R.musgo;
        else if (n > 0.63) reg = R.goteo;
        region[r * COLS + c] = reg;
      }
    }
    return region;
  }

  // ─── Cavernas grandes ───
  // Elipses grandes con el borde "comido" por ruido. Devuelve un
  // Uint8Array que marca qué celdas quedaron dentro de una caverna grande.
  static tallarCavernas(data, surfaceByCol, rnd, fbm, seed) {
    const { COLS, ROWS } = SurviConfig;
    const grande = new Uint8Array(COLS * ROWS);
    const cantidad = Math.round(5 * ((COLS * ROWS) / (500 * 250))) + Math.floor(rnd() * 3);
    for (let k = 0; k < cantidad; k++) {
      const rx = 16 + Math.floor(rnd() * 18), ry = 8 + Math.floor(rnd() * 9);
      const cx = rx + 4 + Math.floor(rnd() * (COLS - 2 * rx - 8));
      const minR = surfaceByCol[cx] + 30 + ry;
      if (minR >= ROWS - 12 - ry) continue;
      const cy = minR + Math.floor(rnd() * (ROWS - 12 - ry - minR));
      for (let r = cy - ry - 3; r <= cy + ry + 3; r++) {
        for (let c = cx - rx - 3; c <= cx + rx + 3; c++) {
          if (c < 2 || c >= COLS - 2 || r >= ROWS - 5 || r < surfaceByCol[c] + 14) continue;
          const dx = (c - cx) / rx, dy = (r - cy) / ry;
          // borde irregular: el radio varía con el ruido; el piso, más plano
          const borde = 0.78 + 0.45 * fbm(c / 7, r / 5, seed + k * 97);
          const d = dx * dx + (dy > 0 ? dy * dy * 1.25 : dy * dy);
          if (d < borde * borde) {
            data[r * COLS + c] = 0;
            grande[r * COLS + c] = 1;
          }
        }
      }
      // 0 a 2 columnas de piedra (del piso al techo)
      const columnas = Math.floor(rnd() * 3);
      for (let j = 0; j < columnas; j++) {
        const px = cx + Math.round((rnd() - 0.5) * rx * 1.1), ancho = 2 + Math.floor(rnd() * 2);
        for (let r = cy - ry - 3; r <= cy + ry + 3; r++) {
          for (let c = px; c < px + ancho + (Math.abs(r - cy) > ry * 0.6 ? 1 : 0); c++) {
            if (!grande[r * COLS + c]) continue;
            data[r * COLS + c] = SurviConfig.FAMILIES.cave.pieces.C;
            grande[r * COLS + c] = 0;
          }
        }
      }
    }
    return grande;
  }

  // ─── Decoración ───
  static #esHuesped(id) {
    const T = SurviConfig.TID;
    return (
      id === SurviConfig.FAMILIES.cave.pieces.C ||
      id === T.stone ||
      id === T.gravel ||
      SurviConfig.STONE_VARIANT_KEYS.some((k) => T[k] === id) ||
      SurviConfig.DARK_STONE_VARIANT_KEYS.some((k) => T[k] === id)
    );
  }

  static decorar(data, fluidos, surfaceByCol, region, grande, rnd) {
    const { COLS, ROWS } = SurviConfig, T = SurviConfig.TID, R = BiomasCueva.R, D = BiomasCueva.DECO;
    const idx = (c, r) => r * COLS + c;
    const libre = (c, r) => c > 0 && c < COLS - 1 && r > 0 && r < ROWS - 3 && data[idx(c, r)] === 0 && !fluidos.tipo(c, r);
    const huesped = new Map(); // cache de "es roca pintable"
    const esHuesped = (id) => {
      if (!huesped.has(id)) huesped.set(id, BiomasCueva.#esHuesped(id));
      return huesped.get(id);
    };
    const nombre = ['normal', 'musgo', 'hielo', 'goteo'];
    // 1) paredes: la roca que toca aire se vuelve musgo / hielo / roca de goteo
    const cambios = [];
    for (let r = 1; r < ROWS - 3; r++) {
      for (let c = 1; c < COLS - 1; c++) {
        if (r < surfaceByCol[c] + 13) continue;
        const i = idx(c, r), reg = region[i];
        if (reg === R.normal || !esHuesped(data[i])) continue;
        const expuesta = data[i - 1] === 0 || data[i + 1] === 0 || data[i - COLS] === 0 || data[i + COLS] === 0;
        if (!expuesta || rnd() >= D[nombre[reg]].pared) continue;
        if (reg === R.musgo) cambios.push(i, T.moss);
        else if (reg === R.hielo) cambios.push(i, rnd() < 0.35 ? T.hielo_azul : T.ice);
        else cambios.push(i, T.dripstone);
      }
    }
    for (let k = 0; k < cambios.length; k += 2) data[cambios[k]] = cambios[k + 1];
    // 2) charcos congelados en las cuevas de hielo: la capa de arriba del agua
    for (let r = 1; r < ROWS - 3; r++) {
      for (let c = 1; c < COLS - 1; c++) {
        if (region[idx(c, r)] !== R.hielo || fluidos.tipo(c, r) !== 1 || fluidos.tipo(c, r - 1) || data[idx(c, r - 1)] !== 0) continue;
        if (r < surfaceByCol[c] + 13) continue;
        fluidos.set(c, r, 0, 0);
        data[idx(c, r)] = T.ice;
      }
    }
    // 3) piso y techo
    const solido = (c, r) => SurviConfig.SOLID_IDS.has(data[idx(c, r)]);
    for (let r = 2; r < ROWS - 4; r++) {
      for (let c = 1; c < COLS - 1; c++) {
        if (r < surfaceByCol[c] + 13 || !libre(c, r)) continue;
        const i = idx(c, r), reg = region[i], g = grande[i];
        const piso = solido(c, r + 1), techo = solido(c, r - 1);
        if (piso) {
          const x = rnd();
          if (reg === R.musgo) {
            if (x < D.musgo.hongo) data[i] = T.glow_mushroom;
            else if (x < D.musgo.hongo + D.musgo.pasto) data[i] = rnd() < 0.5 ? T.cave_grass : T.cave_grass2;
          } else if (reg === R.hielo) {
            if (x < D.hielo.nieve) data[i] = T.snowpile;
          } else {
            const p = reg === R.goteo ? D.goteo.estalagmita : g ? D.grande.estalagmita : D.normal.estalagmita;
            if (x < p) BiomasCueva.#estalagmita(data, c, r, libre, rnd);
            else if (reg === R.normal && r > SurviConfig.ROWS * 0.5 && x < p + D.normal.hongo) data[i] = T.glow_mushroom;
          }
        } else if (techo) {
          const x = rnd();
          if (reg === R.musgo && x < D.musgo.enredadera) BiomasCueva.#colgar(data, c, r, T.vine, T.vine_end, 1 + Math.floor(rnd() * 4), libre);
          else if (reg === R.hielo && x < D.hielo.caramba) data[i] = T.icicle;
          else if (reg === R.goteo || reg === R.normal) {
            const p = reg === R.goteo ? D.goteo.estalactita : g ? D.grande.estalactita : D.normal.estalactita;
            if (x < p) BiomasCueva.#colgar(data, c, r, T.stalactite_base, T.stalactite_tip, rnd() < 0.55 ? 2 : 1, libre);
          }
        }
      }
    }
  }

  // Algo que cuelga desde (c, r) hacia abajo: `largo` celdas, la última es la punta.
  static #colgar(data, c, r, cuerpo, punta, largo, libre) {
    let n = 0;
    while (n < largo && libre(c, r + n) && libre(c, r + n + 1)) n++; // deja una celda libre abajo
    if (n === 0) return;
    for (let k = 0; k < n; k++) data[(r + k) * SurviConfig.COLS + c] = k === n - 1 ? punta : cuerpo;
  }

  // Estalagmita de 1 o 2 de alto.
  static #estalagmita(data, c, r, libre, rnd) {
    const T = SurviConfig.TID, COLS = SurviConfig.COLS;
    if (rnd() < 0.5 && libre(c, r - 1) && libre(c, r - 2)) {
      data[r * COLS + c] = T.stalagmite_base;
      data[(r - 1) * COLS + c] = T.stalagmite_tip;
    } else if (libre(c, r - 1)) data[r * COLS + c] = T.stalagmite_tip;
  }
}
