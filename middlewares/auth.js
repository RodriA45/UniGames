const jwt = require('jsonwebtoken');
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

module.exports = {
    authRateLimit,
    verificarToken,
    verificarAdmin,
    JWT_SECRET
};
