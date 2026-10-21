const express = require('express');
const { getDb } = require('../database/db');
const { verificarToken } = require('../middlewares/auth');

const router = express.Router();

// 1. Logros desbloqueados por el usuario logueado
router.get('/logros', verificarToken, async (req, res) => {
    const db = await getDb();
    try {
        const rows = await db.all(
            `SELECT logro_id, fecha FROM logros_usuario WHERE usuario_id = ? ORDER BY fecha DESC`,
            [req.user.id]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error en GET /api/logros:', error);
        res.status(500).json({ error: 'Error al obtener los logros' });
    }
});

// 2. Desbloquear un logro (idempotente: si ya lo tenía, no hace nada)
// El id tiene que existir en la tabla `logros` (FK); la lógica de qué
// logro corresponde a qué condición vive en ACHIEVEMENTS (app2.js).
router.post('/logros', verificarToken, async (req, res) => {
    const { logro_id } = req.body;
    if (!logro_id || typeof logro_id !== 'string' || logro_id.length > 64) {
        return res.status(400).json({ error: 'Falta indicar un logro_id válido' });
    }

    const db = await getDb();
    try {
        const existente = await db.get(
            `SELECT id FROM logros_usuario WHERE usuario_id = ? AND logro_id = ?`,
            [req.user.id, logro_id]
        );
        if (existente) {
            return res.status(200).json({ message: 'Logro ya estaba desbloqueado', logro_id });
        }

        await db.run(
            `INSERT INTO logros_usuario (usuario_id, logro_id) VALUES (?, ?)`,
            [req.user.id, logro_id]
        );
        res.status(201).json({ message: 'Logro desbloqueado', logro_id });
    } catch (error) {
        // 23503 = FK: el id no está en el catálogo `logros`
        // (database/logros_catalogo.js).
        if (error.code === '23503') {
            return res.status(400).json({ error: 'Logro desconocido' });
        }
        console.error('Error en POST /api/logros:', error);
        res.status(500).json({ error: 'Error al guardar el logro' });
    }
});

module.exports = router;
