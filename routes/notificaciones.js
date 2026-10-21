const express = require('express');
const { getDb } = require('../database/db');
const { verificarToken, apiRateLimit } = require('../middlewares/auth');

const router = express.Router();

// Todas las rutas de este archivo requieren estar logueado, y comparten
// un límite de 60 pedidos por minuto por IP (mismo criterio que el resto
// de la API, ver apiRateLimit en middlewares/auth.js).
router.use(apiRateLimit);
router.use(verificarToken);

// 1. Listado de notificaciones del usuario (más recientes primero)
router.get('/notificaciones', async (req, res) => {
    const db = await getDb();
    try {
        // Las de avisos no guardan texto propio (mensaje NULL): el título y
        // el texto salen de la tabla avisos (3FN, no se duplica por usuario).
        const rows = await db.all(
            `SELECT n.id, n.tipo, COALESCE(n.mensaje, a.titulo) AS mensaje, a.texto AS detalle,
                    a.prioridad, n.aviso_id, n.enlace, n.leido,
                    TO_CHAR(n.fecha, 'YYYY-MM-DD HH24:MI:SS') AS fecha
             FROM notificaciones n
             LEFT JOIN avisos a ON a.id = n.aviso_id
             WHERE n.usuario_id = ?
             ORDER BY n.fecha DESC, n.id DESC
             LIMIT 50`,
            [req.user.id]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error en GET /api/notificaciones:', error);
        res.status(500).json({ error: 'Error al obtener las notificaciones' });
    }
});

// 2. Solo el contador de no leídas (para el badge del menú)
router.get('/notificaciones/no-leidas', async (req, res) => {
    const db = await getDb();
    try {
        const row = await db.get(
            `SELECT COUNT(*) AS count FROM notificaciones WHERE usuario_id = ? AND leido = 0`,
            [req.user.id]
        );
        res.json({ count: row.count });
    } catch (error) {
        console.error('Error en GET /api/notificaciones/no-leidas:', error);
        res.status(500).json({ error: 'Error al obtener el contador' });
    }
});

// 2.b Avisos de prioridad alta que el usuario todavía no vio: se muestran
// en el cartel del medio al entrar (para los que no estaban conectados
// cuando se mandaron). Al cerrarlo, el front la marca como leída.
router.get('/notificaciones/avisos-pendientes', async (req, res) => {
    const db = await getDb();
    try {
        const rows = await db.all(
            `SELECT n.id AS notificacion_id, a.id, a.titulo, a.texto, a.enviado_en
             FROM notificaciones n
             JOIN avisos a ON a.id = n.aviso_id
             WHERE n.usuario_id = ? AND n.leido = 0 AND a.prioridad = 'alta'
             ORDER BY a.enviado_en ASC
             LIMIT 5`,
            [req.user.id]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error en GET /api/notificaciones/avisos-pendientes:', error);
        res.status(500).json({ error: 'Error al obtener los avisos' });
    }
});

// 3. Marcar una notificación puntual como leída
router.post('/notificaciones/:id/leer', async (req, res) => {
    const { id } = req.params;
    const db = await getDb();
    try {
        const result = await db.run(
            `UPDATE notificaciones SET leido = 1 WHERE id = ? AND usuario_id = ?`,
            [id, req.user.id]
        );
        if (result.changes === 0) return res.status(404).json({ error: 'Notificación no encontrada' });
        res.json({ message: 'Notificación marcada como leída' });
    } catch (error) {
        console.error('Error en POST /api/notificaciones/:id/leer:', error);
        res.status(500).json({ error: 'Error al actualizar la notificación' });
    }
});

// 3.b Marcar como leída la notificación de un aviso (al cerrar el cartel
// de un aviso de prioridad alta, que no conoce el id de la notificación)
router.post('/notificaciones/aviso/:avisoId/leer', async (req, res) => {
    const db = await getDb();
    try {
        await db.run(
            `UPDATE notificaciones SET leido = 1 WHERE aviso_id = ? AND usuario_id = ?`,
            [req.params.avisoId, req.user.id]
        );
        res.json({ message: 'Aviso marcado como leído' });
    } catch (error) {
        console.error('Error en POST /api/notificaciones/aviso/:avisoId/leer:', error);
        res.status(500).json({ error: 'Error al actualizar el aviso' });
    }
});

// 4. Marcar todas como leídas
router.post('/notificaciones/leer-todas', async (req, res) => {
    const db = await getDb();
    try {
        await db.query(`UPDATE notificaciones SET leido = 1 WHERE usuario_id = $1 AND leido = 0`, [req.user.id]);
        res.json({ message: 'Notificaciones marcadas como leídas' });
    } catch (error) {
        console.error('Error en POST /api/notificaciones/leer-todas:', error);
        res.status(500).json({ error: 'Error al actualizar las notificaciones' });
    }
});

// 5. Eliminar una notificación puntual
router.delete('/notificaciones/:id', async (req, res) => {
    const { id } = req.params;
    const db = await getDb();
    try {
        const result = await db.run(
            `DELETE FROM notificaciones WHERE id = ? AND usuario_id = ?`,
            [id, req.user.id]
        );
        if (result.changes === 0) return res.status(404).json({ error: 'Notificación no encontrada' });
        res.json({ message: 'Notificación eliminada' });
    } catch (error) {
        console.error('Error en DELETE /api/notificaciones/:id:', error);
        res.status(500).json({ error: 'Error al eliminar la notificación' });
    }
});

module.exports = router;
