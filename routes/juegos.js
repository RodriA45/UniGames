const express = require('express');
const { getDb } = require('../database/db');
const { verificarToken } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const { partidaSchema } = require('../schemas');

const router = express.Router();

// 3. Obtener tabla de puntuaciones (Leaderboard)
router.get('/leaderboard', async (req, res) => {
    const { juego_id } = req.query;
    const db = await getDb();

    try {
        let sql = `
            SELECT
                u.nombre_usuario AS jugador,
                j.id             AS juego_id,
                j.nombre         AS juego,
                MAX(p.puntos)    AS puntos
            FROM partidas p
            JOIN usuarios u ON p.usuario_id = u.id
            JOIN juegos j   ON p.juego_id   = j.id
        `;
        const params = [];

        if (juego_id) {
            sql += ` WHERE p.juego_id = ?`;
            params.push(juego_id);
        }

        sql += `
            GROUP BY p.usuario_id, p.juego_id
            ORDER BY puntos DESC
            LIMIT 10
        `;

        const rows = (await db.query(sql, params)).rows;
        res.json(rows);
    } catch (error) {
        console.error('Error en /api/leaderboard:', error);
        res.status(500).json({ error: 'Error al obtener puntuaciones' });
    }
});

// 3b. Leaderboard global: top 5 por juego, un registro por usuario (el MAX absoluto)
router.get('/leaderboard/global', async (req, res) => {
    const db = await getDb();
    try {
        const sql = `
            WITH best AS (
                SELECT
                    p.usuario_id,
                    p.juego_id,
                    MAX(p.puntos) AS puntos
                FROM partidas p
                GROUP BY p.usuario_id, p.juego_id
            )
            SELECT
                u.nombre_usuario AS jugador,
                j.id             AS juego_id,
                j.nombre         AS juego,
                b.puntos
            FROM best b
            JOIN usuarios u ON b.usuario_id = u.id
            JOIN juegos j   ON b.juego_id   = j.id
            ORDER BY j.id ASC, b.puntos DESC
        `;

        const rows = (await db.query(sql, [])).rows;

        const byGame = {};
        for (const row of rows) {
            if (!byGame[row.juego_id]) byGame[row.juego_id] = { juego: row.juego, entries: [] };
            if (byGame[row.juego_id].entries.length < 5) {
                byGame[row.juego_id].entries.push({ jugador: row.jugador, puntos: row.puntos });
            }
        }
        res.json(byGame);
    } catch (error) {
        console.error('Error en /api/leaderboard/global:', error);
        res.status(500).json({ error: 'Error al obtener puntuaciones globales' });
    }
});

// Si el nuevo puntaje supera el mejor puntaje que tenía cualquier OTRO
// usuario en ese juego, le mandamos una notificación a ese usuario avisando
// que le rompieron el récord. No tira error si algo falla: es un "extra",
// no debe hacer fallar el guardado de la partida en sí.
async function notificarSiSuperaRecordAjeno(db, usuario_id, juego_id, puntos, nombreJugador) {
    try {
        const anteriorRecord = await db.get(
            `SELECT usuario_id, MAX(puntos) AS puntos
             FROM partidas
             WHERE juego_id = ? AND usuario_id != ?
             GROUP BY usuario_id
             ORDER BY puntos DESC
             LIMIT 1`,
            [juego_id, usuario_id]
        );

        if (!anteriorRecord || puntos <= anteriorRecord.puntos) return;

        const juego = (await db.query(`SELECT nombre FROM juegos WHERE id = $1`, [juego_id])).rows[0];
        const nombreJuego = juego ? juego.nombre : 'un juego';

        await db.run(
            `INSERT INTO notificaciones (usuario_id, tipo, mensaje, enlace) VALUES () RETURNING id`,
            [anteriorRecord.usuario_id, `${nombreJugador} superó tu récord en ${nombreJuego} con ${puntos} puntos`]
        );
    } catch (notifError) {
        console.error('Error al notificar récord superado:', notifError);
    }
}

// 4. Guardar partida — PROTEGIDA CON JWT
router.post('/partidas', verificarToken, validate(partidaSchema), async (req, res) => {
    const usuario_id = req.user.id; 
    const { juego_id, tematica_id, puntos } = req.body;
    const db = await getDb();

    try {
        const checkSql = `SELECT id, puntos FROM partidas WHERE usuario_id = ? AND juego_id = ? ORDER BY puntos DESC LIMIT 1`;
        const existing = (await db.query(checkSql, [usuario_id, juego_id])).rows[0];

        if (existing && existing.puntos >= puntos) {
            return res.status(200).json({ message: 'Puntaje no supera el record', record: existing.puntos, nuevo: puntos });
        }

        if (existing) {
            await db.run(
                `UPDATE partidas SET puntos = ?, tematica_id = ?, fecha = CURRENT_TIMESTAMP WHERE id = ?`,
                [puntos, tematica_id || null, existing.id]
            );
            await notificarSiSuperaRecordAjeno(db, usuario_id, juego_id, puntos, req.user.username);
            return res.status(200).json({ message: 'Nuevo record guardado', id: existing.id, puntos });
        } else {
            const result = await db.run(
                `INSERT INTO partidas (usuario_id, juego_id, tematica_id, puntos) VALUES () RETURNING id`,
                [usuario_id, juego_id, tematica_id || null, puntos]
            );
            await notificarSiSuperaRecordAjeno(db, usuario_id, juego_id, puntos, req.user.username);
            return res.status(201).json({ message: 'Partida guardada', id: result.rows[0].id });
        }
    } catch (error) {
        console.error('Error en /api/partidas:', error);
        res.status(500).json({ error: 'Error al guardar partida' });
    }
});

