const { getDb } = require('./db');

async function initDb() {
    console.log('--- Iniciando inicialización de Base de Datos PostgreSQL ---');
    const db = await getDb();

    try {
        await db.query('BEGIN');

        console.log('Creando tablas...');

        await db.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                nombre_usuario VARCHAR(255) NOT NULL UNIQUE,
                email VARCHAR(255) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                rol VARCHAR(50) DEFAULT 'user',
                estado VARCHAR(50) DEFAULT 'activo',
                descripcion TEXT DEFAULT '',
                icono TEXT DEFAULT 'assert/perfil_icons/icon_01.webp'
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS juegos (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(255) NOT NULL UNIQUE,
                descripcion TEXT,
                activo INTEGER DEFAULT 1
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS tematicas (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(255) NOT NULL UNIQUE
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS juego_tematica (
                id SERIAL PRIMARY KEY,
                juego_id INTEGER NOT NULL REFERENCES juegos(id),
                tematica_id INTEGER NOT NULL REFERENCES tematicas(id)
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS partidas (
                id SERIAL PRIMARY KEY,
                usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
                juego_id INTEGER NOT NULL REFERENCES juegos(id),
                tematica_id INTEGER REFERENCES tematicas(id),
                puntos INTEGER NOT NULL DEFAULT 0,
                fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS duelos (
                id SERIAL PRIMARY KEY,
                retador_id INTEGER NOT NULL REFERENCES usuarios(id),
                retado_id INTEGER NOT NULL REFERENCES usuarios(id),
                juego_id INTEGER NOT NULL REFERENCES juegos(id),
                estado VARCHAR(50) NOT NULL DEFAULT 'pendiente',
                puntos_retador INTEGER DEFAULT NULL,
                puntos_retado INTEGER DEFAULT NULL,
                ganador_id INTEGER DEFAULT NULL,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                fecha_fin TIMESTAMP DEFAULT NULL,
                tematica_id INTEGER REFERENCES tematicas(id),
                duracion_segundos INTEGER
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS palabras_ahorcado (
                id SERIAL PRIMARY KEY,
                palabra VARCHAR(255) NOT NULL,
                tematica_id INTEGER REFERENCES tematicas(id)
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS preguntas (
                id SERIAL PRIMARY KEY,
                tematica_id INTEGER NOT NULL REFERENCES tematicas(id),
                pregunta TEXT NOT NULL,
                opcion_a TEXT NOT NULL,
                opcion_b TEXT NOT NULL,
                opcion_c TEXT NOT NULL,
                opcion_d TEXT NOT NULL,
                respuesta_correcta VARCHAR(10) NOT NULL,
                UNIQUE(tematica_id, pregunta)
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS palabras_wordle (
                id SERIAL PRIMARY KEY,
                palabra VARCHAR(255) NOT NULL,
                tematica_id INTEGER NOT NULL REFERENCES tematicas(id)
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS adivina_items (
                id SERIAL PRIMARY KEY,
                tematica_id INTEGER NOT NULL REFERENCES tematicas(id),
                respuesta VARCHAR(255) NOT NULL,
                aliases TEXT,
                imagen TEXT,
                pista_1 TEXT,
                pista_2 TEXT,
                pista_3 TEXT,
                pista_4 TEXT
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS amistades (
                id SERIAL PRIMARY KEY,
                usuario1_id INTEGER NOT NULL REFERENCES usuarios(id),
                usuario2_id INTEGER NOT NULL REFERENCES usuarios(id),
                estado VARCHAR(50) NOT NULL DEFAULT 'pendiente',
                fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(usuario1_id, usuario2_id)
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS logros_usuario (
                id SERIAL PRIMARY KEY,
                usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
                logro_id VARCHAR(255) NOT NULL,
                fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(usuario_id, logro_id)
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS avisos (
                id SERIAL PRIMARY KEY,
                texto TEXT NOT NULL,
                icono VARCHAR(50) DEFAULT '📢',
                color VARCHAR(50) DEFAULT '#3b82f6',
                activo INTEGER DEFAULT 0,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS configuracion_global (
                clave VARCHAR(255) PRIMARY KEY,
                valor TEXT NOT NULL
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS notificaciones (
                id SERIAL PRIMARY KEY,
                usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
                tipo VARCHAR(50) NOT NULL,
                mensaje TEXT NOT NULL,
                enlace TEXT,
                leido INTEGER DEFAULT 0,
                fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('Insertando datos base...');

        await db.query(`
            INSERT INTO juegos (id, nombre, descripcion) VALUES
            (1, 'Sopa de Letras', 'Encontrar palabras ocultas en una grilla'),
            (2, 'Preguntados', 'Responder preguntas de opción múltiple'),
            (3, 'Termina la Palabra', 'Adivinar una palabra incompleta'),
            (4, 'Ahorcado', 'Adivinar letras antes de perder'),
            (5, 'Adivina la Cosa', 'Adivinar con pistas'),
            (6, 'Adivina la Palabra', 'Adiviná la palabra letra por letra, estilo Wordle, en 5 intentos'),
            (7, 'Pixel Runner', 'Saltá obstáculos y conseguí la mayor puntuación posible'),
            (8, 'Salto Traicionero', 'Plataformas con trampas escondidas: pisos falsos, flechas y sorpresas')
            ON CONFLICT (id) DO NOTHING;
        `);
        // Note: For ON CONFLICT DO NOTHING to work on "id", "id" must have a UNIQUE constraint or be PRIMARY KEY. 

        await db.query(`
            INSERT INTO tematicas (id, nombre) VALUES
            (1, 'Videojuegos'),
            (2, 'Películas'),
            (3, 'Anime'),
            (4, 'Programación')
            ON CONFLICT (id) DO NOTHING;
        `);

        await db.query(`
            INSERT INTO juego_tematica (id, juego_id, tematica_id) VALUES
            (1, 1, 1), (2, 1, 2), (3, 1, 3), (4, 1, 4),
            (5, 2, 1), (6, 2, 2), (7, 2, 3), (8, 2, 4),
            (9, 3, 1), (10, 3, 2), (11, 3, 3), (12, 3, 4),
            (13, 5, 1), (14, 5, 2), (15, 5, 3), (16, 5, 4),
            (17, 6, 1), (18, 6, 2), (19, 6, 3), (20, 6, 4)
            ON CONFLICT (id) DO NOTHING;
        `);

        // Update sequences just in case we forced inserts with IDs
        await db.query(`SELECT setval('juegos_id_seq', (SELECT MAX(id) FROM juegos));`);
        await db.query(`SELECT setval('tematicas_id_seq', (SELECT MAX(id) FROM tematicas));`);
        await db.query(`SELECT setval('juego_tematica_id_seq', (SELECT MAX(id) FROM juego_tematica));`);

        // Optional: Defaults configs
        await db.query(`
            INSERT INTO configuracion_global (clave, valor) VALUES
            ('color_tema', 'dark'),
            ('github_rodrigo', ''),
            ('github_santiago', ''),
            ('github_kevin', ''),
            ('anuncio_texto', ''),
            ('anuncio_activo', 'false'),
            ('repo_url', ''),
            ('mostrar_repo', 'false'),
            ('mostrar_devs', 'true')
            ON CONFLICT (clave) DO NOTHING;
        `);

        // Users default
        const { rowCount } = await db.query(`SELECT COUNT(*) FROM usuarios;`);
        if (parseInt(rowCount) === 0 || parseInt((await db.query(`SELECT COUNT(*) FROM usuarios;`)).rows[0].count) === 0) {
            const default_hash = "$2b$10$ihSR4f22dSpEhjaS8zZBSeliOqGhO4lh/a6.7GGUNieNHRfQOKWP2";
            await db.query(`
                INSERT INTO usuarios (nombre_usuario, email, password_hash, rol) VALUES 
                ('rodrigo', 'rodrigo@unigames.com', $1, 'admin'),
                ('kevin', 'kevin@unigames.com', $1, 'admin'),
                ('santiago', 'santiago@unigames.com', $1, 'admin'),
                ('testuser', 'test@unigames.com', $1, 'user')
                ON CONFLICT (nombre_usuario) DO NOTHING;
            `, [default_hash]);
        }

        await db.query('COMMIT');
        console.log('✅ Base de datos PostgreSQL inicializada exitosamente.');
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('❌ Error al inicializar PostgreSQL:', error);
    } finally {
        process.exit(0);
    }
}

initDb();
