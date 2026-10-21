// ══════════════════════════════════════
//   routes/reportes.js — Reportes del panel admin
// ══════════════════════════════════════
// Devuelve los datos de cada reporte en JSON. La exportación a CSV y PDF la
// hace el frontend (app2.js → ReportesAdmin) con estos mismos datos, así lo
// que se ve en pantalla y lo que se descarga es exactamente igual.
// Todas las rutas son solo para administradores.
const express = require('express');
const { getDb } = require('../database/db');
const { verificarAdmin } = require('../middlewares/auth');

const router = express.Router();
router.use(verificarAdmin);

// 1. Usuarios: datos de la cuenta + resumen de su actividad.
router.get('/usuarios', async (req, res) => {
    try {
        const db = await getDb();
        const filas = await db.all(`
            SELECT u.id,
                   u.nombre_usuario,
                   u.email,
                   u.rol,
                   CASE WHEN s.tipo = 'permanente' THEN 'baneado (permanente)'
                        WHEN s.tipo = 'temporal' THEN 'baneado (temporal)'
                        ELSE 'activo' END AS estado,
                   u.fecha_registro,
                   u.ultima_conexion,
                   (SELECT COUNT(*)::int FROM partidas p WHERE p.usuario_id = u.id) AS juegos_jugados,
                   (SELECT COUNT(*)::int FROM logros_usuario l WHERE l.usuario_id = u.id) AS logros,
                   (SELECT COUNT(*)::int FROM amistades a
                     WHERE a.estado = 'aceptada' AND (a.usuario1_id = u.id OR a.usuario2_id = u.id)) AS amigos
            FROM usuarios u
            LEFT JOIN v_sanciones_activas s ON s.usuario_id = u.id
            ORDER BY u.fecha_registro DESC, u.id DESC
        `);
        res.json(filas);
    } catch (error) {
        console.error('Error en GET /api/admin/reportes/usuarios:', error);
        res.status(500).json({ error: 'Error al generar el reporte de usuarios' });
    }
});

// 2. Ranking: los 10 mejores de cada juego (o de uno solo con ?juego_id=).
// partidas guarda el récord de cada usuario por juego, así que cada fila
// ya es el mejor puntaje de esa persona en ese juego.
router.get('/ranking', async (req, res) => {
    const { juego_id } = req.query;
    if (juego_id !== undefined && !/^\d+$/.test(String(juego_id))) {
        return res.status(400).json({ error: 'juego_id inválido' });
    }
    try {
        const db = await getDb();
        const params = [];
        let filtro = '';
        if (juego_id !== undefined) {
            filtro = 'WHERE p.juego_id = ?';
            params.push(Number(juego_id));
        }
        const filas = await db.all(`
            SELECT posicion, juego, jugador, puntos, fecha
            FROM (
                SELECT RANK() OVER (PARTITION BY p.juego_id ORDER BY p.puntos DESC)::int AS posicion,
                       j.id AS juego_id,
                       j.nombre AS juego,
                       u.nombre_usuario AS jugador,
                       p.puntos,
                       p.fecha
                FROM partidas p
                JOIN usuarios u ON u.id = p.usuario_id
                JOIN juegos j ON j.id = p.juego_id
                ${filtro}
            ) r
            WHERE posicion <= 10
            ORDER BY juego_id, posicion
        `, params);
        res.json(filas);
    } catch (error) {
        console.error('Error en GET /api/admin/reportes/ranking:', error);
        res.status(500).json({ error: 'Error al generar el reporte de ranking' });
    }
});

// 3. Actividad por juego: cuántos jugaron, puntaje promedio y máximo, y duelos.
router.get('/actividad', async (req, res) => {
    try {
        const db = await getDb();
        const filas = await db.all(`
            SELECT j.nombre AS juego,
                   COUNT(p.id)::int AS jugadores,
                   COALESCE(ROUND(AVG(p.puntos)), 0)::int AS promedio,
                   COALESCE(MAX(p.puntos), 0)::int AS maximo,
                   (SELECT COUNT(*)::int FROM duelos d WHERE d.juego_id = j.id) AS duelos,
                   (SELECT COUNT(*)::int FROM duelos d WHERE d.juego_id = j.id AND d.estado = 'finalizado') AS duelos_finalizados
            FROM juegos j
            LEFT JOIN partidas p ON p.juego_id = j.id
            GROUP BY j.id, j.nombre
            ORDER BY j.id
        `);
        res.json(filas);
    } catch (error) {
        console.error('Error en GET /api/admin/reportes/actividad:', error);
        res.status(500).json({ error: 'Error al generar el reporte de actividad' });
    }
});

module.exports = router;