// 5. Obtener palabra aleatoria para Ahorcado
router.get('/ahorcado/palabra', async (req, res) => {
    const tematica = req.query.tematica;
    const db = await getDb();
    try {
        let sql = `SELECT palabra FROM palabras_ahorcado`;
        let params = [];

        if (tematica === 'normal') {
            sql += ` WHERE tematica_id IS NULL`;
        } else if (tematica !== undefined && /^\d+$/.test(tematica)) {
            sql += ` WHERE tematica_id = ?`;
            params.push(Number(tematica));
        }

        sql += ` ORDER BY RANDOM() LIMIT 1`;

        const row = (await db.query(sql, params)).rows[0];
        if (row) {
            res.json({ palabra: row.palabra });
        } else {
            res.status(404).json({ error: 'No hay palabras disponibles' });
        }
    } catch (error) {
        console.error('Error en /api/ahorcado/palabra:', error);
        res.status(500).json({ error: 'Error al obtener palabra' });
    }
});

// 5.b Obtener palabra aleatoria para "Adivina la Palabra" (estilo Wordle)
router.get('/wordle/palabra', async (req, res) => {
    const tematica = req.query.tematica;
    const db = await getDb();

    if (!tematica || !/^\d+$/.test(tematica)) {
        return res.status(400).json({ error: 'Falta indicar una temática válida' });
    }

    try {
        const sql = `SELECT palabra FROM palabras_wordle WHERE tematica_id = ? ORDER BY RANDOM() LIMIT 1`;
        const row = (await db.query(sql, [Number(tematica)])).rows[0];
        if (row) {
            res.json({ palabra: row.palabra });
        } else {
            res.status(404).json({ error: 'No hay palabras disponibles para esa temática' });
        }
    } catch (error) {
        console.error('Error en /api/wordle/palabra:', error);
        res.status(500).json({ error: 'Error al obtener palabra' });
    }
});

// 6. Obtener preguntas aleatorias (opcionalmente por temática)
router.get('/preguntas', async (req, res) => {
    const tematica_id = req.query.tematica_id;
    const db = await getDb();
    try {
        let sql = `SELECT * FROM preguntas`;
        let params = [];
        
        if (tematica_id) {
            sql += ` WHERE tematica_id = ?`;
            params.push(tematica_id);
        }
        sql += ` ORDER BY RANDOM() LIMIT 10`;

        const rows = (await db.query(sql, params)).rows;
        res.json(rows);
    } catch (error) {
        console.error('Error en /api/preguntas:', error);
        res.status(500).json({ error: 'Error al obtener preguntas' });
    }
});

router.get('/sopa/palabras', async (req, res) => {
    const tematica = req.query.tematica;
    // Igual tope que el resto de los endpoints de este archivo: nunca
    // se devuelven de más aunque alguien pida un número gigante.
    const cantidad = Math.min(Math.max(Number(req.query.cantidad) || 8, 1), 20);
    const maxLargo = Number(req.query.max_largo) || null;
    const db = await getDb();

    try {
        let sql = `SELECT palabra FROM palabras_ahorcado`;
        const conditions = [];
        const params = [];

        // Mismo criterio de "tematica" que /ahorcado/palabra: 'normal'
        // son las palabras sin temática asignada, un número es el id.
        if (tematica === 'normal') {
            conditions.push(`tematica_id IS NULL`);
        } else if (tematica !== undefined && /^\d+$/.test(tematica)) {
            conditions.push(`tematica_id = ?`);
            params.push(Number(tematica));
        }

        if (maxLargo) {
            conditions.push(`LENGTH(palabra) <= ?`);
            params.push(maxLargo);
        }

        if (conditions.length) sql += ` WHERE ` + conditions.join(' AND ');

        sql += ` ORDER BY RANDOM() LIMIT ?`;
        params.push(cantidad);

        const rows = (await db.query(sql, params)).rows;
        res.json(rows.map(r => r.palabra));
    } catch (error) {
        console.error('Error en /api/sopa/palabras:', error);
        res.status(500).json({ error: 'Error al obtener palabras' });
    }
});

router.get('/adivina/items', async (req, res) => {
    const tematica = req.query.tematica;

    if (!tematica || !/^\d+$/.test(tematica)) {
        return res.status(400).json({ error: 'Falta indicar una temática válida' });
    }

    const db = await getDb();
    try {
        // Sin LIMIT chico a propósito: el frontend juega TODOS los items de
        // la temática en una ronda (los mezcla con shuffle()), no un
        // subconjunto random como sí hace Preguntados. El LIMIT 50 es solo
        // un techo de seguridad, no un recorte real de contenido.
        const sql = `
            SELECT respuesta, aliases, imagen, pista_1, pista_2, pista_3, pista_4
            FROM adivina_items
            WHERE tematica_id = ?
            LIMIT 50
        `;
        const rows = (await db.query(sql, [Number(tematica)])).rows;

        // El frontend espera el mismo shape que tenía ADIVINA_DATA:
        // pistas como array de 4 y aliases como array (acá vive como JSON
        // en la columna, se parsea antes de mandarlo).
        const items = rows.map(r => ({
            respuesta: r.respuesta,
            aliases: r.aliases ? JSON.parse(r.aliases) : [],
            imagen: r.imagen,
            pistas: [r.pista_1, r.pista_2, r.pista_3, r.pista_4],
        }));

        res.json(items);
    } catch (error) {
        console.error('Error en /api/adivina/items:', error);
        res.status(500).json({ error: 'Error al obtener items' });
    }
});


module.exports = router;
