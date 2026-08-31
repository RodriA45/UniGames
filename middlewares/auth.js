const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_no_usar_en_prod';

// --- Rate limiting simple (en memoria) ---
// Factory genérica: cada middleware creado con esto tiene su propio
// almacén en memoria (por IP) y su propia ventana/tope, para no mezclar
// contadores entre limitadores distintos (ej: login/registro vs. el
// resto de la API, que necesitan topes muy diferentes).
function crearRateLimiter({ windowMs, max }) {
    const store = {};

    // Limpiar entradas viejas cada 5 minutos para no crecer sin límite en memoria.
    setInterval(() => {
        const now = Date.now();
        for (const ip in store) {
            if (now - store[ip].start > windowMs * 2) {
                delete store[ip];
            }
        }
    }, 5 * 60 * 1000);

    return function rateLimitMiddleware(req, res, next) {
        const ip = req.ip || req.connection.remoteAddress;
        const now = Date.now();

        if (!store[ip] || now - store[ip].start > windowMs) {
            store[ip] = { start: now, count: 1 };
            return next();
        }

        store[ip].count++;
        if (store[ip].count > max) {
            return res.status(429).json({ error: 'Demasiadas peticiones. Esperá un momento e intentá de nuevo.' });
        }
        next();
    };
}

// Límite estricto para registro/login: 10 intentos por minuto por IP
// (mismo comportamiento que antes, ahora armado con la factory de arriba).
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10;
const authRateLimit = crearRateLimiter({ windowMs: RATE_LIMIT_WINDOW_MS, max: RATE_LIMIT_MAX });

// Límite más permisivo para el resto de la API (notificaciones, perfiles
// públicos, etc.): pensado para uso normal navegando la app, pero que
// frena scraping agresivo o bots pegándole sin parar a un endpoint.
const apiRateLimit = crearRateLimiter({ windowMs: 60 * 1000, max: 60 });

// --- Middleware para verificar JWT ---
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
    apiRateLimit,
    verificarToken,
    verificarAdmin,
    JWT_SECRET
};
