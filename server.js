require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { getDb } = require('./database/db');
const compression = require('compression');

// Import Routes
const authRoutes = require('./routes/auth');
const juegosRoutes = require('./routes/juegos');
const adminRoutes = require('./routes/admin');
const perfilRoutes = require('./routes/perfil');
const amigosRoutes = require('./routes/amigos');
const logrosRoutes = require('./routes/logros');
const notificacionesRoutes = require('./routes/notificaciones');
const duelosRouter = require('./routes/duelos');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración
app.use(cors());
app.use(compression());
app.use(express.json());

// Bloquear archivos sensibles
app.use((req, res, next) => {
    if (/\.(bak|old|orig)$/i.test(req.path)) {
        return res.status(404).json({ error: 'Not found' });
    }
    next();
});

// ══════════════════════════════════════
//   Cache busting
// ══════════════════════════════════════
// El problema que resuelve: con `max-age=86400` a secas, después de un
// deploy la gente que ya había entrado seguía viendo el JS y el CSS viejos
// hasta 24hs. Y lo peor no es el retraso sino la MEZCLA — el navegador
// puede quedarse con app2.js nuevo y rpg.css viejo al mismo tiempo, que es
// la clase de bug que no se reproduce en ninguna máquina.
//
// Sin build step, la solución es una versión en la URL. Al arrancar se
// calcula un BUILD_ID a partir de los .js/.css de public/, y se inyecta
// como ?v=... en los <script> y <link> del index.html (que ya se sirve sin
// caché, así que el HTML siempre trae la versión del momento). Un archivo
// pedido CON ?v= puede cachearse un año: si cambia el contenido, cambia su
// URL. Sin ?v= se cachea 5 minutos.
//
// Los módulos que app2.js importa dinámicamente (runner_main.js y compañía)
// caen en el segundo caso a propósito: ponerles ?v= no serviría porque sus
// propios imports internos no lo heredarían, y terminaríamos con dos
// instancias del mismo módulo en memoria. Con 5 minutos un deploy llega
// igual de rápido, sin ese riesgo.
const PUBLIC_DIR = path.join(__dirname, 'public');

function calcBuildId() {
    const hash = crypto.createHash('sha1');
    const walk = dir => {
        let entries;
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) { walk(full); continue; }
            if (!/\.(js|css)$/i.test(e.name)) continue;
            const st = fs.statSync(full);
            hash.update(full + st.size + st.mtimeMs);
        }
    };
    walk(PUBLIC_DIR);
    return hash.digest('hex').slice(0, 8);
}

const BUILD_ID = calcBuildId();

// index.html con ?v= inyectado. Se arma una sola vez y queda en memoria: el
// archivo no cambia mientras el proceso vive, y si cambia hay que
// reiniciar igual para recalcular el BUILD_ID.
let indexHtmlCache = null;

function getIndexHtml() {
    if (indexHtmlCache) return indexHtmlCache;
    const raw = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
    // Solo rutas locales: las del CDN (jsdelivr) ya vienen versionadas por
    // el propio CDN, y agregarles un query les rompe la caché compartida.
    indexHtmlCache = raw.replace(
        /(src|href)="(?!https?:|\/\/|data:)([^"?]+\.(?:js|css))"/g,
        (m, attr, file) => `${attr}="${file}?v=${BUILD_ID}"`
    );
    return indexHtmlCache;
}

function sendIndex(res) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.type('html').send(getIndexHtml());
}

// Antes del static, si no estas rutas devuelven el index.html crudo del
// disco, sin versionar.
app.get(['/', '/index.html'], (req, res) => sendIndex(res));

// Sirviendo archivos estáticos con configuración de caché optimizada
app.use(express.static(PUBLIC_DIR, {
    setHeaders: function (res, filePath) {
        // 1. Archivos HTML: SIEMPRE frescos (actualizaciones inmediatas)
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        } 
        // 2. Multimedia pesada (imágenes, audios, fuentes, JSON de atlas): 7 días en disco
        else if (/\.(webp|png|jpg|jpeg|gif|svg|mp3|ogg|wav|json|woff2?)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        } 
        // 3. Scripts y estilos (JS y CSS)
        else if (/\.(js|css)$/i.test(filePath)) {
            // Con ?v= la URL es única por build → se puede cachear fuerte.
            // Sin ?v= (imports dinámicos de los juegos), 5 min y revalidar.
            const versioned = res.req && res.req.query && res.req.query.v;
            res.setHeader(
                'Cache-Control',
                versioned
                    ? 'public, max-age=31536000, immutable'
                    : 'public, max-age=300, must-revalidate'
            );
        }
    }
}));

// Endpoint for frontend config
app.get('/api/config', (req, res) => {
    res.json({
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY
    });
});

app.use('/api/admin', adminRoutes);
app.use('/api', authRoutes);
app.use('/api', juegosRoutes);
app.use('/api', perfilRoutes);
app.use('/api', amigosRoutes);
app.use('/api', logrosRoutes);
app.use('/api', notificacionesRoutes);
app.use('/api', duelosRouter);


// Fallback para SPA / Frontend
app.use((req, res) => sendIndex(res));

// Función para inicializar DB y Servidor
async function startServer() {
    try {
        await getDb(); // Inicializa SQLite y comprueba errores antes de abrir el puerto
        app.listen(PORT, () => {
            console.log(`🚀 Servidor corriendo en el puerto ${PORT} (build ${BUILD_ID})`);
        });
    } catch (error) {
        console.error('❌ Error crítico al iniciar el servidor:', error);
        process.exit(1);
    }
}

startServer();