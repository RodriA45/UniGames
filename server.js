require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
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

// Sirviendo archivos estáticos con configuración de caché optimizada
app.use(express.static(path.join(__dirname, 'public'), {
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
        // 3. Scripts y estilos (JS y CSS): 1 día de caché
        else if (/\.(js|css)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=86400');
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
app.use((req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Función para inicializar DB y Servidor
async function startServer() {
    try {
        await getDb(); // Inicializa SQLite y comprueba errores antes de abrir el puerto
        app.listen(PORT, () => {
            console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
        });
    } catch (error) {
        console.error('❌ Error crítico al iniciar el servidor:', error);
        process.exit(1);
    }
}

startServer();