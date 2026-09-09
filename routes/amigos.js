const express = require('express');
const { getDb } = require('../database/db');
const { verificarToken } = require('../middlewares/auth');

const router = express.Router();

const MAX_AMIGOS = 50; // mismo límite que valida el frontend (MAX_AMIGOS en app2.js)

// 1. Lista de amigos actuales
router.get('/amigos', verificarToken, async (req, res) => {
    const db = await getDb();
    try {
        const amigos = await db.all(`
            SELECT u.id, u.nombre_usuario AS username, u.icono AS avatar
            FROM amistades a
            JOIN usuarios u ON u.id = CASE WHEN a.usuario1_id = ? THEN a.usuario2_id ELSE a.usuario1_id END
            WHERE a.estado = 'aceptada' AND (a.usuario1_id = ? OR a.usuario2_id = ?)
            ORDER BY u.nombre_usuario ASC
        `, [req.user.id, req.user.id, req.user.id]);
        res.json(amigos);
    } catch (error) {
        console.error('Error en GET /api/amigos:', error);
        res.status(500).json({ error: 'Error al obtener la lista de amigos' });
    }
});

// 2. Solicitudes pendientes (enviadas y recibidas)
router.get('/amigos/solicitudes', verificarToken, async (req, res) => {
    const db = await getDb();
    try {
        const recibidas = await db.all(`
            SELECT a.id, u.id AS usuario_id, u.nombre_usuario AS username, u.icono AS avatar, a.fecha
            FROM amistades a JOIN usuarios u ON u.id = a.usuario1_id
            WHERE a.usuario2_id = ? AND a.estado = 'pendiente'
            ORDER BY a.fecha DESC
        `, [req.user.id]);

        const enviadas = await db.all(`
            SELECT a.id, u.id AS usuario_id, u.nombre_usuario AS username, u.icono AS avatar, a.fecha
            FROM amistades a JOIN usuarios u ON u.id = a.usuario2_id
            WHERE a.usuario1_id = ? AND a.estado = 'pendiente'
            ORDER BY a.fecha DESC
        `, [req.user.id]);

        res.json({ recibidas, enviadas });
    } catch (error) {
        console.error('Error en GET /api/amigos/solicitudes:', error);
        res.status(500).json({ error: 'Error al obtener las solicitudes' });
    }
});

// 3. Enviar solicitud de amistad
router.post('/amigos/solicitudes', verificarToken, async (req, res) => {
    const { receptor_id } = req.body;
    const db = await getDb();

    if (!receptor_id || !/^\d+$/.test(String(receptor_id))) {
        return res.status(400).json({ error: 'Falta indicar un usuario válido' });
    }
    const receptorId = Number(receptor_id);
    if (receptorId === req.user.id) {
        return res.status(400).json({ error: 'No podés agregarte a vos mismo' });
    }

    try {
        const receptor = (await db.query(`SELECT id FROM usuarios WHERE id = $1`, [receptorId])).rows[0];
        if (!receptor) return res.status(404).json({ error: 'Usuario no encontrado' });

        const existente = await db.get(
            `SELECT id, estado FROM amistades WHERE (usuario1_id = ? AND usuario2_id = ?) OR (usuario1_id = ? AND usuario2_id = ?)`,
            [req.user.id, receptorId, receptorId, req.user.id]
        );
        if (existente) {
            return res.status(400).json({
                error: existente.estado === 'aceptada' ? 'Ya son amigos' : 'Ya existe una solicitud entre estos usuarios'
            });
        }

        const { count } = await db.get(
            `SELECT COUNT(*) AS count FROM amistades WHERE estado = 'aceptada' AND (usuario1_id = ? OR usuario2_id = ?)`,
            [req.user.id, req.user.id]
        );
        if (count >= MAX_AMIGOS) {
            return res.status(400).json({ error: 'Alcanzaste el límite de amigos' });
        }

        const result = await db.query(
            `INSERT INTO amistades (usuario1_id, usuario2_id, estado) VALUES (?, ?, 'pendiente') RETURNING id`,
            [req.user.id, receptorId]
        );

        // Notificamos al receptor para que le aparezca en su bandeja
        // de notificaciones (menú lateral derecho > Notificaciones).
        try {
            await db.run(
                `INSERT INTO notificaciones (usuario_id, tipo, mensaje, enlace) VALUES (?, 'amistad', ?, NULL) RETURNING id`,
                [receptorId, `${req.user.username} te envió una solicitud de amistad`]
            );
        } catch (notifError) {
            console.error('Error al crear notificación de solicitud de amistad:', notifError);
        }

        res.status(201).json({ message: 'Solicitud enviada', id: result.rows[0].id });
    } catch (error) {
        console.error('Error en POST /api/amigos/solicitudes:', error);
        res.status(500).json({ error: 'Error al enviar la solicitud' });
    }
});

