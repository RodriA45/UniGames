// ══════════════════════════════════════════════════════════════
//   Pixel Survi — survi_fluidos.js
//
//   Clase CapaFluidos: el agua y la lava del mundo, en una capa aparte de
//   los bloques (un fluido solo ocupa celdas de AIRE del tilemap).
//
//   Cada celda guarda en un byte el tipo (agua / lava) y el nivel (0..8):
//     byte = tipo << 4 | nivel      (8 = celda llena)
//
//   Simulación de volumen finito (como Terraria): el fluido primero CAE a
//   la celda de abajo y después se NIVELA hacia los costados. Solo se
//   procesan las celdas ACTIVAS (las que cambiaron o tienen un vecino que
//   cambió): un lago quieto no cuesta nada aunque el mundo sea enorme.
//   La lava fluye más lento y queda más espesa. Donde se tocan agua y
//   lava, la lava se vuelve piedra.
// ══════════════════════════════════════════════════════════════

import { SurviConfig } from './survi_config.js';

export class CapaFluidos {
  static AGUA = 1;
  static LAVA = 2;
  static LLENO = 8;

  // Por tipo: cada cuánto se mueve (ms) y cuánta diferencia de nivel hace
  // falta para que se derrame de costado (la lava es espesa: queda en pozos).
  static REGLAS = {
    1: { tickMs: 90, difLateral: 1 },
    2: { tickMs: 360, difLateral: 2 },
  };
  static MAX_CELDAS_POR_TICK = 6000; // tope por tick (inundaciones grandes se reparten)

  #activas = new Set();
  #acumMs = { 1: 0, 2: 0 };

  constructor(celdas = null) {
    const n = SurviConfig.COLS * SurviConfig.ROWS;
    this.celdas = celdas && celdas.length === n ? Uint8Array.from(celdas) : new Uint8Array(n);
    // al cargar, se revisa todo una vez por si algo quedó sin asentar
    for (let i = 0; i < n; i++) if (this.celdas[i]) this.#activas.add(i);
  }

