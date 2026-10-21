// ══════════════════════════════════════════════════════════════════
//   UniGames — services/notificaciones.js
// ══════════════════════════════════════════════════════════════════
// Un solo lugar para crear notificaciones: se guardan en la base y, si el
// destinatario tiene la página abierta, le llegan al instante por el canal
// en tiempo real (services/tiempoReal.js). Antes cada ruta hacía su propio
// INSERT y el usuario recién se enteraba en el próximo refresco (30 s).
// ══════════════════════════════════════════════════════════════════

const tiempoReal = require('./tiempoReal');

const COLUMNAS = `id, tipo, mensaje, enlace, leido, aviso_id, TO_CHAR(fecha, 'YYYY-MM-DD HH24:MI:SS') AS fecha`;

// Notificación para un usuario. Nunca tira error: una notificación que
// falla no debe hacer fallar la acción que la disparó (aceptar un duelo,
// guardar un récord...).
async function crearNotificacion(db, usuarioId, { tipo, mensaje, enlace = null }) {
    try {
        const r = await db.query(
            `INSERT INTO notificaciones (usuario_id, tipo, mensaje, enlace) VALUES ($1, $2, $3, $4) RETURNING ${COLUMNAS}`,
            [usuarioId, tipo, mensaje, enlace]
        );
        const notif = r.rows[0];
        tiempoReal.enviarAUsuario(usuarioId, 'notificacion', notif);
        return notif;
    } catch (err) {
        console.error(`Error al crear notificación (${tipo}) para el usuario ${usuarioId}:`, err.message);
        return null;
    }
}

module.exports = { crearNotificacion };
