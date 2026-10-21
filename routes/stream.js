const express = require('express');
const { verificarToken } = require('../middlewares/auth');
const tiempoReal = require('../services/tiempoReal');
const { getDb } = require('../database/db');

// "Última conexión" del panel admin: se marca al abrir y al cerrar el canal
// (mientras está abierto, el usuario figura "En línea").
async function marcarConexion(usuarioId) {
    try {
        const db = await getDb();
        await db.query('UPDATE usuarios SET ultima_conexion = NOW() WHERE id = $1', [usuarioId]);
    } catch {
        /* no es crítico */
    }
}

const router = express.Router();

// Canal en tiempo real de cada usuario logueado (Server-Sent Events).
// El frontend lo abre con fetch (no con EventSource) para poder mandar el
// token en el header Authorization en vez de ponerlo en la URL.
// Eventos: notificacion, aviso, aviso_retirado, config, sesion.
router.get('/stream', verificarToken, (req, res) => {
    tiempoReal.suscribirUsuario(req, res, req.user);
    marcarConexion(req.user.id);
    req.on('close', () => marcarConexion(req.user.id));
});

module.exports = router;
