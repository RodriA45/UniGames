// ══════════════════════════════════════════════════════════════════
//   UniGames — services/configSitio.js
// ══════════════════════════════════════════════════════════════════
// Lectura de configuracion_global con una caché corta, para los chequeos
// que corren en cada pedido (modo mantenimiento) o en el login (registro
// abierto) sin ir a la base cada vez. Al guardar desde el panel se invalida.
// ══════════════════════════════════════════════════════════════════

const { getDb } = require('../database/db');

const TTL_MS = 10 * 1000;
let cache = null;
let cacheTs = 0;

async function obtenerConfig() {
    if (cache && Date.now() - cacheTs < TTL_MS) return cache;
    const db = await getDb();
    const { rows } = await db.query('SELECT clave, valor FROM configuracion_global');
    cache = Object.fromEntries(rows.map((r) => [r.clave, r.valor]));
    cacheTs = Date.now();
    return cache;
}

function invalidarConfig() {
    cache = null;
}

async function enMantenimiento() {
    try {
        return (await obtenerConfig()).mantenimiento_activo === 'true';
    } catch {
        return false; // si la base no responde, no bloqueamos el sitio por esto
    }
}

async function registroAbierto() {
    try {
        return (await obtenerConfig()).registro_abierto !== 'false';
    } catch {
        return true;
    }
}

module.exports = { obtenerConfig, invalidarConfig, enMantenimiento, registroAbierto };
