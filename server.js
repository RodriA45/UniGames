require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_no_usar_en_prod';

// --- Rate limiting simple (en memoria) ---
const rateLimitStore = {};
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minuto
const RATE_LIMIT_MAX = 10;               // máximo 10 requests por ventana

function rateLimit(ip) {
    const now = Date.now();
    if (!rateLimitStore[ip] || now - rateLimitStore[ip].start > RATE_LIMIT_WINDOW_MS) {
        rateLimitStore[ip] = { start: now, count: 1 };
        return true;
    }
    rateLimitStore[ip].count++;
    return rateLimitStore[ip].count <= RATE_LIMIT_MAX;
}

// Limpiar entradas viejas cada 5 minutos
setInterval(() => {
    const now = Date.now();
    for (const ip in rateLimitStore) {
        if (now - rateLimitStore[ip].start > RATE_LIMIT_WINDOW_MS * 2) {
            delete rateLimitStore[ip];
        }
    }
}, 5 * 60 * 1000);

// --- Middleware rate limit para auth ---
function authRateLimit(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    if (!rateLimit(ip)) {
        return res.status(429).json({ error: 'Demasiadas peticiones. Esperá un momento e intentá de nuevo.' });
    }
    next();
}

// Middleware para verificar JWT
function verificarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido o expirado.' });
        req.user = user;
        next();
    });
}

// Configuración
app.use(cors());
app.use(express.json());

// Bloquear archivos .bak, .old, .orig (backups que no deben exponerse)
app.use((req, res, next) => {
    if (/\.(bak|old|orig)$/i.test(req.path)) {
        return res.status(404).json({ error: 'Not found' });
    }
    next();
});

// Sirviendo archivos estáticos con configuración de caché para desarrollo
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: function (res, path) {
        if (path.endsWith('.html')) {
            // Evitar caché de index.html para asegurar que los cambios se reflejen
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

let db;

// --- API Endpoints ---

// 1. Registro de usuario
app.post('/api/register', authRateLimit, async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    if (username.length < 3) {
        return res.status(400).json({ error: 'El nombre de usuario debe tener al menos 3 caracteres' });
    }

    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({ error: 'El email ingresado no es válido' });
    }

    try {
        const hash = await bcrypt.hash(password, 10);
        
        const sql = `INSERT INTO usuarios (nombre_usuario, email, password_hash) VALUES (?, ?, ?)`;
        const result = await db.run(sql, [username, email, hash]);
        
        // Generar JWT (un usuario nuevo siempre es 'user' por defecto)
        const token = jwt.sign({ id: result.lastID, username, rol: 'user' }, JWT_SECRET, { expiresIn: '7d' });
        
        res.status(201).json({ 
            message: 'Usuario registrado exitosamente', 
            token,
            user: { id: result.lastID, username, rol: 'user' } 
        });
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed: usuarios.nombre_usuario')) {
            return res.status(400).json({ error: 'El nombre de usuario ya existe' });
        }
        if (error.message.includes('UNIQUE constraint failed: usuarios.email')) {
            return res.status(400).json({ error: 'El email ya está registrado' });
        }
        console.error('Error en /api/register:', error);
        res.status(500).json({ error: 'Error al registrar usuario' });
    }
});

