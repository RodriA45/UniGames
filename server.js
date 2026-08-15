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

app.use(express.static(path.join(__dirname, 'public')));

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
        
        // Generar JWT
        const token = jwt.sign({ id: result.lastID, username }, JWT_SECRET, { expiresIn: '7d' });
        
        res.status(201).json({ 
            message: 'Usuario registrado exitosamente', 
            token,
            user: { id: result.lastID, username } 
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

        const match = await bcrypt.compare(password, row.password_hash);
        if (match) {
            // Generar JWT
            const token = jwt.sign({ id: row.id, username: row.nombre_usuario }, JWT_SECRET, { expiresIn: '7d' });
            res.json({ 
                message: 'Inicio de sesión exitoso', 
                token,
                user: { id: row.id, username: row.nombre_usuario } 
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

// Fallback para SPA (Single Page Application) en caso de recargar
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
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

        app.listen(PORT, () => {
            console.log(`Servidor corriendo en http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Error crítico al iniciar el servidor:', error);
        process.exit(1);
    }
}

startServer();