const express = require('express');
const jwt = require('jsonwebtoken');
const { getDb } = require('../database/db');
const { verificarToken, apiRateLimit, JWT_SECRET } = require('../middlewares/auth');
const { containsBadWords } = require('../middlewares/bad_words');

const router = express.Router();

// Intenta identificar al usuario logueado a partir del header Authorization,
// pero sin exigirlo: si no hay token, o es inválido, seguimos como invitado
// (usuarioActual = null). Se usa en la ruta pública de perfil de terceros
// para poder calcular el estado de amistad SI hay sesión, sin bloquear la
// vista a quien no tiene cuenta.
function usuarioOpcional(req) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return null;
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (e) {
        return null;
    }
}

const ICONOS_VALIDOS = Array.from({ length: 30 }, (_, i) =>
    'assert/perfil_icons/icon_' + String(i + 1).padStart(2, '0') + '.webp'
);

// Arma el bloque de amigos + logros que se usa tanto para el perfil propio
// como para el de un tercero.
async function obtenerResumenSocial(db, usuarioId) {
    const amigos = await db.all(`
        SELECT u.id, u.nombre_usuario AS username, u.icono AS avatar
        FROM amistades a
        JOIN usuarios u ON u.id = CASE WHEN a.usuario1_id = ? THEN a.usuario2_id ELSE a.usuario1_id END
        WHERE a.estado = 'aceptada' AND (a.usuario1_id = ? OR a.usuario2_id = ?)
        ORDER BY u.nombre_usuario ASC
    `, [usuarioId, usuarioId, usuarioId]);

    const logros = await db.all(
        `SELECT logro_id, fecha FROM logros_usuario WHERE usuario_id = ? ORDER BY fecha DESC`,
        [usuarioId]
    );

    return {
        amigos,
        amigosCount: amigos.length,
        logros: logros.map(l => l.logro_id),
        logrosCount: logros.length,
    };
}

// 1. Perfil propio
router.get('/perfil', verificarToken, async (req, res) => {
    const db = await getDb();
    try {
        const user = await db.get(
            `SELECT id, nombre_usuario AS username, email, descripcion, icono, fecha_registro FROM usuarios WHERE id = ?`,
            [req.user.id]
        );
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

        const social = await obtenerResumenSocial(db, user.id);
        res.json({ ...user, ...social });
    } catch (error) {
        console.error('Error en GET /api/perfil:', error);
        res.status(500).json({ error: 'Error al obtener el perfil' });
    }
});

// 2. Editar descripción y/o ícono del perfil propio
router.patch('/perfil', verificarToken, async (req, res) => {
    const { descripcion, icono } = req.body;
    const db = await getDb();

    if (descripcion === undefined && icono === undefined) {
        return res.status(400).json({ error: 'No se envió ningún campo para actualizar' });
    }
    if (descripcion !== undefined && typeof descripcion !== 'string') {
        return res.status(400).json({ error: 'La descripción debe ser texto' });
    }
    if (descripcion !== undefined && descripcion.length > 200) {
        return res.status(400).json({ error: 'La descripción no puede superar los 200 caracteres' });
    }
    if (descripcion !== undefined && containsBadWords(descripcion)) {
        return res.status(400).json({ error: 'La descripción contiene lenguaje inapropiado' });
    }
    if (icono !== undefined && !ICONOS_VALIDOS.includes(icono)) {
        return res.status(400).json({ error: 'Ícono inválido' });
    }

    try {
        const campos = [];
        const valores = [];
        if (descripcion !== undefined) { campos.push('descripcion = ?'); valores.push(descripcion.trim()); }
        if (icono !== undefined) { campos.push('icono = ?'); valores.push(icono); }
        valores.push(req.user.id);

        await db.query(`UPDATE usuarios SET ${campos.join(', ')} WHERE id = ?`, valores);

        const user = await db.get(
            `SELECT id, nombre_usuario AS username, descripcion, icono FROM usuarios WHERE id = ?`,
            [req.user.id]
        );
        res.json({ message: 'Perfil actualizado', user });
    } catch (error) {
        console.error('Error en PATCH /api/perfil:', error);
        res.status(500).json({ error: 'Error al actualizar el perfil' });
    }
});

