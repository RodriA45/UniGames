const jwt = require('jsonwebtoken');

// Sin JWT_SECRET el servidor no arranca: antes usaba un secreto por defecto
// que estaba en el repo, y con él cualquiera podía firmar un token de admin.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('Falta la variable de entorno JWT_SECRET (ver .env.example)');
}

// --- Rate limiting simple (en memoria, por IP) ---
// Cada limitador tiene su propio almacén, ventana y tope.
// (En producción real iría en Redis: esto se reinicia en cada deploy.)
function crearRateLimiter({ windowMs, max }) {
    const store = {};

    // Limpieza cada 5 minutos para no crecer sin límite.
    setInterval(() => {
        const now = Date.now();
        for (const ip in store) {
            if (now - store[ip].start > windowMs * 2) delete store[ip];
        }
    }, 5 * 60 * 1000).unref();

    return function rateLimitMiddleware(req, res, next) {
        // req.ip es la IP real del cliente gracias a app.set('trust proxy', 1)
        const ip = req.ip || req.socket.remoteAddress;
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

// Login/registro: 10 intentos por minuto por IP.
const authRateLimit = crearRateLimiter({ windowMs: 60 * 1000, max: 10 });

// Resto de la API: uso normal sí, scraping o bots no.
const apiRateLimit = crearRateLimiter({ windowMs: 60 * 1000, max: 60 });

// --- Verificar JWT ---
// 401 = no autenticado (sin token, inválido o vencido): el front cierra la
// sesión y abre el login. 403 queda para "autenticado pero sin permiso".
function verificarToken(req, res, next) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(401).json({ error: 'Sesión vencida o inválida. Iniciá sesión de nuevo.' });
        req.user = user;
        next();
    });
}

// Verificar que sea admin
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
