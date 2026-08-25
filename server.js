require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb } = require('./database/db');

// Import Routes
const authRoutes = require('./routes/auth');
const juegosRoutes = require('./routes/juegos');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración
app.use(cors());
app.use(express.json());

// Bloquear archivos sensibles
app.use((req, res, next) => {
    if (/\.(bak|old|orig)$/i.test(req.path)) {
        return res.status(404).json({ error: 'Not found' });
    }
    next();
});

// Sirviendo archivos estáticos con configuración de caché para desarrollo
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: function (res, filePath) {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

// API Routes
app.use('/api', authRoutes);
app.use('/api', juegosRoutes);
app.use('/api/admin', adminRoutes);

// Fallback para SPA / Frontend
app.use((req, res) => {
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