// ══════════════════════════════════════════════════════════════
//   Pixel Survi — survi_save.js
//   Clase GestorGuardado: los 3 puntos de guardado (Mundo 1 / 2 / 3) en
//   localStorage. Es la ÚNICA clase que toca esas claves.
//
//   Cada mundo usa DOS claves:
//     <prefijo>N.meta → { seed, nombre, modo, dificultad, muerto, playedMs, savedAt, biome }  (chico)
//     <prefijo>N.data → { tiles, px, py, hp, inventory, ... }     (grande)
//   El menú lista con la meta nomás: parsear los 40.000 tiles de los tres
//   mundos solo para dibujar tres tarjetas era tirar medio segundo a la
//   basura cada vez que se abre el cartel.
//
//   Los mundos son por usuario: el constructor recibe una función que
//   convierte cada clave en la del usuario actual (ServiciosApp.claveUsuario)
//   y se aplica en cada acceso, así cerrar sesión y entrar con otra cuenta
//   muestra sus propios mundos sin recargar la página.
// ══════════════════════════════════════════════════════════════

import { SurviConfig } from './survi_config.js';

export class GestorGuardado {
  // v2: el tileset pasó de 46 a 139 tiles y los ids cambiaron (familias de
  // autotile + piezas de árbol). Un save v1 dibujaría un mundo con las
  // texturas mezcladas, así que se descarta solo.
  // v3: el mundo pasó de 200x200 a 500x250 bloques y los tiles se guardan
  // comprimidos (ver codificarTiles). Un save v2 tiene otro tamaño de mapa,
  // así que se descarta solo (el espacio aparece vacío).
  static VERSION = 3;
  static SLOTS = [1, 2, 3];
  constructor(claveUsuario = (base) => base, prefijo = 'juefriv.survi.mundo') {
    this.claveUsuario = claveUsuario;
    this.prefijo = prefijo;
  }

  // Las dos claves de un mundo se piden SIEMPRE juntas: así, si hay que
  // migrar un mundo viejo (sin usuario) a la cuenta actual, se migran la
  // meta y los datos a la vez y nunca queda uno de cada lado.
  claves(slot) {
    return {
      meta: this.claveUsuario(`${this.prefijo}${slot}.meta`),
      data: this.claveUsuario(`${this.prefijo}${slot}.data`),
    };
  }

  metaKey(slot) {
    return this.claves(slot).meta;
  }

  dataKey(slot) {
    return this.claves(slot).data;
  }