// 2.b Editar nombre de usuario
router.patch('/perfil/username', verificarToken, async (req, res) => {
    const { username } = req.body;
    if (!username || typeof username !== 'string') {
        return res.status(400).json({ error: 'Falta el nombre de usuario' });
    }
    const newUsername = username.trim();
    if (newUsername.length < 3 || newUsername.length > 20) {
        return res.status(400).json({ error: 'El nombre debe tener entre 3 y 20 caracteres' });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
        return res.status(400).json({ error: 'Solo se permiten letras, números y guiones bajos' });
    }
    if (containsBadWords(newUsername)) {
        return res.status(400).json({ error: 'El nombre de usuario contiene lenguaje inapropiado' });
    }

    const db = await getDb();
    try {
        // Verificar si el nombre ya está en uso por OTRO usuario
        const existing = await db.get(`SELECT id FROM usuarios WHERE LOWER(nombre_usuario) = LOWER(?) AND id != ?`, [newUsername, req.user.id]);
        if (existing) {
            return res.status(400).json({ error: 'Ese nombre de usuario ya está en uso' });
        }

        // Actualizar
        await db.query(`UPDATE usuarios SET nombre_usuario = ? WHERE id = ?`, [newUsername, req.user.id]);

        // Generar nuevo JWT
        const localJwt = jwt.sign({
            id: req.user.id,
            username: newUsername,
            rol: req.user.rol
        }, JWT_SECRET, { expiresIn: '7d' });

        res.json({ message: 'Nombre de usuario actualizado', token: localJwt, username: newUsername });
    } catch (error) {
        console.error('Error en PATCH /api/perfil/username:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// 3. Perfil de otro usuario (lectura pública: no hace falta estar logueado
// para ver puntuaciones/perfiles de otras cuentas, solo para agregarlas
// como amigo). Si hay sesión, además devuelve el estado de amistad.
// Al ser pública (sin verificarToken), lleva su propio rate limit para
// que no se pueda usar para escrapear todas las cuentas sin control.
router.get('/usuarios/:id/perfil', apiRateLimit, async (req, res) => {
    const { id } = req.params;
    if (!/^\d+$/.test(id)) return res.status(400).json({ error: 'Id inválido' });

    const usuarioActual = usuarioOpcional(req);
    const db = await getDb();
    try {
        const user = await db.get(
            `SELECT id, nombre_usuario AS username, descripcion, icono, fecha_registro FROM usuarios WHERE id = ?`,
            [id]
        );
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

        const social = await obtenerResumenSocial(db, user.id);

        let estadoAmistad = 'ninguna';
        if (usuarioActual) {
            const relacion = await db.get(
                `SELECT estado, usuario1_id FROM amistades WHERE (usuario1_id = ? AND usuario2_id = ?) OR (usuario1_id = ? AND usuario2_id = ?)`,
                [usuarioActual.id, user.id, user.id, usuarioActual.id]
            );
            if (relacion) {
                estadoAmistad = relacion.estado === 'aceptada'
                    ? 'amigos'
                    : (relacion.usuario1_id === usuarioActual.id ? 'solicitud_enviada' : 'solicitud_recibida');
            }
        }

        res.json({
            ...user,
            ...social,
            amigos: undefined,
            amistad: estadoAmistad,
            esPropio: !!usuarioActual && Number(id) === usuarioActual.id,
        });
    } catch (error) {
        console.error('Error en GET /api/usuarios/:id/perfil:', error);
        res.status(500).json({ error: 'Error al obtener el perfil' });
    }
});

// 4. Buscar usuarios por nombre (para el buscador de la pantalla Amigos)
router.get('/usuarios/buscar', verificarToken, async (req, res) => {
    const nombre = (req.query.nombre || '').trim();
    if (!nombre) return res.json([]);

    const db = await getDb();
    try {
        const rows = await db.all(
            `SELECT id, nombre_usuario AS username, icono AS avatar
             FROM usuarios
             WHERE nombre_usuario LIKE ? AND id != ?
             ORDER BY nombre_usuario ASC
             LIMIT 20`,
            [`%${nombre}%`, req.user.id]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error en GET /api/usuarios/buscar:', error);
        res.status(500).json({ error: 'Error al buscar usuarios' });
    }
});

module.exports = router;
