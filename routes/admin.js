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
        const rows = await db.all(`SELECT clave, valor FROM configuracion_global`);
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
        const row = await db.get("SELECT * FROM avisos WHERE activo = 1 ORDER BY id DESC LIMIT 1");
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
        const usuarios = await db.all(`SELECT id, nombre_usuario, email, rol, fecha_registro, estado FROM usuarios ORDER BY id DESC`);
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
        await db.run('UPDATE usuarios SET estado = ? WHERE id = ?', [estado, id]);
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
        await db.run(`UPDATE usuarios SET rol = ? WHERE id = ?`, [rol, req.params.id]);
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
        const totalUsuarios = await db.get('SELECT COUNT(*) as count FROM usuarios');
        stats.totalUsuarios = totalUsuarios.count;
        
        const activos = await db.get('SELECT COUNT(*) as count FROM usuarios WHERE estado="activo"');
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
        const rows = await db.all("SELECT * FROM avisos ORDER BY id DESC");
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
            await db.run("UPDATE avisos SET activo = 0");
        }
        
        const result = await db.run(
            "INSERT INTO avisos (texto, icono, color, activo) VALUES (?, ?, ?, ?)", 
            [texto, icono || '📢', color || '#3b82f6', isActivo]
        );
        res.json({ id: result.lastID, success: true });
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
            await db.run("UPDATE avisos SET activo = 0");
            await db.run("UPDATE avisos SET activo = 1 WHERE id = ?", [id]);
        } else {
            await db.run("UPDATE avisos SET activo = 0 WHERE id = ?", [id]);
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
        await db.run("DELETE FROM avisos WHERE id = ?", [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