  static leerJSON(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      return null;
    }
  }

  leerMeta(slot) {
    const m = GestorGuardado.leerJSON(this.metaKey(slot));
    if (!m || m.v !== GestorGuardado.VERSION) return null;
    return m;
  }

  // Modo y dificultad de una meta. Los mundos de antes solo tenían `mode`
  // ('normal' | 'hardcore'): pasan a supervivencia con esa dificultad.
  static modoDe(meta) {
    return meta && meta.modo === 'creativo' ? 'creativo' : 'supervivencia';
  }

  static dificultadDe(meta) {
    if (!meta) return 'normal';
    if (meta.dificultad) return meta.dificultad;
    return meta.mode === 'hardcore' ? 'hardcore' : 'normal';
  }

  listarSlots() {
    return GestorGuardado.SLOTS.map((slot) => {
      const meta = this.leerMeta(slot);
      return {
        slot,
        exists: !!meta,
        nombre: meta && meta.nombre ? meta.nombre : `Mundo ${slot}`,
        modo: GestorGuardado.modoDe(meta),
        dificultad: GestorGuardado.dificultadDe(meta),
        muerto: !!(meta && meta.muerto), // hardcore que ya murió: solo espectador
        playedMs: meta ? meta.playedMs || 0 : 0,
        savedAt: meta ? meta.savedAt : null,
        biome: meta ? meta.biome : null,
      };
    });
  }

  cargarMundo(slot) {
    const meta = this.leerMeta(slot);
    if (!meta) return null;
    const data = GestorGuardado.leerJSON(this.dataKey(slot));
    if (!data) return null;
    data.tiles = GestorGuardado.decodificarTiles(data.tiles);
    if (!data.tiles) return null; // datos dañados: el menú avisa en vez de pisarlos
    // agua y lava (un mundo de antes no las tiene: arranca sin fluidos)
    data.fluidos = data.fluidos ? GestorGuardado.decodificarTiles(data.fluidos) : null;
    // capa de fondo (un mundo de antes no tiene: arranca vacía)
    data.fondo = data.fondo ? GestorGuardado.decodificarTiles(data.fondo) : null;
    return {
      ...meta,
      ...data,
    };
  }

  // payload: { seed, nombre, modo, dificultad, muerto, playedMs, biome, tiles, px, py, hp, hunger, timeOfDay, inventory, hotbarSlots, selectedSlot, equipment, enemies, enemyTimer, animals, animalTimer, desgaste, desgasteEquipo }
  guardarMundo(slot, payload) {
    // ORDEN: primero los datos, la meta al final. La meta es la que dice "este
    // mundo existe" (listarSlots/leerMeta). Antes se escribía primero: si el
    // localStorage se llenaba justo en el segundo setItem, quedaba una meta
    // sin datos → el menú mostraba el mundo, cargarMundo devolvía null y se
    // generaba un mundo nuevo que en el próximo guardado pisaba todo.
    // Así, si falla la escritura de los datos, la meta vieja sigue apuntando
    // a los datos viejos (que setItem no llegó a tocar).
    try {
      localStorage.setItem(
        this.dataKey(slot),
        JSON.stringify({
          tiles: GestorGuardado.codificarTiles(payload.tiles),
          fluidos: payload.fluidos ? GestorGuardado.codificarTiles(payload.fluidos) : null, // agua y lava
          px: payload.px,
          py: payload.py,
          hp: payload.hp,
          hunger: payload.hunger,
          timeOfDay: payload.timeOfDay,
          stations: payload.stations,
          // hornos y cofres (contenido y estado)
          inventory: payload.inventory,
          hotbarSlots: payload.hotbarSlots,
          selectedSlot: payload.selectedSlot,
          equipment: payload.equipment,
          desgaste: payload.desgaste || {}, // durabilidad gastada (inventario)
          desgasteEquipo: payload.desgasteEquipo || {}, // durabilidad gastada (armadura puesta)
          enemies: payload.enemies || [],
          // enemigos vivos en el mapa
          enemyTimer: payload.enemyTimer,
          animals: payload.animals || [], // animales vivos en el mapa
          animalTimer: payload.animalTimer,
          clima: payload.clima || null, // { tipo, restanteMs }
          fondo: payload.fondo ? GestorGuardado.codificarTiles(payload.fondo) : null, // paredes y ventanas
          cama: payload.cama || null, // punto de reaparición
          dias: payload.dias || 1, // días vividos
          sueltos: payload.sueltos || [], // ítems tirados en el suelo
          cultivos: payload.cultivos || {}, // "col,row" → ms que lleva creciendo
        }),
      );
      localStorage.setItem(
        this.metaKey(slot),
        JSON.stringify({
          v: GestorGuardado.VERSION,
          seed: payload.seed,
          nombre: payload.nombre,
          modo: payload.modo,
          dificultad: payload.dificultad,
          muerto: !!payload.muerto,
          playedMs: payload.playedMs || 0,
          biome: payload.biome || null,
          savedAt: Date.now(),
        }),
      );
      return true;
    } catch (e) {
      // localStorage lleno o bloqueado: el juego sigue, solo no persiste.
      console.warn('[pixel-survi] no se pudo guardar el mundo', slot, e);
      return false;
    }
  }

  borrarMundo(slot) {
    try {
      localStorage.removeItem(this.metaKey(slot));
      localStorage.removeItem(this.dataKey(slot));
    } catch {}
  }

  // ─── Compresión de los tiles ───
  // El mapa es casi todo corridas del mismo bloque (aire, piedra, tierra), así
  // que se guarda como RLE: pares [id, repeticiones (1..255)] en bytes, pasados
  // a base64. Un mundo de 500x250 queda en ~140 KB en vez de ~330 KB como
  // array JSON (localStorage tiene ~5 MB para todo el sitio).
  // Si algún id no entra en un byte (> 255), se guarda como array, como antes.
  static PREFIJO_RLE = 'rle8:';

  static codificarTiles(tiles) {
    const bytes = [];
    for (let i = 0; i < tiles.length; ) {
      const v = tiles[i];
      if (v > 255) return Array.from(tiles);
      let j = i + 1;
      while (j < tiles.length && tiles[j] === v && j - i < 255) j++;
      bytes.push(v, j - i);
      i = j;
    }
    let bin = '';
    const u8 = Uint8Array.from(bytes);
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return GestorGuardado.PREFIJO_RLE + btoa(bin);
  }

  // Devuelve un Uint16Array con los tiles (acepta el formato comprimido o el
  // array viejo), o null si el texto está roto o no tiene el tamaño del mundo.
  static decodificarTiles(guardado) {
    try {
      let tiles;
      if (Array.isArray(guardado)) tiles = Uint16Array.from(guardado);
      else if (typeof guardado === 'string' && guardado.startsWith(GestorGuardado.PREFIJO_RLE)) {
        const bin = atob(guardado.slice(GestorGuardado.PREFIJO_RLE.length));
        let total = 0;
        for (let i = 1; i < bin.length; i += 2) total += bin.charCodeAt(i);
        tiles = new Uint16Array(total);
        let k = 0;
        for (let i = 0; i + 1 < bin.length; i += 2) {
          const v = bin.charCodeAt(i), n = bin.charCodeAt(i + 1);
          tiles.fill(v, k, k + n);
          k += n;
        }
      } else return null;
      return tiles.length === SurviConfig.COLS * SurviConfig.ROWS ? tiles : null;
    } catch {
      return null;
    }
  }

  // "1h 04m" / "12m 30s" / "45s"
  static fmtTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
    if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
    return `${s}s`;
  }
}