// 4. Aceptar solicitud
router.post('/amigos/solicitudes/:id/aceptar', verificarToken, async (req, res) => {
    const { id } = req.params;
    const db = await getDb();
    try {
        const solicitud = (await db.query(`SELECT * FROM amistades WHERE id = $1 AND estado = 'pendiente'`, [id])).rows[0];
        if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });
        if (solicitud.usuario2_id !== req.user.id) {
            return res.status(403).json({ error: 'No podés aceptar esta solicitud' });
        }

        const { count } = await db.get(
            `SELECT COUNT(*) AS count FROM amistades WHERE estado = 'aceptada' AND (usuario1_id = ? OR usuario2_id = ?)`,
            [req.user.id, req.user.id]
        );
        if (count >= MAX_AMIGOS) {
            return res.status(400).json({ error: 'Alcanzaste el límite de amigos' });
        }

        await db.query(`UPDATE amistades SET estado = 'aceptada' WHERE id = $1`, [id]);
        res.json({ message: 'Solicitud aceptada' });
    } catch (error) {
        console.error('Error en POST /api/amigos/solicitudes/:id/aceptar:', error);
        res.status(500).json({ error: 'Error al aceptar la solicitud' });
    }
});

// 5. Rechazar solicitud (o cancelar una que enviaste)
router.post('/amigos/solicitudes/:id/rechazar', verificarToken, async (req, res) => {
    const { id } = req.params;
    const db = await getDb();
    try {
        const solicitud = (await db.query(`SELECT * FROM amistades WHERE id = $1 AND estado = 'pendiente'`, [id])).rows[0];
        if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });
        if (solicitud.usuario1_id !== req.user.id && solicitud.usuario2_id !== req.user.id) {
            return res.status(403).json({ error: 'No podés modificar esta solicitud' });
        }

        await db.query(`DELETE FROM amistades WHERE id = $1`, [id]);
        res.json({ message: 'Solicitud eliminada' });
    } catch (error) {
        console.error('Error en POST /api/amigos/solicitudes/:id/rechazar:', error);
        res.status(500).json({ error: 'Error al rechazar la solicitud' });
    }
});

// 6. Eliminar un amigo ya aceptado (:id = id del amigo, no de la fila de amistades)
router.delete('/amigos/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    const db = await getDb();
    try {
        const result = await db.run(
            `DELETE FROM amistades WHERE estado = 'aceptada' AND ((usuario1_id = ? AND usuario2_id = ?) OR (usuario1_id = ? AND usuario2_id = ?))`,
            [req.user.id, id, id, req.user.id]
        );
        if (result.changes === 0) return res.status(404).json({ error: 'Amistad no encontrada' });
        res.json({ message: 'Amigo eliminado' });
    } catch (error) {
        console.error('Error en DELETE /api/amigos/:id:', error);
        res.status(500).json({ error: 'Error al eliminar amigo' });
    }
});

module.exports = router;
