const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./auth');
const { enMantenimiento } = require('../services/configSitio');

// ══════════════════════════════════════
//   Modo mantenimiento
// ══════════════════════════════════════
// Con el modo activo (Panel admin > Configuración), la API responde 503 a
// todos menos a los admins. Siguen abiertas las rutas que hacen falta para
// que un admin pueda entrar y apagarlo: config pública, login y el canal
// en tiempo real (que es el que avisa a los usuarios que se activó).
const LIBRES = [
    /^\/config$/,
    /^\/admin\/config$/,
    /^\/auth\//,
    /^\/stream$/,
    /^\/admin\//, // las protege verificarAdmin
];

function esAdmin(req) {
    const header = req.headers['authorization'] || '';
    if (!header.startsWith('Bearer ')) return false;
    try {
        return jwt.verify(header.slice(7), JWT_SECRET).rol === 'admin';
    } catch {
        return false;
    }
}

async function mantenimiento(req, res, next) {
    if (LIBRES.some((re) => re.test(req.path))) return next();
    if (!(await enMantenimiento())) return next();
    if (esAdmin(req)) return next();
    res.status(503).json({ error: 'El sitio está en mantenimiento. Volvé en un rato.', mantenimiento: true });
}

module.exports = { mantenimiento };