  // ── Lectura ──
  static #idx(c, r) {
    return r * SurviConfig.COLS + c;
  }

  static #dentro(c, r) {
    return c >= 0 && r >= 0 && c < SurviConfig.COLS && r < SurviConfig.ROWS;
  }

  tipo(c, r) {
    return CapaFluidos.#dentro(c, r) ? this.celdas[CapaFluidos.#idx(c, r)] >> 4 : 0;
  }

  nivel(c, r) {
    return CapaFluidos.#dentro(c, r) ? this.celdas[CapaFluidos.#idx(c, r)] & 15 : 0;
  }

  get activas() {
    return this.#activas.size;
  }

  // ── Escritura ──
  set(c, r, tipo, nivel) {
    if (!CapaFluidos.#dentro(c, r)) return;
    this.celdas[CapaFluidos.#idx(c, r)] = nivel > 0 ? (tipo << 4) | Math.min(CapaFluidos.LLENO, nivel) : 0;
    this.activar(c, r);
  }

  // La celda (o un vecino) cambió: se revisa en el próximo tick.
  activar(c, r) {
    for (const [dc, dr] of [[0, 0], [1, 0], [-1, 0], [0, -1], [0, 1]]) {
      if (CapaFluidos.#dentro(c + dc, r + dr)) this.#activas.add(CapaFluidos.#idx(c + dc, r + dr));
    }
  }

  // Se colocó un bloque encima de un fluido: lo desplaza (se pierde).
  quitar(c, r) {
    this.set(c, r, 0, 0);
  }

  // Cubo lleno: vuelca una celda completa.
  poner(c, r, tipo) {
    this.set(c, r, tipo, CapaFluidos.LLENO);
  }

  // Cubo vacío: junta 8 unidades del fluido de (c, r) y de las celdas del
  // mismo tipo conectadas (un charco chiquito no alcanza). Devuelve el tipo
  // juntado, o 0 si no había suficiente (y en ese caso no toca nada).
  juntar(c, r) {
    const tipo = this.tipo(c, r);
    if (!tipo) return 0;
    const cola = [[c, r]], vistas = new Set([CapaFluidos.#idx(c, r)]), celdas = [];
    let total = 0;
    while (cola.length && total < CapaFluidos.LLENO && vistas.size < 64) {
      const [x, y] = cola.shift();
      celdas.push([x, y]);
      total += this.nivel(x, y);
      for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (this.tipo(nx, ny) !== tipo || vistas.has(CapaFluidos.#idx(nx, ny))) continue;
        vistas.add(CapaFluidos.#idx(nx, ny));
        cola.push([nx, ny]);
      }
    }
    if (total < CapaFluidos.LLENO) return 0;
    let falta = CapaFluidos.LLENO;
    for (const [x, y] of celdas) {
      const n = this.nivel(x, y), saca = Math.min(n, falta);
      this.set(x, y, tipo, n - saca);
      falta -= saca;
      if (!falta) break;
    }
    return tipo;
  }

  // ── Consultas para las entidades ──
  // Qué fluido toca el rectángulo r (x, y, w, h en px de mundo) y si la
  // cabeza (la parte de arriba) está debajo de la superficie.
  enCaja(r) {
    const T = SurviConfig.TILE;
    const c0 = Math.floor(r.x / T), c1 = Math.floor((r.x + r.w - 1) / T);
    const f0 = Math.floor(r.y / T), f1 = Math.floor((r.y + r.h - 1) / T);
    let agua = false, lava = false;
    for (let c = c0; c <= c1; c++) {
      for (let f = f0; f <= f1; f++) {
        const t = this.tipo(c, f);
        if (!t) continue;
        // solo cuenta la parte de la celda que tiene fluido (desde abajo)
        const sup = (f + 1) * T - (this.nivel(c, f) / CapaFluidos.LLENO) * T;
        if (r.y + r.h <= sup) continue;
        if (t === CapaFluidos.AGUA) agua = true;
        else lava = true;
      }
    }
    // cabeza: punto a 3 px del borde de arriba, en el centro
    const hx = Math.floor((r.x + r.w / 2) / T), hyPx = r.y + 3, hy = Math.floor(hyPx / T);
    const th = this.tipo(hx, hy);
    const supH = (hy + 1) * T - (this.nivel(hx, hy) / CapaFluidos.LLENO) * T;
    const cabeza = th && (hyPx >= supH || this.tipo(hx, hy - 1) === th) ? th : 0;
    return { agua, lava, cabeza };
  }

  // Luz que emite la celda (la lava ilumina).
  luz(c, r) {
    return this.tipo(c, r) === CapaFluidos.LAVA ? SurviConfig.LAVA_LUZ : 0;
  }

  // ── Simulación ──
  // libre(c, r): true si el fluido puede ocupar esa celda (tile de aire).
  // alSolidificar(c, r): la lava de (c, r) tocó agua y se volvió piedra.
  actualizar(dt, libre, alSolidificar) {
    for (const tipo of [CapaFluidos.AGUA, CapaFluidos.LAVA]) {
      this.#acumMs[tipo] += dt;
      const regla = CapaFluidos.REGLAS[tipo];
      if (this.#acumMs[tipo] < regla.tickMs) continue;
      this.#acumMs[tipo] = 0;
      this.#paso(tipo, libre, alSolidificar);
    }
  }

  // Un paso para las celdas activas de un tipo. De abajo hacia arriba, así
  // una columna que cae se mueve entera en el mismo paso.
  #paso(tipo, libre, alSolidificar) {
    const COLS = SurviConfig.COLS, L = CapaFluidos.LLENO, C = this.celdas;
    const lista = [];
    for (const i of this.#activas) {
      const t = C[i] >> 4;
      if (t === tipo || t === 0) lista.push(i);
    }
    lista.sort((a, b) => b - a); // filas de abajo primero
    const hasta = Math.min(lista.length, CapaFluidos.MAX_CELDAS_POR_TICK);
    const difLat = CapaFluidos.REGLAS[tipo].difLateral;
    for (let k = 0; k < hasta; k++) {
      const i = lista[k];
      this.#activas.delete(i);
      if (C[i] >> 4 !== tipo) continue;
      let n = C[i] & 15;
      if (!n) continue;
      const c = i % COLS, r = (i - c) / COLS;
      if (!libre(c, r)) { // quedó adentro de un bloque (se colocó uno)
        C[i] = 0;
        continue;
      }
      // agua + lava: la lava se vuelve piedra
      if (tipo === CapaFluidos.LAVA) {
        let toca = false;
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, -1], [0, 1]]) if (this.tipo(c + dc, r + dr) === CapaFluidos.AGUA) toca = true;
        if (toca) {
          C[i] = 0;
          this.activar(c, r);
          alSolidificar(c, r);
          continue;
        }
      }
      const antes = n;
      // 1) caer
      if (r + 1 < SurviConfig.ROWS && libre(c, r + 1)) {
        const j = i + COLS, tj = C[j] >> 4, nj = C[j] & 15;
        if (tj === 0 || tj === tipo) {
          const mueve = Math.min(n, L - nj);
          if (mueve > 0) {
            C[j] = (tipo << 4) | (nj + mueve);
            n -= mueve;
            this.activar(c, r + 1);
          }
        } else if (tipo === CapaFluidos.AGUA && tj === CapaFluidos.LAVA) {
          // agua cayendo sobre lava: la lava se vuelve piedra
          C[j] = 0;
          alSolidificar(c, r + 1);
        }
      }
      // 2) nivelar hacia los costados (solo si abajo ya no puede caer más)
      const abajoLleno = !(r + 1 < SurviConfig.ROWS && libre(c, r + 1)) || (C[i + COLS] >> 4 === tipo && (C[i + COLS] & 15) === L);
      if (n > 0 && abajoLleno) {
        const lados = (c + r) & 1 ? [-1, 1] : [1, -1]; // alterna para no ladearse siempre al mismo lado
        for (const d of lados) {
          const nc = c + d;
          if (nc < 0 || nc >= COLS || !libre(nc, r)) continue;
          const j = i + d, tj = C[j] >> 4, nj = C[j] & 15;
          if (tj !== 0 && tj !== tipo) continue;
          // Pasa 1 unidad si la diferencia es mayor que difLat: el agua se nivela
          // hasta quedar parejita; una gota sola en suelo plano queda de charquito.
          if (n - nj > difLat) {
            C[j] = (tipo << 4) | (nj + 1);
            n -= 1;
            this.activar(nc, r);
          }
        }
      }
      if (n !== antes) {
        C[i] = n > 0 ? (tipo << 4) | n : 0;
        this.activar(c, r);
        this.activar(c, r - 1); // lo de arriba puede caer ahora
      }
    }
    // lo que no se llegó a procesar sigue activo para el próximo tick
  }

  // Corre la simulación hasta que se quede quieta (o un máximo de pasos).
  // Se usa al generar el mundo para que no arranque con agua "flotando".
  asentar(libre, alSolidificar = () => {}, maxPasos = 400) {
    for (let p = 0; p < maxPasos && this.#activas.size; p++) {
      this.#paso(CapaFluidos.AGUA, libre, alSolidificar);
      if (p % 4 === 0) this.#paso(CapaFluidos.LAVA, libre, alSolidificar);
    }
  }

  // ── Dibujo ──
  // Tiene que llamarse con el ctx ya escalado por el zoom (como el tilemap).
  dibujar(ctx, camera, tiempoMs) {
    const T = SurviConfig.TILE, COLS = SurviConfig.COLS, C = this.celdas;
    const c0 = Math.max(0, Math.floor(camera.x / T)), c1 = Math.min(COLS - 1, Math.ceil((camera.x + camera.width) / T));
    const r0 = Math.max(0, Math.floor(camera.y / T)), r1 = Math.min(SurviConfig.ROWS - 1, Math.ceil((camera.y + camera.height) / T));
    const ox = -camera.x, oy = -camera.y;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const v = C[r * COLS + c];
        if (!v) continue;
        const tipo = v >> 4, n = v & 15;
        const arriba = r > 0 ? C[(r - 1) * COLS + c] >> 4 : 0;
        const lleno = arriba === tipo; // debajo de más fluido: la celda se ve llena
        const h = lleno ? T : Math.max(2, Math.round((n / CapaFluidos.LLENO) * T));
        const x = Math.round(c * T + ox), y = Math.round((r + 1) * T - h + oy);
        if (tipo === CapaFluidos.AGUA) {
          ctx.fillStyle = 'rgba(46, 104, 214, 0.55)';
          ctx.fillRect(x, y, T, h);
          if (!lleno) {
            ctx.fillStyle = 'rgba(160, 210, 255, 0.75)';
            ctx.fillRect(x, y, T, 1);
          }
        } else {
          // lava: brillo que late despacio, distinto por columna
          const late = 0.5 + 0.5 * Math.sin(tiempoMs / 420 + c * 0.9 + r * 0.4);
          ctx.fillStyle = `rgb(${210 + Math.round(35 * late)}, ${70 + Math.round(40 * late)}, 20)`;
          ctx.fillRect(x, y, T, h);
          if (!lleno) {
            ctx.fillStyle = '#ffcf4a';
            ctx.fillRect(x, y, T, 2);
          }
        }
      }
    }
  }

  // ── Generación ──
  // Lagos en la superficie y pozos de agua/lava en las cuevas. `data` y
  // `surfaceByCol` son los del generador de mundo; `arena` = id del relleno
  // de arena (el fondo de los lagos). Se llama antes del autotile.
  static generar(data, surfaceByCol, biomeByCol, rnd, arena) {
    const COLS = SurviConfig.COLS, ROWS = SurviConfig.ROWS;
    const capa = new CapaFluidos();
    const idx = (c, r) => r * COLS + c;
    const libre = (c, r) => CapaFluidos.#dentro(c, r) && data[idx(c, r)] === 0;
    const escala = (COLS * ROWS) / (200 * 200);

    // ── Lagos grandes y hondos (para pescar): 1 o 2 por mundo ──
    CapaFluidos.#lagosGrandes(capa, data, surfaceByCol, biomeByCol, rnd, arena);

    // ── Lagos de superficie (no en desierto ni nieve) ──
    const nLagos = Math.round(3 * (COLS / 200));
    for (let k = 0; k < nLagos * 4 && capa.#lagos < nLagos; k++) {
      const w = 7 + Math.floor(rnd() * 8), d = 2 + Math.floor(rnd() * 3);
      const c = 12 + Math.floor(rnd() * (COLS - w - 24));
      let ok = true;
      for (let x = c - 2; x <= c + w + 1; x++) if (['desierto', 'nieve'].includes(biomeByCol[x])) ok = false;
      // terreno más o menos plano (si no, el agua se escapa por un costado)
      let sMin = Infinity, sMax = -Infinity;
      for (let x = c - 1; x <= c + w; x++) { sMin = Math.min(sMin, surfaceByCol[x]); sMax = Math.max(sMax, surfaceByCol[x]); }
      if (!ok || sMax - sMin > 2) continue;
      capa.#lagos++;
      const tope = Math.max(surfaceByCol[c - 1], surfaceByCol[c + w]); // la orilla más baja
      for (let x = c; x < c + w; x++) {
        const s = surfaceByCol[x];
        const prof = Math.max(1, Math.round(d * Math.sin((Math.PI * (x - c + 0.5)) / w)));
        for (let r = Math.min(s, tope); r < s + prof; r++) data[idx(x, r)] = 0; // se cava la cubeta
        for (let r = s + prof; r < s + prof + 2; r++) if (data[idx(x, r)] !== 0) data[idx(x, r)] = arena; // fondo de arena
        for (let r = tope; r < s + prof; r++) if (libre(x, r)) capa.celdas[idx(x, r)] = (CapaFluidos.AGUA << 4) | CapaFluidos.LLENO;
        surfaceByCol[x] = s + prof; // el suelo quedó más abajo
      }
      // orillas de arena
      for (const x of [c - 1, c + w]) for (let r = surfaceByCol[x]; r < surfaceByCol[x] + 2; r++) if (data[idx(x, r)] !== 0) data[idx(x, r)] = arena;
    }

    // ── Pozos subterráneos: agua en las cuevas, lava en lo más hondo ──
    // Devuelve true si pudo armar el pozo (tiene que quedar encerrado).
    const pozo = (tipo, c, r, maxAlto) => {
      if (!libre(c, r)) return false;
      while (r + 1 < ROWS && libre(c, r + 1)) r++; // baja hasta el piso
      for (let alto = 0; alto < maxAlto; alto++, r--) {
        let a = c, b = c;
        while (a - 1 >= 0 && libre(a - 1, r) && !libre(a - 1, r + 1) && c - a < 18) a--;
        while (b + 1 < COLS && libre(b + 1, r) && !libre(b + 1, r + 1) && b - c < 18) b++;
        // tiene que quedar encerrado por paredes (si no, se derrama)
        if (libre(a - 1, r) || libre(b + 1, r) || b - a < 2) return alto > 0;
        for (let x = a; x <= b; x++) if (libre(x, r) && !libre(x, r + 1)) capa.celdas[idx(x, r)] = (tipo << 4) | CapaFluidos.LLENO;
        if (!libre(c, r - 1)) return true;
      }
      return true;
    };
    // Se sigue probando lugares al azar hasta lograr la cantidad pedida
    // (muchos intentos caen en roca o en cuevas abiertas que no retienen).
    const hacerPozos = (tipo, cantidad, filaDesde, filaHasta, maxAlto) => {
      let hechos = 0;
      for (let k = 0; k < cantidad * 60 && hechos < cantidad; k++) {
        const c = 5 + Math.floor(rnd() * (COLS - 10));
        const desde = Math.max(filaDesde(c), 1);
        const r = desde + Math.floor(rnd() * Math.max(1, filaHasta - desde));
        if (pozo(tipo, c, r, 1 + Math.floor(rnd() * maxAlto))) hechos++;
      }
    };
    hacerPozos(CapaFluidos.AGUA, Math.round(12 * escala), (c) => surfaceByCol[c] + 30, SurviConfig.DEEP_STONE_ROW, 3);
    hacerPozos(CapaFluidos.LAVA, Math.round(14 * escala), () => SurviConfig.DEEP_STONE_ROW, ROWS - 4, 2);
    // arranca asentada (si algo quedó colgando, cae ahora y no durante el juego)
    capa.#activas.clear();
    for (let i = 0; i < capa.celdas.length; i++) if (capa.celdas[i]) capa.#activas.add(i);
    capa.asentar(libre, (c, r) => { data[idx(c, r)] = SurviConfig.T.STONE; });
    return capa;
  }

  #lagos = 0;
  lagosGrandes = []; // [{ c, w, nivel }] (los usa la pesca / el debug)

  // Lago grande: 22 a 50 bloques de ancho y 8 a 16 de hondo, con forma de
  // cuenco. Se aplana lo que haya arriba del nivel del agua, el fondo y las
  // paredes son de arena (tapan túneles de abajo para que no se vacíe) y las
  // orillas también. Se hace antes que los árboles, así no quedan encima.
  static #lagosGrandes(capa, data, surfaceByCol, biomeByCol, rnd, arena) {
    const COLS = SurviConfig.COLS, ROWS = SurviConfig.ROWS, L = SurviConfig.LAGOS_GRANDES;
    const idx = (c, r) => r * COLS + c;
    const cantidad = L.min + Math.floor(rnd() * (L.max - L.min + 1));
    const hechos = [];
    for (let k = 0; k < 40 && hechos.length < cantidad; k++) {
      const w = L.anchoMin + Math.floor(rnd() * (L.anchoMax - L.anchoMin + 1));
      const c = 25 + Math.floor(rnd() * (COLS - w - 50));
      // ni en el desierto, ni encima de otro lago grande
      let ok = true;
      for (let x = c - 3; x <= c + w + 2; x++) if (biomeByCol[x] === 'desierto') ok = false;
      for (const h of hechos) if (c < h.c + h.w + 20 && c + w + 20 > h.c) ok = false;
      if (!ok) continue;
      // el agua llega hasta la orilla más baja (así no se derrama)
      const nivel = Math.max(surfaceByCol[c - 1], surfaceByCol[c + w]);
      const hondo = L.hondoMin + Math.floor(rnd() * (L.hondoMax - L.hondoMin + 1));
      if (nivel + hondo + 6 >= SurviConfig.DEEP_STONE_ROW) continue;
      let fondoMax = nivel;
      for (let i = 0; i < w; i++) {
        const x = c + i;
        const d = Math.max(2, Math.round(hondo * Math.pow(Math.sin((Math.PI * (i + 0.5)) / w), 0.6)));
        const fondo = nivel + d;
        fondoMax = Math.max(fondoMax, fondo);
        for (let r = 0; r < fondo; r++) data[idx(x, r)] = 0; // se aplana y se cava
        for (let r = nivel; r < fondo; r++) capa.celdas[idx(x, r)] = (CapaFluidos.AGUA << 4) | CapaFluidos.LLENO;
        for (let r = fondo; r < fondo + 3 && r < ROWS - 3; r++) data[idx(x, r)] = arena; // fondo de arena
        surfaceByCol[x] = fondo;
      }
      // paredes: donde el agua toca aire afuera del lago (un túnel), arena
      for (const x of [c - 2, c - 1, c + w, c + w + 1]) {
        for (let r = nivel; r < fondoMax + 3 && r < ROWS - 3; r++) if (data[idx(x, r)] === 0) data[idx(x, r)] = arena;
        // orilla de arena arriba
        for (let r = surfaceByCol[x]; r < surfaceByCol[x] + 2; r++) if (data[idx(x, r)] !== 0) data[idx(x, r)] = arena;
      }
      hechos.push({ c, w, nivel });
    }
    capa.lagosGrandes = hechos;
  }
}
