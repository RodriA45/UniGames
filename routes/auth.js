const express = require('express');
const jwt = require('jsonwebtoken');
const { getDb } = require('../database/db');
const { authRateLimit, JWT_SECRET } = require('../middlewares/auth');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Endpoint para sincronizar el usuario de Supabase con la base de datos local
router.post('/auth/sync', authRateLimit, async (req, res) => {
    const { supabaseToken, username } = req.body;

    if (!supabaseToken) {
        return res.status(400).json({ error: 'Falta token de Supabase' });
    }

    try {
        // 1. Verificar el token con Supabase
        const { data: { user }, error } = await supabase.auth.getUser(supabaseToken);
        
        if (error || !user) {
            console.error("Error al validar token de Supabase:", error);
            return res.status(401).json({ error: 'Token de Supabase inválido o expirado' });
        }

        const email = user.email;
        const db = await getDb();

        // 2. Buscar si el usuario ya existe localmente
        let sql = `SELECT * FROM usuarios WHERE email = $1`;
        let result = await db.query(sql, [email]);
        let localUser = result.rows[0];

        // 3. Si no existe, lo creamos
        if (!localUser) {
            // Si viene de Google, puede que no tenga 'username' enviado desde el frontend.
            // Usamos la parte antes del @ del email como fallback, o un nombre aleatorio.
            let newUsername = username || email.split('@')[0];
            
            // Verificar si el username ya está tomado (por otro usuario con distinto email)
            const checkUsername = await db.query(`SELECT id FROM usuarios WHERE nombre_usuario = $1`, [newUsername]);
            if (checkUsername.rows.length > 0) {
                // Si está tomado, le añadimos números aleatorios
                newUsername = newUsername + Math.floor(Math.random() * 10000);
            }

            // Insertamos al nuevo usuario. La contraseña ya no importa porque Supabase la maneja.
            // Le ponemos un hash vacío o un placeholder.
            sql = `INSERT INTO usuarios (nombre_usuario, email, password_hash) VALUES ($1, $2, $3) RETURNING id, nombre_usuario, rol, estado`;
            result = await db.query(sql, [newUsername, email, 'SUPABASE_MANAGED']);
            localUser = result.rows[0];
        }

        if (localUser.estado === 'suspendido') {
            return res.status(403).json({ error: 'Tu cuenta ha sido suspendida' });
        }

        // 4. Generamos nuestro token JWT local tradicional (que usan los juegos para validar identidad rápida)
        const localJwt = jwt.sign({ 
            id: localUser.id, 
            username: localUser.nombre_usuario, 
            rol: localUser.rol || 'user' 
        }, JWT_SECRET, { expiresIn: '7d' });
        
        // 5. Devolvemos la sesión
        res.json({ 
            message: 'Inicio de sesión sincronizado exitosamente', 
            token: localJwt,
            user: { id: localUser.id, username: localUser.nombre_usuario, rol: localUser.rol || 'user' } 
        });

    } catch (error) {
        console.error('Error en /api/auth/sync:', error);
        res.status(500).json({ error: 'Error interno del servidor al sincronizar usuario' });
    }
});

module.exports = router;
