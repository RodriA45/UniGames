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
        const rows = await db.all(
            `SELECT id, tipo, mensaje, enlace, leido, TO_CHAR(fecha, 'YYYY-MM-DD HH24:MI:SS') AS fecha
             FROM notificaciones
             WHERE usuario_id = ?
             ORDER BY fecha DESC
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
