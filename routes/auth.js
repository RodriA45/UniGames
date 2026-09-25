const express = require('express');
const jwt = require('jsonwebtoken');
const { getDb } = require('../database/db');
const { authRateLimit, JWT_SECRET } = require('../middlewares/auth');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// ─── Nombre de usuario ───
// Mismas reglas que registerSchema y /perfil/username: 3 a 20 caracteres,
// solo letras, números y guión bajo. El nombre termina en el HTML de otros
// usuarios (ranking, amigos, notificaciones, panel admin), así que no se
// acepta cualquier cosa que mande el cliente.
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

// Sin username (login con Google): se arma desde el email, limpiando los
// caracteres no permitidos. "juan.perez-99@..." → "juan_perez_99".
function usernameDesdeEmail(email) {
    let base = String(email).split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 20);
    if (base.length < 3) base = (base + '_user').slice(0, 20);
    return base;
}

// Si el nombre ya existe (sin distinguir mayúsculas, igual que
// /perfil/username), se prueba con 4 dígitos al final sin pasarse de 20.
async function usernameDisponible(db, base) {
    const tomado = async (nombre) =>
        (await db.query(`SELECT 1 FROM usuarios WHERE LOWER(nombre_usuario) = LOWER($1)`, [nombre])).rows.length > 0;
    if (!(await tomado(base))) return base;
    for (let i = 0; i < 5; i++) {
        const candidato = base.slice(0, 16) + String(Math.floor(1000 + Math.random() * 9000));
        if (!(await tomado(candidato))) return candidato;
    }
    throw new Error('No se pudo generar un nombre de usuario libre');
}


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
            // Con username: tiene que cumplir las reglas (si no, 400).
            // Sin username: user_metadata (registro con confirmación) o email (Google).
            let base;
            if (username !== undefined && username !== null && username !== '') {
                const limpio = typeof username === 'string' ? username.trim() : '';
                if (!USERNAME_RE.test(limpio)) {
                    return res.status(400).json({
                        error: 'El nombre de usuario debe tener entre 3 y 20 caracteres: letras, números o guión bajo'
                    });
                }
                base = limpio;
            } else {
                // Registro con confirmación de email: el /sync del registro no
                // llega a correr (no hay sesión hasta confirmar), así que el
                // nombre elegido viaja en user_metadata (ver signUp en app2.js).
                // Lo puede tocar el cliente: se valida igual; si no sirve, email.
                const meta = user.user_metadata && user.user_metadata.username;
                base = (typeof meta === 'string' && USERNAME_RE.test(meta.trim()))
                    ? meta.trim()
                    : usernameDesdeEmail(email);
            }
            const newUsername = await usernameDisponible(db, base);

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

// Endpoint para verificar si un email existe localmente (útil para recuperar contraseña de forma "inteligente")
router.post('/auth/check-email', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Falta email' });
    }
    try {
        const db = await getDb();
        const result = await db.query(`SELECT id FROM usuarios WHERE email = $1`, [email.toLowerCase().trim()]);
        res.json({ exists: result.rows.length > 0 });
    } catch (error) {
        console.error('Error al verificar email:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
