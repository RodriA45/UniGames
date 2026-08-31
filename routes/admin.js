const express = require('express');
const { getDb } = require('../database/db');
const { verificarAdmin, JWT_SECRET } = require('../middlewares/auth');
const jwt = require('jsonwebtoken');

const router = express.Router();

// ==========================================
// ENDPOINTS PÚBLICOS / CONFIG (NO REQUIEREN ADMIN PARA LEER)
// ==========================================

// Obtener Configuración Global
router.get('/config', async (req, res) => {
    const db = await getDb();
    try {
        const rows = (await db.query(`SELECT clave, valor FROM configuracion_global`)).rows;
        const config = {};
        rows.forEach(row => {
            config[row.clave] = row.valor;
        });
        res.json(config);
    } catch (error) {
        console.error('Error al obtener config:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// Obtener el aviso activo (Publico)
router.get('/avisos/activo', async (req, res) => {
    const db = await getDb();
    try {
        const row = (await db.query("SELECT * FROM avisos WHERE activo = 1 ORDER BY id DESC LIMIT 1")).rows[0];
        res.json(row || null);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// === RUTA PARA AUTO-LOGIN ADMIN DESDE EL SCRIPT ===
router.get('/dev-login', (req, res) => {
    const host = req.hostname || req.get('host') || '';
    const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
    const secret = req.query.secret;
    const DEV_SECRET = process.env.DEV_SECRET || 'unigames_super_secret';

    if (!isLocal && secret !== DEV_SECRET) {
        return res.status(403).send('Acceso denegado. Se requiere clave de desarrollo.');
    }

    const token = jwt.sign({ id: 9999, username: 'DevAdmin', rol: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
    const userStr = encodeURIComponent(JSON.stringify({ id: 9999, username: 'DevAdmin', rol: 'admin' }));
    
    res.redirect(`/?dev_token=${token}&dev_user=${userStr}&open_admin=true`);
});

// ==========================================
// RUTAS PROTEGIDAS PARA ADMIN
// ==========================================

router.use(verificarAdmin);

// Actualizar Configuración Global
router.put('/config', async (req, res) => {
    const configData = req.body; 
    const db = await getDb();
    try {
        for (const [clave, valor] of Object.entries(configData)) {
            await db.run(
                `INSERT INTO configuracion_global (clave, valor) VALUES (?, ?) 
                 ON CONFLICT(clave) DO UPDATE SET valor=excluded.valor`,
                [clave, valor]
            );
        }
        res.json({ message: 'Configuración actualizada con éxito' });
    } catch (error) {
        console.error('Error al actualizar config:', error);
        res.status(500).json({ error: 'Error al actualizar configuración' });
    }
});

// Obtener todos los usuarios
router.get('/usuarios', async (req, res) => {
    const db = await getDb();
    try {
        const usuarios = (await db.query(`SELECT id, nombre_usuario, email, rol, fecha_registro, estado FROM usuarios ORDER BY id DESC`)).rows;
        res.json(usuarios);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
});

// Actualizar estado usuario
router.put('/usuarios/:id/estado', async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;
    const db = await getDb();
    if (estado !== 'activo' && estado !== 'suspendido') {
        return res.status(400).json({ error: 'Estado inválido' });
    }
    try {
        await db.query(`UPDATE usuarios SET estado = $1 WHERE id = $2`, [estado, id]);
        res.json({ message: 'Estado actualizado' });
    } catch(err) {
        res.status(500).json({ error: 'Error al actualizar estado' });
    }
});

// Cambiar rol de un usuario
router.put('/usuarios/:id/rol', async (req, res) => {
    const { rol } = req.body;
    const db = await getDb();
    if (rol !== 'admin' && rol !== 'user') return res.status(400).json({ error: 'Rol inválido' });
    
    try {
        await db.query(`UPDATE usuarios SET rol = $1 WHERE id = $2`, [rol, req.params.id]);
        res.json({ message: `Rol actualizado a ${rol}` });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar rol' });
    }
});

// Dashboard stats
router.get('/dashboard', async (req, res) => {
    const db = await getDb();
    try {
        const stats = {};
        const totalUsuarios = (await db.query('SELECT COUNT(*) as count FROM usuarios')).rows[0];
        stats.totalUsuarios = totalUsuarios.count;
        
        const activos = (await db.query('SELECT COUNT(*) as count FROM usuarios WHERE estado=$1', ['activo'])).rows[0];
        stats.activos = activos.count;
        
        const partidasPorJuego = await db.all(`
            SELECT j.nombre, COUNT(p.id) as cantidad 
            FROM juegos j 
            LEFT JOIN partidas p ON j.id = p.juego_id 
            GROUP BY j.id
        `);
        stats.partidasPorJuego = partidasPorJuego;
        
        const top5 = await db.all(`
            SELECT u.nombre_usuario as jugador, SUM(p.puntos) as puntosTotales 
            FROM partidas p 
            JOIN usuarios u ON p.usuario_id = u.id 
            GROUP BY u.id 
            ORDER BY puntosTotales DESC 
            LIMIT 5
        `);
        stats.top5 = top5;
        
        res.json(stats);
    } catch(err) {
        console.error(err);
        res.status(500).json({ error: 'Error cargando dashboard' });
    }
});

// Obtener todos los avisos
router.get('/avisos', async (req, res) => {
    const db = await getDb();
    try {
        const rows = (await db.query("SELECT * FROM avisos ORDER BY id DESC")).rows;
        res.json(rows || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Crear un nuevo aviso
router.post('/avisos', async (req, res) => {
    const { texto, icono, color, activo } = req.body;
    const db = await getDb();
    if (!texto) return res.status(400).json({ error: 'Texto es requerido' });
    
    const isActivo = activo ? 1 : 0;
    
    try {
        if (isActivo) {
            await db.query("UPDATE avisos SET activo = 0");
        }
        
        const result = await db.run(
            `INSERT INTO avisos (texto, icono, color, activo) VALUES ($1, $2, $3, $4) RETURNING id`, 
            [texto, icono || '📢', color || '#3b82f6', isActivo]
        );

        // Le mandamos una notificación a cada usuario registrado para que
        // le aparezca en su bandeja (menú lateral derecho > Notificaciones),
        // además del banner global que ya se muestra arriba de la página.
        try {
            const usuarios = (await db.query("SELECT id FROM usuarios")).rows;
            const mensaje = `${icono || '📢'} ${texto}`;
            for (const u of usuarios) {
                await db.run(
                    `INSERT INTO notificaciones (usuario_id, tipo, mensaje, enlace) VALUES ($1, 'aviso', $2, NULL)`,
                    [u.id, mensaje]
                );
            }
        } catch (notifError) {
            console.error('Error al notificar aviso nuevo a los usuarios:', notifError);
        }

        res.json({ id: result.rows[0].id, success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Activar/Desactivar aviso
router.put('/avisos/:id/toggle', async (req, res) => {
    const id = req.params.id;
    const { activo } = req.body;
    const db = await getDb();
    const isActivo = activo ? 1 : 0;
    
    try {
        if (isActivo) {
            await db.query("UPDATE avisos SET activo = 0");
            await db.query(`UPDATE avisos SET activo = 1 WHERE id = $1`, [id]);
        } else {
            await db.query(`UPDATE avisos SET activo = 0 WHERE id = $1`, [id]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Eliminar aviso
router.delete('/avisos/:id', async (req, res) => {
    const id = req.params.id;
    const db = await getDb();
    try {
        await db.query(`DELETE FROM avisos WHERE id = $1`, [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// CONTENIDO DE JUEGOS (Ahorcado / Wordle / Preguntados / Adivina)
// ==========================================

// Listado de temáticas (para poblar selects del panel)
router.get('/tematicas', async (req, res) => {
    const db = await getDb();
    try {
        const rows = (await db.query('SELECT * FROM tematicas ORDER BY id ASC')).rows;
        res.json(rows || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Normaliza tematica_id que llega del panel: '', null, undefined, 'normal' -> NULL
function normalizarTematicaId(valor) {
    if (valor === undefined || valor === null || valor === '' || valor === 'normal') return null;
    const n = Number(valor);
    return Number.isInteger(n) ? n : undefined; // undefined = valor inválido
}

// --- Ahorcado ---

router.get('/ahorcado', async (req, res) => {
    const { tematica_id } = req.query;
    const db = await getDb();
    try {
        let sql = 'SELECT * FROM palabras_ahorcado';
        const params = [];
        if (tematica_id !== undefined) {
            const t = normalizarTematicaId(tematica_id);
            if (t === undefined) return res.status(400).json({ error: 'tematica_id inválido' });
            sql += t === null ? ' WHERE tematica_id IS NULL' : ` WHERE tematica_id = $1`;
            if (t !== null) params.push(t);
        }
        sql += ' ORDER BY id DESC';
        const rows = (await db.query(sql, params)).rows;
        res.json(rows || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/ahorcado', async (req, res) => {
    const { palabra, tematica_id } = req.body;
    if (!palabra || !palabra.trim()) return res.status(400).json({ error: 'La palabra es requerida' });
    const t = normalizarTematicaId(tematica_id);
    if (t === undefined) return res.status(400).json({ error: 'tematica_id inválido' });

    const db = await getDb();
    try {
        const result = await db.run(
            `INSERT INTO palabras_ahorcado (palabra, tematica_id) VALUES ($1, $2) RETURNING id`,
            [palabra.trim().toLowerCase(), t]
        );
        res.json({ id: result.rows[0].id, success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/ahorcado/:id', async (req, res) => {
    const { palabra, tematica_id } = req.body;
    if (!palabra || !palabra.trim()) return res.status(400).json({ error: 'La palabra es requerida' });
    const t = normalizarTematicaId(tematica_id);
    if (t === undefined) return res.status(400).json({ error: 'tematica_id inválido' });

    const db = await getDb();
    try {
        await db.run(
            `UPDATE palabras_ahorcado SET palabra = $1, tematica_id = $2 WHERE id = $3`,
            [palabra.trim().toLowerCase(), t, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/ahorcado/:id', async (req, res) => {
    const db = await getDb();
    try {
        await db.query(`DELETE FROM palabras_ahorcado WHERE id = $1`, [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Adivina la Palabra (Wordle) ---

router.get('/wordle', async (req, res) => {
    const { tematica_id } = req.query;
    const db = await getDb();
    try {
        let sql = 'SELECT * FROM palabras_wordle';
        const params = [];
        if (tematica_id !== undefined) {
            if (!/^\d+$/.test(tematica_id)) return res.status(400).json({ error: 'tematica_id inválido' });
            sql += ' WHERE tematica_id = ?';
            params.push(Number(tematica_id));
        }
        sql += ' ORDER BY id DESC';
        const rows = (await db.query(sql, params)).rows;
        res.json(rows || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/wordle', async (req, res) => {
    const { palabra, tematica_id } = req.body;
    if (!palabra || !palabra.trim()) return res.status(400).json({ error: 'La palabra es requerida' });
    if (!/^\d+$/.test(String(tematica_id))) return res.status(400).json({ error: 'tematica_id es requerido' });

    const db = await getDb();
    try {
        const result = await db.run(
            `INSERT INTO palabras_wordle (palabra, tematica_id) VALUES ($1, $2) RETURNING id`,
            [palabra.trim().toLowerCase(), Number(tematica_id)]
        );
        res.json({ id: result.rows[0].id, success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/wordle/:id', async (req, res) => {
    const { palabra, tematica_id } = req.body;
    if (!palabra || !palabra.trim()) return res.status(400).json({ error: 'La palabra es requerida' });
    if (!/^\d+$/.test(String(tematica_id))) return res.status(400).json({ error: 'tematica_id es requerido' });

    const db = await getDb();
    try {
        await db.run(
            `UPDATE palabras_wordle SET palabra = $1, tematica_id = $2 WHERE id = $3`,
            [palabra.trim().toLowerCase(), Number(tematica_id), req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/wordle/:id', async (req, res) => {
    const db = await getDb();
    try {
        await db.query(`DELETE FROM palabras_wordle WHERE id = $1`, [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Preguntados ---

const OPCIONES_VALIDAS = ['A', 'B', 'C', 'D'];

function validarPregunta(body) {
    const { tematica_id, pregunta, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta } = body;
    if (!/^\d+$/.test(String(tematica_id))) return 'tematica_id es requerido';
    if (!pregunta || !pregunta.trim()) return 'La pregunta es requerida';
    if (!opcion_a || !opcion_b || !opcion_c || !opcion_d) return 'Las 4 opciones son requeridas';
    if (!OPCIONES_VALIDAS.includes(String(respuesta_correcta).toUpperCase())) return 'respuesta_correcta debe ser A, B, C o D';
    return null;
}

router.get('/preguntas', async (req, res) => {
    const { tematica_id } = req.query;
    const db = await getDb();
    try {
        let sql = 'SELECT * FROM preguntas';
        const params = [];
        if (tematica_id !== undefined) {
            if (!/^\d+$/.test(tematica_id)) return res.status(400).json({ error: 'tematica_id inválido' });
            sql += ' WHERE tematica_id = ?';
            params.push(Number(tematica_id));
        }
        sql += ' ORDER BY id DESC';
        const rows = (await db.query(sql, params)).rows;
        res.json(rows || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/preguntas', async (req, res) => {
    const error = validarPregunta(req.body);
    if (error) return res.status(400).json({ error });
    const { tematica_id, pregunta, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta } = req.body;

    const db = await getDb();
    try {
        const result = await db.run(
            `INSERT INTO preguntas (tematica_id, pregunta, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [Number(tematica_id), pregunta.trim(), opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta.toUpperCase()]
        );
        res.json({ id: result.rows[0].id, success: true });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Ya existe esa pregunta para esta temática' });
        }
        res.status(500).json({ error: err.message });
    }
});

router.put('/preguntas/:id', async (req, res) => {
    const error = validarPregunta(req.body);
    if (error) return res.status(400).json({ error });
    const { tematica_id, pregunta, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta } = req.body;

    const db = await getDb();
    try {
        await db.run(
            `UPDATE preguntas SET tematica_id = ?, pregunta = ?, opcion_a = ?, opcion_b = ?, opcion_c = ?, opcion_d = ?, respuesta_correcta = ?
             WHERE id = ?`,
            [Number(tematica_id), pregunta.trim(), opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta.toUpperCase(), req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Ya existe esa pregunta para esta temática' });
        }
        res.status(500).json({ error: err.message });
    }
});

router.delete('/preguntas/:id', async (req, res) => {
    const db = await getDb();
    try {
        await db.query(`DELETE FROM preguntas WHERE id = $1`, [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Adivina la Cosa ---

function validarAdivina(body) {
    const { tematica_id, respuesta, pistas } = body;
    if (!/^\d+$/.test(String(tematica_id))) return 'tematica_id es requerido';
    if (!respuesta || !respuesta.trim()) return 'La respuesta es requerida';
    if (pistas !== undefined && !Array.isArray(pistas)) return 'pistas debe ser un array';
    return null;
}

router.get('/adivina', async (req, res) => {
    const { tematica_id } = req.query;
    const db = await getDb();
    try {
        let sql = 'SELECT * FROM adivina_items';
        const params = [];
        if (tematica_id !== undefined) {
            if (!/^\d+$/.test(tematica_id)) return res.status(400).json({ error: 'tematica_id inválido' });
            sql += ' WHERE tematica_id = ?';
            params.push(Number(tematica_id));
        }
        sql += ' ORDER BY id DESC';
        const rows = (await db.query(sql, params)).rows;
        // Igual que en /api/adivina/items: exponemos "pistas" como array y "aliases" parseado
        const items = rows.map(r => ({
            ...r,
            aliases: r.aliases ? JSON.parse(r.aliases) : [],
            pistas: [r.pista_1, r.pista_2, r.pista_3, r.pista_4],
        }));
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/adivina', async (req, res) => {
    const error = validarAdivina(req.body);
    if (error) return res.status(400).json({ error });
    const { tematica_id, respuesta, aliases, imagen, pistas } = req.body;
    const [p1, p2, p3, p4] = pistas || [];

    const db = await getDb();
    try {
        const result = await db.run(
            `INSERT INTO adivina_items (tematica_id, respuesta, aliases, imagen, pista_1, pista_2, pista_3, pista_4) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [Number(tematica_id), respuesta.trim(), JSON.stringify(aliases || []), imagen || null, p1 || null, p2 || null, p3 || null, p4 || null]
        );
        res.json({ id: result.rows[0].id, success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/adivina/:id', async (req, res) => {
    const error = validarAdivina(req.body);
    if (error) return res.status(400).json({ error });
    const { tematica_id, respuesta, aliases, imagen, pistas } = req.body;
    const [p1, p2, p3, p4] = pistas || [];

    const db = await getDb();
    try {
        await db.run(
            `UPDATE adivina_items SET tematica_id = ?, respuesta = ?, aliases = ?, imagen = ?, pista_1 = ?, pista_2 = ?, pista_3 = ?, pista_4 = ?
             WHERE id = ?`,
            [Number(tematica_id), respuesta.trim(), JSON.stringify(aliases || []), imagen || null, p1 || null, p2 || null, p3 || null, p4 || null, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/adivina/:id', async (req, res) => {
    const db = await getDb();
    try {
        await db.query(`DELETE FROM adivina_items WHERE id = $1`, [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