// 2. Inicio de sesión
app.post('/api/login', authRateLimit, async (req, res) => {
    const { identity, password } = req.body; // identity can be email or username

    if (!identity || !password) {
        return res.status(400).json({ error: 'Credenciales incompletas' });
    }

    try {
        const sql = `SELECT * FROM usuarios WHERE nombre_usuario = ? OR email = ?`;
        const row = await db.get(sql, [identity, identity]);
        
        if (!row) {
            return res.status(400).json({ error: 'Usuario no encontrado' });
        }
        if (row.estado === 'suspendido') {
            return res.status(403).json({ error: 'Tu cuenta ha sido suspendida' });
        }

        const match = await bcrypt.compare(password, row.password_hash);
        if (match) {
            // Generar JWT
            const token = jwt.sign({ id: row.id, username: row.nombre_usuario, rol: row.rol || 'user' }, JWT_SECRET, { expiresIn: '7d' });
            res.json({ 
                message: 'Inicio de sesión exitoso', 
                token,
                user: { id: row.id, username: row.nombre_usuario, rol: row.rol || 'user' } 
            });
        } else {
            res.status(400).json({ error: 'Contraseña incorrecta' });
        }
    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// 3. Obtener tabla de puntuaciones (Leaderboard)
app.get('/api/leaderboard', async (req, res) => {
    const { juego_id } = req.query;

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

        const rows = await db.all(sql, params);
        res.json(rows);
    } catch (error) {
        console.error('Error en /api/leaderboard:', error);
        res.status(500).json({ error: 'Error al obtener puntuaciones' });
    }
});

// 3b. Leaderboard global: top 5 por juego, un registro por usuario (el MAX absoluto)
app.get('/api/leaderboard/global', async (req, res) => {
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

        const rows = await db.all(sql, []);

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

// 4. Guardar partida — PROTEGIDA CON JWT
app.post('/api/partidas', verificarToken, async (req, res) => {
    // Usamos req.user.id que viene del token verificado en lugar de req.body.usuario_id
    const usuario_id = req.user.id; 
    const { juego_id, tematica_id, puntos } = req.body;

    if (!juego_id || puntos === undefined) {
        return res.status(400).json({ error: 'Faltan datos de la partida' });
    }

    try {
        const checkSql = `SELECT id, puntos FROM partidas WHERE usuario_id = ? AND juego_id = ? ORDER BY puntos DESC LIMIT 1`;
        const existing = await db.get(checkSql, [usuario_id, juego_id]);

        if (existing && existing.puntos >= puntos) {
            return res.status(200).json({ message: 'Puntaje no supera el record', record: existing.puntos, nuevo: puntos });
        }

        if (existing) {
            await db.run(
                `UPDATE partidas SET puntos = ?, tematica_id = ?, fecha = CURRENT_TIMESTAMP WHERE id = ?`,
                [puntos, tematica_id || null, existing.id]
            );
            return res.status(200).json({ message: 'Nuevo record guardado', id: existing.id, puntos });
        } else {
            const result = await db.run(
                `INSERT INTO partidas (usuario_id, juego_id, tematica_id, puntos) VALUES (?, ?, ?, ?)`,
                [usuario_id, juego_id, tematica_id || null, puntos]
            );
            return res.status(201).json({ message: 'Partida guardada', id: result.lastID });
        }
    } catch (error) {
        console.error('Error en /api/partidas:', error);
        res.status(500).json({ error: 'Error al guardar partida' });
    }
});

// 5. Obtener palabra aleatoria para Ahorcado
app.get('/api/ahorcado/palabra', async (req, res) => {
    const tematica = req.query.tematica;
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

        const row = await db.get(sql, params);
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
app.get('/api/wordle/palabra', async (req, res) => {
    const tematica = req.query.tematica;

    if (!tematica || !/^\d+$/.test(tematica)) {
        return res.status(400).json({ error: 'Falta indicar una temática válida' });
    }

    try {
        const sql = `SELECT palabra FROM palabras_wordle WHERE tematica_id = ? ORDER BY RANDOM() LIMIT 1`;
        const row = await db.get(sql, [Number(tematica)]);
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
app.get('/api/preguntas', async (req, res) => {
    const tematica_id = req.query.tematica_id;
    try {
        let sql = `SELECT * FROM preguntas`;
        let params = [];
        
        if (tematica_id) {
            sql += ` WHERE tematica_id = ?`;
            params.push(tematica_id);
        }
        sql += ` ORDER BY RANDOM() LIMIT 10`;

        const rows = await db.all(sql, params);
        res.json(rows);
    } catch (error) {
        console.error('Error en /api/preguntas:', error);
        res.status(500).json({ error: 'Error al obtener preguntas' });
    }
});



// Función para inicializar DB y Servidor
async function startServer() {
    try {
        db = await open({
            filename: path.join(__dirname, 'unigames.db'),
            driver: sqlite3.Database
        });
        console.log('Conectado a unigames.db exitosamente con soporte para Promesas.');
        await db.exec('PRAGMA foreign_keys = ON');

    // ==========================================
// ENDPOINTS DE ADMINISTRADOR (NUEVOS)
// ==========================================

// Middleware para verificar si es Admin
const verificarAdmin = (req, res, next) => {
    verificarToken(req, res, () => {
        if (req.user && req.user.rol === 'admin') {
            next();
        } else {
            return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de administrador.' });
        }
    });
};

// Obtener Configuración Global (Público, para que el frontend se adapte al cargar)
app.get('/api/config', async (req, res) => {
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

// Actualizar Configuración Global (Solo Admin)
app.put('/api/admin/config', verificarAdmin, async (req, res) => {
    const configData = req.body; 
    
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

// Obtener todos los usuarios (Solo Admin)
app.get('/api/admin/usuarios', verificarAdmin, async (req, res) => {
    try {
        const usuarios = await db.all(`SELECT id, nombre_usuario, email, rol, fecha_registro, estado FROM usuarios ORDER BY id DESC`);
        res.json(usuarios);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
});

// Cambiar rol de un usuario (Solo Admin)

// Actualizar estado usuario
app.put('/api/admin/usuarios/:id/estado', verificarAdmin, async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;
    if (estado !== 'activo' && estado !== 'suspendido') {
        return res.status(400).json({ error: 'Estado invǭlido' });
    }
    try {
        await db.run('UPDATE usuarios SET estado = ? WHERE id = ?', [estado, id]);
        res.json({ message: 'Estado actualizado' });
    } catch(err) {
        res.status(500).json({ error: 'Error al actualizar estado' });
    }
});

// Dashboard stats
app.get('/api/admin/dashboard', verificarAdmin, async (req, res) => {
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

app.put('/api/admin/usuarios/:id/rol', verificarAdmin, async (req, res) => {
    const { rol } = req.body;
    if (rol !== 'admin' && rol !== 'user') return res.status(400).json({ error: 'Rol inválido' });
    
    try {
        await db.run(`UPDATE usuarios SET rol = ? WHERE id = ?`, [rol, req.params.id]);
        res.json({ message: `Rol actualizado a ${rol}` });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar rol' });
    }
});

// === RUTA PARA AUTO-LOGIN ADMIN DESDE EL SCRIPT ===
app.get('/api/admin/dev-login', (req, res) => {
    // SEGURIDAD: Esto SOLO debe funcionar en local (localhost), nunca en producción (ej. Render)
    const host = req.hostname || req.get('host') || '';
    if (!host.includes('localhost') && !host.includes('127.0.0.1')) {
        return res.status(403).send('Acceso denegado. Este atajo de desarrollador solo funciona en el entorno local.');
    }

    // Modo Desarrollador: Iniciamos sesión mágicamente sin consultar la base de datos
    const token = jwt.sign({ id: 9999, username: 'DevAdmin', rol: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
    const userStr = encodeURIComponent(JSON.stringify({ id: 9999, username: 'DevAdmin', rol: 'admin' }));
    
    res.redirect(`/?dev_token=${token}&dev_user=${userStr}&open_admin=true`);
});

// Fallback para SPA (Single Page Application) en caso de recargar
    
// ==========================================
// AVISOS (ANUNCIOS MULTIPLES)
// ==========================================

// Obtener el aviso activo (Publico)
app.get('/api/avisos/activo', async (req, res) => {
    try {
        const row = await db.get("SELECT * FROM avisos WHERE activo = 1 ORDER BY id DESC LIMIT 1");
        res.json(row || null);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Obtener todos los avisos (Admin)
app.get('/api/admin/avisos', verificarAdmin, async (req, res) => {
    try {
        const rows = await db.all("SELECT * FROM avisos ORDER BY id DESC");
        res.json(rows || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Crear un nuevo aviso (Admin)
app.post('/api/admin/avisos', verificarAdmin, async (req, res) => {
    const { texto, icono, color, activo } = req.body;
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
        // en 'sqlite' (promise) result.lastID nos da el ID insertado
        res.json({ id: result.lastID, success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Activar/Desactivar aviso (Admin)
app.put('/api/admin/avisos/:id/toggle', verificarAdmin, async (req, res) => {
    const id = req.params.id;
    const { activo } = req.body;
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

// Eliminar aviso (Admin)
app.delete('/api/admin/avisos/:id', verificarAdmin, async (req, res) => {
    const id = req.params.id;
    try {
        await db.run("DELETE FROM avisos WHERE id = ?", [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


app.use((req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
    } catch (error) {
        console.error('Error crítico al iniciar el servidor:', error);
        process.exit(1);
    }
}

startServer();