const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Conexión a la base de datos
const db = new sqlite3.Database(path.join(__dirname, 'unigames.db'), (err) => {
    if (err) {
        console.error('Error al conectar con la base de datos:', err.message);
    } else {
        console.log('Conectado a unigames.db exitosamente.');
    }
});

// --- API Endpoints ---

// 1. Registro de usuario
app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
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
app.post('/api/login', (req, res) => {
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

        const match = await bcrypt.compare(password, row.password_hash);
        if (match) {
            // TODO: En una app real, usaríamos JWT o sesiones aquí.
            res.json({ message: 'Inicio de sesión exitoso', user: { id: row.id, username: row.nombre_usuario } });
        } else {
            res.status(400).json({ error: 'Contraseña incorrecta' });
        }
    });
});

// 3. Obtener tabla de puntuaciones (Leaderboard)
app.get('/api/leaderboard', (req, res) => {
    const sql = `
        SELECT 
            u.nombre_usuario as jugador, 
            j.nombre as juego, 
            t.nombre as tematica, 
            p.puntos
        FROM partidas p
        JOIN usuarios u ON p.usuario_id = u.id
        JOIN juegos j ON p.juego_id = j.id
        LEFT JOIN tematicas t ON p.tematica_id = t.id
        ORDER BY p.puntos DESC
        LIMIT 10
    `;
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Error al obtener puntuaciones' });
        }
        res.json(rows);
    });
});

// 4. Guardar partida
app.post('/api/partidas', (req, res) => {
    const { usuario_id, juego_id, tematica_id, puntos } = req.body;

    if (!usuario_id || !juego_id || puntos === undefined) {
        return res.status(400).json({ error: 'Faltan datos de la partida' });
    }

    const sql = `INSERT INTO partidas (usuario_id, juego_id, tematica_id, puntos) VALUES (?, ?, ?, ?)`;
    db.run(sql, [usuario_id, juego_id, tematica_id, puntos], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Error al guardar la partida' });
        }
        res.status(201).json({ message: 'Partida guardada', id: this.lastID });
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
