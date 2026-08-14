const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

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

// Conexión a la base de datos
const db = new sqlite3.Database(path.join(__dirname, 'unigames.db'), (err) => {
    if (err) {
        console.error('Error al conectar con la base de datos:', err.message);
    } else {
        console.log('Conectado a unigames.db exitosamente.');
        // Habilitar foreign keys (SQLite las deshabilita por defecto)
        db.run('PRAGMA foreign_keys = ON', (pragmaErr) => {
            if (pragmaErr) console.error('Error al habilitar foreign keys:', pragmaErr.message);
        });
    }
});

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
        db.run(sql, [username, email, hash], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed: usuarios.nombre_usuario')) {
                    return res.status(400).json({ error: 'El nombre de usuario ya existe' });
                }
                if (err.message.includes('UNIQUE constraint failed: usuarios.email')) {
                    return res.status(400).json({ error: 'El email ya está registrado' });
                }
                return res.status(500).json({ error: 'Error al registrar usuario' });
            }
            res.status(201).json({ message: 'Usuario registrado exitosamente', id: this.lastID, username });
        });
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// 2. Inicio de sesión
app.post('/api/login', authRateLimit, (req, res) => {
    const { identity, password } = req.body; // identity can be email or username

    if (!identity || !password) {
        return res.status(400).json({ error: 'Credenciales incompletas' });
    }

    const sql = `SELECT * FROM usuarios WHERE nombre_usuario = ? OR email = ?`;
    db.get(sql, [identity, identity], async (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Error en la base de datos' });
        }
        if (!row) {
            return res.status(400).json({ error: 'Usuario no encontrado' });
        }

        try {
            const match = await bcrypt.compare(password, row.password_hash);
            if (match) {
                // TODO: En una app real, usaríamos JWT o sesiones aquí.
                res.json({ message: 'Inicio de sesión exitoso', user: { id: row.id, username: row.nombre_usuario } });
            } else {
                res.status(400).json({ error: 'Contraseña incorrecta' });
            }
        } catch (compareErr) {
            console.error('Error al comparar contraseñas:', compareErr.message);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    });
});

// 3. Obtener tabla de puntuaciones (Leaderboard)
// 3. Leaderboard: UN solo registro por usuario+juego (el MAX de todos sus intentos y temáticas)
// Opcional: ?juego_id=N para filtrar por juego
app.get('/api/leaderboard', (req, res) => {
    const { juego_id } = req.query;

    // Subconsulta: primero obtenemos el max de puntos por usuario+juego (ignorando temática)
    // Luego en el outer select traemos nombre y juego
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

    // GROUP BY solo usuario+juego: agrupa TODOS los intentos y temáticas del mismo usuario
    sql += `
        GROUP BY p.usuario_id, p.juego_id
        ORDER BY puntos DESC
        LIMIT 10
    `;

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error al obtener puntuaciones' });
        res.json(rows);
    });
});

// 3b. Leaderboard global: top 5 por juego, un registro por usuario (el MAX absoluto)
app.get('/api/leaderboard/global', (req, res) => {
    // Primero calcular el best score de cada usuario por juego en una CTE
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

    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error al obtener puntuaciones' });

        // Agrupar por juego en JS, top 5 por juego
        const byGame = {};
        for (const row of rows) {
            if (!byGame[row.juego_id]) byGame[row.juego_id] = { juego: row.juego, entries: [] };
            if (byGame[row.juego_id].entries.length < 5) {
                byGame[row.juego_id].entries.push({ jugador: row.jugador, puntos: row.puntos });
            }
        }
        res.json(byGame);
    });
});

