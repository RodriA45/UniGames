// ══════════════════════════════════════════════════════════════════
//   UniGames — services/sanciones.js
// ══════════════════════════════════════════════════════════════════
// Baneos de cuentas (tabla sanciones). Una cuenta está baneada si tiene una
// sanción vigente: permanente, o temporal con "hasta" en el futuro (vista
// v_sanciones_activas). Al vencer un baneo temporal, la cuenta vuelve sola.
//
// verificarToken consulta esto en cada pedido autenticado, así un baneo
// corta el acceso aunque el usuario tenga un token válido por 7 días. Para
// no ir a la base cada vez hay una caché corta que se invalida al banear o
// desbanear.
// ══════════════════════════════════════════════════════════════════

const { getDb } = require('../database/db');

const TTL_MS = 30 * 1000;
const cache = new Map(); // usuarioId -> { sancion | null, ts }

async function sancionActiva(usuarioId) {
    const id = Number(usuarioId);
    const c = cache.get(id);
    // Un temporal que venció mientras estaba en caché ya no cuenta
    if (c && Date.now() - c.ts < TTL_MS) {
        if (!c.sancion || c.sancion.tipo === 'permanente' || new Date(c.sancion.hasta) > new Date()) return c.sancion;
        return null;
    }
    const db = await getDb();
    const r = await db.query(
        `SELECT id, tipo, motivo, hasta, creado_en FROM v_sanciones_activas WHERE usuario_id = $1`,
        [id]
    );
    const sancion = r.rows[0] || null;
    cache.set(id, { sancion, ts: Date.now() });
    return sancion;
}

function invalidarSancion(usuarioId) {
    cache.delete(Number(usuarioId));
}

// Texto para mostrarle al usuario (login, cartel al ser baneado).
function mensajeSancion(s) {
    if (!s) return '';
    const motivo = s.motivo ? ` Motivo: ${s.motivo}` : '';
    if (s.tipo === 'permanente') return `Tu cuenta fue suspendida de forma permanente.${motivo}`;
    const hasta = new Date(s.hasta).toLocaleString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    return `Tu cuenta está suspendida hasta el ${hasta}.${motivo}`;
}

module.exports = { sancionActiva, invalidarSancion, mensajeSancion };
