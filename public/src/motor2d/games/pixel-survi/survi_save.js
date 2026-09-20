// ══════════════════════════════════════════════════════════════
//   Pixel Survi — survi_save.js
//   3 puntos de guardado (Mundo 1 / 2 / 3) en localStorage.
//
//   Cada mundo usa DOS claves:
//     ...mundoN.meta → { seed, mode, playedMs, savedAt, biome }  (chico)
//     ...mundoN.data → { tiles, px, py, hp, inventory, ... }     (grande)
//   El menú lista con la meta nomás: parsear los 40.000 tiles de los tres
//   mundos solo para dibujar tres tarjetas era tirar medio segundo a la
//   basura cada vez que se abre el cartel.
// ══════════════════════════════════════════════════════════════

const PREFIX = 'juefriv.survi.mundo';
// v2: el tileset pasó de 46 a 139 tiles y los ids cambiaron (familias de
// autotile + piezas de árbol). Un save v1 dibujaría un mundo con las
// texturas mezcladas, así que se descarta solo.
const VERSION = 2;
export const SLOTS = [1, 2, 3];

const metaKey = (slot) => `${PREFIX}${slot}.meta`;
const dataKey = (slot) => `${PREFIX}${slot}.data`;

function readJSON(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

export function readMeta(slot) {
  const m = readJSON(metaKey(slot));
  if (!m || m.v !== VERSION) return null;
  return m;
}

export function listSlots() {
  return SLOTS.map(slot => {
    const meta = readMeta(slot);
    return {
      slot,
      exists: !!meta,
      mode: meta ? meta.mode : null,
      playedMs: meta ? (meta.playedMs || 0) : 0,
      savedAt: meta ? meta.savedAt : null,
      biome: meta ? meta.biome : null
    };
  });
}

export function loadWorld(slot) {
  const meta = readMeta(slot);
  if (!meta) return null;
  const data = readJSON(dataKey(slot));
  if (!data) return null;
  return { ...meta, ...data };
}

// payload: { seed, mode, playedMs, biome, tiles, px, py, hp, hunger, inventory, hotbarSlots, selectedSlot }
export function saveWorld(slot, payload) {
  try {
    localStorage.setItem(metaKey(slot), JSON.stringify({
      v: VERSION,
      seed: payload.seed,
      mode: payload.mode,
      playedMs: payload.playedMs || 0,
      biome: payload.biome || null,
      savedAt: Date.now()
    }));
    localStorage.setItem(dataKey(slot), JSON.stringify({
      tiles: payload.tiles,
      px: payload.px, py: payload.py,
      hp: payload.hp,
      hunger: payload.hunger,
      inventory: payload.inventory,
      hotbarSlots: payload.hotbarSlots,
      selectedSlot: payload.selectedSlot,
      equipment: payload.equipment
    }));
    return true;
  } catch (e) {
    // localStorage lleno o bloqueado: el juego sigue, solo no persiste.
    console.warn('[pixel-survi] no se pudo guardar el mundo', slot, e);
    return false;
  }
}

export function deleteWorld(slot) {
  try {
    localStorage.removeItem(metaKey(slot));
    localStorage.removeItem(dataKey(slot));
  } catch {}
}

// "1h 04m" / "12m 30s" / "45s"
export function fmtTime(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}