// 4. Guardar partida — solo guarda si supera el record actual del usuario en ese juego
app.post('/api/partidas', (req, res) => {
    const { usuario_id, juego_id, tematica_id, puntos } = req.body;

    if (!usuario_id || !juego_id || puntos === undefined) {
        return res.status(400).json({ error: 'Faltan datos de la partida' });
    }

    // Buscar si ya existe un record para este usuario+juego
    const checkSql = `SELECT id, puntos FROM partidas WHERE usuario_id = ? AND juego_id = ? ORDER BY puntos DESC LIMIT 1`;
    db.get(checkSql, [usuario_id, juego_id], (err, existing) => {
        if (err) return res.status(500).json({ error: 'Error al verificar record' });

        if (existing && existing.puntos >= puntos) {
            // Ya tiene un record igual o mejor — no insertar, devolver ok igual
            return res.status(200).json({ message: 'Puntaje no supera el record', record: existing.puntos, nuevo: puntos });
        }

        if (existing) {
            // Actualizar el registro existente con el nuevo record
            db.run(`UPDATE partidas SET puntos = ?, tematica_id = ?, fecha = CURRENT_TIMESTAMP WHERE id = ?`,
                [puntos, tematica_id || null, existing.id],
                function(err) {
                    if (err) return res.status(500).json({ error: 'Error al actualizar record' });
                    res.status(200).json({ message: 'Nuevo record guardado', id: existing.id, puntos });
                }
            );
        } else {
            // Primera vez que juega este juego — insertar
            db.run(`INSERT INTO partidas (usuario_id, juego_id, tematica_id, puntos) VALUES (?, ?, ?, ?)`,
                [usuario_id, juego_id, tematica_id || null, puntos],
                function(err) {
                    if (err) return res.status(500).json({ error: 'Error al guardar partida' });
                    res.status(201).json({ message: 'Partida guardada', id: this.lastID });
                }
            );
        }
    });
});

// 5. Obtener palabra aleatoria para Ahorcado
// Query param "tematica": "1"-"4" para una temática puntual,
// "normal" para palabras sin temática (cotidianas), o sin parámetro = cualquiera.
app.get('/api/ahorcado/palabra', (req, res) => {
    const tematica = req.query.tematica;
    let sql = `SELECT palabra FROM palabras_ahorcado`;
    let params = [];

    if (tematica === 'normal') {
        sql += ` WHERE tematica_id IS NULL`;
    } else if (tematica !== undefined && /^\d+$/.test(tematica)) {
        sql += ` WHERE tematica_id = ?`;
        params.push(Number(tematica));
    }

    sql += ` ORDER BY RANDOM() LIMIT 1`;

    db.get(sql, params, (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Error al obtener palabra' });
        }
        if (row) {
            res.json({ palabra: row.palabra });
        } else {
            res.status(404).json({ error: 'No hay palabras disponibles' });
        }
    });
});

// 5.b Obtener palabra aleatoria para "Adivina la Palabra" (estilo Wordle)
// Requiere temática (1 a 4), este juego no tiene la opción "Normal".
app.get('/api/wordle/palabra', (req, res) => {
    const tematica = req.query.tematica;

    if (!tematica || !/^\d+$/.test(tematica)) {
        return res.status(400).json({ error: 'Falta indicar una temática válida' });
    }

    const sql = `SELECT palabra FROM palabras_wordle WHERE tematica_id = ? ORDER BY RANDOM() LIMIT 1`;
    db.get(sql, [Number(tematica)], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Error al obtener palabra' });
        }
        if (row) {
            res.json({ palabra: row.palabra });
        } else {
            res.status(404).json({ error: 'No hay palabras disponibles para esa temática' });
        }
    });
});

// 6. Obtener preguntas aleatorias (opcionalmente por temática)
app.get('/api/preguntas', (req, res) => {
    const tematica_id = req.query.tematica_id;
    let sql = `SELECT * FROM preguntas`;
    let params = [];
    
    if (tematica_id) {
        sql += ` WHERE tematica_id = ?`;
        params.push(tematica_id);
    }
    sql += ` ORDER BY RANDOM() LIMIT 10`;

    db.all(sql, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Error al obtener preguntas' });
        }
        res.json(rows);
    });
});

// Fallback para SPA (Single Page Application) en caso de recargar
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});