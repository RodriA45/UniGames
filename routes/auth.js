const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getDb } = require('../database/db');
const { authRateLimit, JWT_SECRET } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const { registerSchema, loginSchema } = require('../schemas');

const router = express.Router();

// 1. Registro de usuario
router.post('/register', authRateLimit, validate(registerSchema), async (req, res) => {
    const { username, email, password } = req.body;
    const db = await getDb();

    try {
        const hash = await bcrypt.hash(password, 10);
        const sql = `INSERT INTO usuarios (nombre_usuario, email, password_hash) VALUES ($1, $2, $3) RETURNING id`;
        const result = await db.query(sql, [username, email, hash]);
        const lastID = result.rows[0].id;
        
        const token = jwt.sign({ id: lastID, username, rol: 'user' }, JWT_SECRET, { expiresIn: '7d' });
        
        res.status(201).json({ 
            message: 'Usuario registrado exitosamente', 
            token,
            user: { id: lastID, username, rol: 'user' } 
        });
    } catch (error) {
        if (error.message.includes('usuarios_nombre_usuario_key') || error.message.includes('UNIQUE constraint failed: usuarios.nombre_usuario')) {
            return res.status(400).json({ error: 'El nombre de usuario ya existe' });
        }
        if (error.message.includes('usuarios_email_key') || error.message.includes('UNIQUE constraint failed: usuarios.email')) {
            return res.status(400).json({ error: 'El email ya está registrado' });
        }
        console.error('Error en /api/register:', error);
        res.status(500).json({ error: 'Error al registrar usuario' });
    }
});

// 2. Inicio de sesión
router.post('/login', authRateLimit, validate(loginSchema), async (req, res) => {
    const { identity, password } = req.body; 
    const db = await getDb();

    try {
        const sql = `SELECT * FROM usuarios WHERE nombre_usuario = $1 OR email = $2`;
        const result = await db.query(sql, [identity, identity]);
        const row = result.rows[0];
        
        if (!row) {
            return res.status(400).json({ error: 'Usuario no encontrado' });
        }
        if (row.estado === 'suspendido') {
            return res.status(403).json({ error: 'Tu cuenta ha sido suspendida' });
        }

        const match = await bcrypt.compare(password, row.password_hash);
        if (match) {
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

module.exports = router;
