const { getDb } = require('./db');

// ══════════════════════════════════════════════════════════════════
//   UniGames — init_db.js
// ══════════════════════════════════════════════════════════════════
//
// Crea el esquema de la base (PostgreSQL) en Tercera Forma Normal y,
// si la base ya existía con el esquema viejo, la migra sin perder datos.
// Se puede correr todas las veces que se quiera (start.js lo corre en
// cada arranque): cada paso chequea antes de tocar algo.
//
// Resumen de la normalización (ver detalle en cada tabla):
//   1FN  - Sin grupos repetidos ni listas en un campo:
//          · preguntas.opcion_a..d          → tabla pregunta_opciones
//          · adivina_items.pista_1..4       → tabla adivina_pistas
//          · adivina_items.aliases (JSON)   → tabla adivina_aliases
//   2FN  - Las tablas con clave compuesta (juego_tematica,
//          pregunta_opciones, adivina_pistas, adivina_aliases) solo tienen
//          atributos que dependen de la clave completa.
//   3FN  - Sin dependencias transitivas ni datos derivados:
//          · duelos.ganador_id se calculaba desde los puntos → se quitó
//            y se calcula en la vista v_duelos.
//          · logros_usuario.logro_id ahora referencia al catálogo `logros`.
//          · El baneo de una cuenta no es una columna "estado" (un baneo
//            temporal vence solo): sale de la tabla sanciones.
//          · Las notificaciones de un aviso apuntan al aviso (aviso_id) en
//            vez de copiar su texto en cada fila.
//
// Vistas de compatibilidad: v_preguntas, v_adivina_items y v_duelos
// devuelven las filas con la misma forma que antes, así la API y el
// frontend no cambian.
// ══════════════════════════════════════════════════════════════════

// ─── Helpers ───

async function existeColumna(c, tabla, columna) {
    const r = await c.query(
        `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
        [tabla, columna]
    );
    return r.rowCount > 0;
}

async function existeRestriccion(c, tabla, nombre) {
    const r = await c.query(
        `SELECT 1 FROM pg_constraint WHERE conrelid = $1::regclass AND conname = $2`,
        [tabla, nombre]
    );
    return r.rowCount > 0;
}

// Agrega una restricción (CHECK, UNIQUE) solo si no existe. En una base
// nueva ya viene en el CREATE TABLE; esto es para las bases viejas.
async function asegurarRestriccion(c, tabla, nombre, definicion) {
    if (await existeRestriccion(c, tabla, nombre)) return;
    await c.query(`ALTER TABLE ${tabla} ADD CONSTRAINT ${nombre} ${definicion}`);
}

// Las FK viejas se crearon sin ON DELETE. Si la FK de `columna` no tiene la
// acción pedida, se borra y se vuelve a crear con ella.
async function asegurarFk(c, tabla, columna, ref, accion) {
    const codigo = { CASCADE: 'c', 'NO ACTION': 'a' }[accion];
    const r = await c.query(`
        SELECT con.conname, con.confdeltype
        FROM pg_constraint con
        JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
        WHERE con.contype = 'f' AND con.conrelid = $1::regclass AND att.attname = $2
    `, [tabla, columna]);
    if (r.rows.length === 1 && r.rows[0].confdeltype === codigo) return;
    for (const row of r.rows) {
        await c.query(`ALTER TABLE ${tabla} DROP CONSTRAINT ${row.conname}`);
    }
    await c.query(
        `ALTER TABLE ${tabla} ADD CONSTRAINT ${tabla}_${columna}_fkey FOREIGN KEY (${columna}) REFERENCES ${ref} ON DELETE ${accion}`
    );
}

// Pasos que no son imprescindibles (restricciones sobre datos viejos que
// podrían no cumplirlas). Si fallan, se avisa y se sigue: el SAVEPOINT
// deshace solo ese paso, no toda la migración.
async function opcional(c, descripcion, fn) {
    await c.query('SAVEPOINT paso_opcional');
    try {
        await fn();
        await c.query('RELEASE SAVEPOINT paso_opcional');
    } catch (err) {
        await c.query('ROLLBACK TO SAVEPOINT paso_opcional');
        console.warn(`No se pudo aplicar "${descripcion}": ${err.message}`);
    }
}

// Mismo criterio que usaba el backend para leer aliases viejos: JSON o "a,b,c".
function parseAliases(raw) {
    if (!raw) return [];
    try {
        const v = JSON.parse(raw);
        return Array.isArray(v) ? v : [];
    } catch {
        return String(raw).split(',');
    }
}

// ─── 1. Tablas ───

async function crearTablas(c) {
    // USUARIOS ─ rol limitado con CHECK. Si la cuenta está baneada NO se
    // guarda acá: sale de la tabla sanciones (un baneo temporal vence solo,
    // así que una columna "estado" quedaría desactualizada).
    await c.query(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id SERIAL PRIMARY KEY,
            nombre_usuario VARCHAR(255) NOT NULL UNIQUE,
            email VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            rol VARCHAR(50) NOT NULL DEFAULT 'user',
            descripcion TEXT DEFAULT '',
            icono TEXT DEFAULT 'assert/perfil_icons/icon_01.webp',
            ultima_conexion TIMESTAMPTZ,
            CONSTRAINT chk_usuarios_rol CHECK (rol IN ('user', 'admin'))
        );
    `);

    // SANCIONES ─ baneos que pone un admin: temporal (con fecha "hasta") o
    // permanente, con el motivo. Queda el historial completo; la sanción
    // vigente la calcula la vista v_sanciones_activas.
    await c.query(`
        CREATE TABLE IF NOT EXISTS sanciones (
            id SERIAL PRIMARY KEY,
            usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            tipo VARCHAR(12) NOT NULL,
            motivo VARCHAR(300) NOT NULL,
            hasta TIMESTAMPTZ,
            creado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
            creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            levantada_en TIMESTAMPTZ,
            levantada_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
            CONSTRAINT chk_sanciones_tipo CHECK (tipo IN ('temporal', 'permanente')),
            CONSTRAINT chk_sanciones_hasta CHECK ((tipo = 'temporal') = (hasta IS NOT NULL))
        );
    `);

    await c.query(`
        CREATE TABLE IF NOT EXISTS juegos (
            id SERIAL PRIMARY KEY,
            nombre VARCHAR(255) NOT NULL UNIQUE,
            descripcion TEXT,
            activo INTEGER NOT NULL DEFAULT 1,
            CONSTRAINT chk_juegos_activo CHECK (activo IN (0, 1))
        );
    `);

    await c.query(`
        CREATE TABLE IF NOT EXISTS tematicas (
            id SERIAL PRIMARY KEY,
            nombre VARCHAR(255) NOT NULL UNIQUE
        );
    `);

    // JUEGO_TEMATICA ─ tabla intermedia de la relación N:M. La clave es el
    // par (juego, temática): con un id aparte se podía cargar el mismo par 2 veces.
    await c.query(`
        CREATE TABLE IF NOT EXISTS juego_tematica (
            juego_id INTEGER NOT NULL REFERENCES juegos(id) ON DELETE CASCADE,
            tematica_id INTEGER NOT NULL REFERENCES tematicas(id) ON DELETE CASCADE,
            PRIMARY KEY (juego_id, tematica_id)
        );
    `);

    // PARTIDAS ─ guarda el récord de cada usuario en cada juego (se
    // actualiza si lo supera), por eso (usuario, juego) es único.
    await c.query(`
        CREATE TABLE IF NOT EXISTS partidas (
            id SERIAL PRIMARY KEY,
            usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            juego_id INTEGER NOT NULL REFERENCES juegos(id),
            tematica_id INTEGER REFERENCES tematicas(id),
            puntos INTEGER NOT NULL DEFAULT 0,
            fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT ux_partidas_usuario_juego UNIQUE (usuario_id, juego_id),
            CONSTRAINT chk_partidas_puntos CHECK (puntos >= 0)
        );
    `);

    // DUELOS ─ sin ganador_id: se deriva de los puntos (ver v_duelos).
    await c.query(`
        CREATE TABLE IF NOT EXISTS duelos (
            id SERIAL PRIMARY KEY,
            retador_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            retado_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            juego_id INTEGER NOT NULL REFERENCES juegos(id),
            estado VARCHAR(50) NOT NULL DEFAULT 'pendiente',
            puntos_retador INTEGER DEFAULT NULL,
            puntos_retado INTEGER DEFAULT NULL,
            fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            fecha_fin TIMESTAMP DEFAULT NULL,
            tematica_id INTEGER REFERENCES tematicas(id),
            duracion_segundos INTEGER,
            CONSTRAINT chk_duelos_estado CHECK (estado IN ('pendiente', 'en_curso', 'finalizado')),
            CONSTRAINT chk_duelos_distintos CHECK (retador_id <> retado_id)
        );
    `);

    // PALABRAS_AHORCADO ─ también las usa Sopa de Letras. tematica_id NULL
    // = modo "Normal" (sin temática).
    await c.query(`
        CREATE TABLE IF NOT EXISTS palabras_ahorcado (
            id SERIAL PRIMARY KEY,
            palabra VARCHAR(255) NOT NULL,
            tematica_id INTEGER REFERENCES tematicas(id)
        );
    `);

    // PREGUNTAS + PREGUNTA_OPCIONES ─ antes eran 4 columnas opcion_a..d y
    // una respuesta_correcta (grupo repetido → violaba 1FN).
    await c.query(`
        CREATE TABLE IF NOT EXISTS preguntas (
            id SERIAL PRIMARY KEY,
            tematica_id INTEGER NOT NULL REFERENCES tematicas(id),
            pregunta TEXT NOT NULL,
            UNIQUE (tematica_id, pregunta)
        );
    `);
    await c.query(`
        CREATE TABLE IF NOT EXISTS pregunta_opciones (
            pregunta_id INTEGER NOT NULL REFERENCES preguntas(id) ON DELETE CASCADE,
            letra CHAR(1) NOT NULL,
            texto TEXT NOT NULL,
            es_correcta BOOLEAN NOT NULL DEFAULT FALSE,
            PRIMARY KEY (pregunta_id, letra),
            CONSTRAINT chk_pregunta_opciones_letra CHECK (letra IN ('A', 'B', 'C', 'D'))
        );
    `);
    // Una sola opción correcta por pregunta.
    await c.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS ux_pregunta_opciones_correcta
        ON pregunta_opciones (pregunta_id) WHERE es_correcta;
    `);

    await c.query(`
        CREATE TABLE IF NOT EXISTS palabras_wordle (
            id SERIAL PRIMARY KEY,
            palabra VARCHAR(255) NOT NULL,
            tematica_id INTEGER NOT NULL REFERENCES tematicas(id)
        );
    `);

    // ADIVINA_ITEMS + ADIVINA_PISTAS + ADIVINA_ALIASES ─ antes las pistas
    // eran pista_1..4 (grupo repetido) y los alias una lista JSON en un
    // solo campo (valor no atómico). Las dos cosas violaban 1FN.
    await c.query(`
        CREATE TABLE IF NOT EXISTS adivina_items (
            id SERIAL PRIMARY KEY,
            tematica_id INTEGER NOT NULL REFERENCES tematicas(id),
            respuesta VARCHAR(255) NOT NULL,
            imagen TEXT
        );
    `);
    await c.query(`
        CREATE TABLE IF NOT EXISTS adivina_pistas (
            item_id INTEGER NOT NULL REFERENCES adivina_items(id) ON DELETE CASCADE,
            orden SMALLINT NOT NULL,
            texto TEXT NOT NULL,
            PRIMARY KEY (item_id, orden),
            CONSTRAINT chk_adivina_pistas_orden CHECK (orden BETWEEN 1 AND 4)
        );
    `);
    await c.query(`
        CREATE TABLE IF NOT EXISTS adivina_aliases (
            item_id INTEGER NOT NULL REFERENCES adivina_items(id) ON DELETE CASCADE,
            alias VARCHAR(255) NOT NULL,
            PRIMARY KEY (item_id, alias)
        );
    `);

    // AMISTADES ─ relación reflexiva usuarios↔usuarios. El índice único
    // con LEAST/GREATEST (más abajo) impide guardar A→B y B→A como dos filas.
    await c.query(`
        CREATE TABLE IF NOT EXISTS amistades (
            id SERIAL PRIMARY KEY,
            usuario1_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            usuario2_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            estado VARCHAR(50) NOT NULL DEFAULT 'pendiente',
            fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (usuario1_id, usuario2_id),
            CONSTRAINT chk_amistades_estado CHECK (estado IN ('pendiente', 'aceptada')),
            CONSTRAINT chk_amistades_distintos CHECK (usuario1_id <> usuario2_id)
        );
    `);

    // LOGROS ─ catálogo (lo carga seed_games.js desde logros_catalogo.js).
    // Antes logro_id era un texto suelto sin integridad referencial.
    await c.query(`
        CREATE TABLE IF NOT EXISTS logros (
            id VARCHAR(64) PRIMARY KEY,
            categoria VARCHAR(32) NOT NULL,
            nombre VARCHAR(255) NOT NULL
        );
    `);
    await c.query(`
        CREATE TABLE IF NOT EXISTS logros_usuario (
            id SERIAL PRIMARY KEY,
            usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            logro_id VARCHAR(64) NOT NULL REFERENCES logros(id),
            fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (usuario_id, logro_id)
        );
    `);

    // AVISOS ─ anuncios del admin. Se mandan en el momento o en la fecha
    // programada (programado_para). enviado_en NULL = todavía no salió.
    // El estado (programado / enviado) se deriva de esas fechas, no se guarda.
    await c.query(`
        CREATE TABLE IF NOT EXISTS avisos (
            id SERIAL PRIMARY KEY,
            titulo VARCHAR(120) NOT NULL,
            texto TEXT NOT NULL,
            prioridad VARCHAR(10) NOT NULL DEFAULT 'normal',
            programado_para TIMESTAMPTZ,
            enviado_en TIMESTAMPTZ,
            creado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
            fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT chk_avisos_prioridad CHECK (prioridad IN ('normal', 'alta'))
        );
    `);

    await c.query(`
        CREATE TABLE IF NOT EXISTS configuracion_global (
            clave VARCHAR(255) PRIMARY KEY,
            valor TEXT NOT NULL
        );
    `);

    await c.query(`
        CREATE TABLE IF NOT EXISTS notificaciones (
            id SERIAL PRIMARY KEY,
            usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            tipo VARCHAR(50) NOT NULL,
            mensaje TEXT,
            enlace TEXT,
            leido INTEGER NOT NULL DEFAULT 0,
            fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            aviso_id INTEGER REFERENCES avisos(id) ON DELETE CASCADE,
            CONSTRAINT chk_notificaciones_leido CHECK (leido IN (0, 1)),
            CONSTRAINT chk_notificaciones_contenido CHECK (mensaje IS NOT NULL OR aviso_id IS NOT NULL)
        );
    `);
}

// ─── 2. Migración de bases con el esquema viejo ───
// Cada bloque mira si la columna/forma vieja sigue ahí. En una base nueva
// (o ya migrada) no hace nada.

async function migrarEsquemaViejo(c) {
    // Preguntas: opcion_a..d + respuesta_correcta → pregunta_opciones
    if (await existeColumna(c, 'preguntas', 'opcion_a')) {
        console.log('Migrando opciones de Preguntados...');
        await c.query(`
            INSERT INTO pregunta_opciones (pregunta_id, letra, texto, es_correcta)
            SELECT p.id, o.letra, o.texto, o.letra = UPPER(TRIM(p.respuesta_correcta))
            FROM preguntas p
            CROSS JOIN LATERAL (VALUES ('A', p.opcion_a), ('B', p.opcion_b),
                                       ('C', p.opcion_c), ('D', p.opcion_d)) AS o(letra, texto)
            WHERE o.texto IS NOT NULL
            ON CONFLICT DO NOTHING;
        `);
        await c.query(`
            ALTER TABLE preguntas
              DROP COLUMN opcion_a, DROP COLUMN opcion_b, DROP COLUMN opcion_c,
              DROP COLUMN opcion_d, DROP COLUMN respuesta_correcta;
        `);
    }

    // Adivina: pista_1..4 → adivina_pistas
    if (await existeColumna(c, 'adivina_items', 'pista_1')) {
        console.log('Migrando pistas de Adivina la Cosa...');
        await c.query(`
            INSERT INTO adivina_pistas (item_id, orden, texto)
            SELECT i.id, p.orden, p.texto
            FROM adivina_items i
            CROSS JOIN LATERAL (VALUES (1, i.pista_1), (2, i.pista_2),
                                       (3, i.pista_3), (4, i.pista_4)) AS p(orden, texto)
            WHERE p.texto IS NOT NULL AND TRIM(p.texto) <> ''
            ON CONFLICT DO NOTHING;
        `);
        await c.query(`
            ALTER TABLE adivina_items
              DROP COLUMN pista_1, DROP COLUMN pista_2, DROP COLUMN pista_3, DROP COLUMN pista_4;
        `);
    }

    // Adivina: aliases (JSON o "a,b,c") → adivina_aliases
    if (await existeColumna(c, 'adivina_items', 'aliases')) {
        console.log('Migrando alias de Adivina la Cosa...');
        const { rows } = await c.query(`SELECT id, aliases FROM adivina_items WHERE aliases IS NOT NULL`);
        for (const row of rows) {
            const vistos = new Set();
            for (const raw of parseAliases(row.aliases)) {
                const alias = String(raw).trim();
                if (!alias || vistos.has(alias.toLowerCase())) continue;
                vistos.add(alias.toLowerCase());
                await c.query(
                    `INSERT INTO adivina_aliases (item_id, alias) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                    [row.id, alias]
                );
            }
        }
        await c.query(`ALTER TABLE adivina_items DROP COLUMN aliases`);
    }

    // Duelos: ganador_id era un dato derivado de los puntos.
    if (await existeColumna(c, 'duelos', 'ganador_id')) {
        console.log('Quitando duelos.ganador_id (pasa a calcularse en v_duelos)...');
        await c.query(`ALTER TABLE duelos DROP COLUMN ganador_id`);
    }

    // Juego_tematica: id propio → clave compuesta (juego_id, tematica_id).
    if (await existeColumna(c, 'juego_tematica', 'id')) {
        console.log('Pasando juego_tematica a clave compuesta...');
        await c.query(`
            DELETE FROM juego_tematica a USING juego_tematica b
            WHERE a.id > b.id AND a.juego_id = b.juego_id AND a.tematica_id = b.tematica_id;
        `);
        await c.query(`ALTER TABLE juego_tematica DROP COLUMN id`);
        await c.query(`ALTER TABLE juego_tematica ADD PRIMARY KEY (juego_id, tematica_id)`);
    }

    // Usuarios: estado ('activo'/'suspendido') pasa a la tabla sanciones.
    // Los que estaban suspendidos quedan con un baneo permanente.
    if (await existeColumna(c, 'usuarios', 'estado')) {
        console.log('Pasando las cuentas suspendidas a la tabla sanciones...');
        await c.query(`
            INSERT INTO sanciones (usuario_id, tipo, motivo)
            SELECT id, 'permanente', 'Suspendida antes del sistema de sanciones'
            FROM usuarios WHERE estado = 'suspendido'
        `);
        await c.query(`ALTER TABLE usuarios DROP COLUMN estado`);
    }
    await c.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultima_conexion TIMESTAMPTZ`);

    // Avisos: el formato viejo era un banner (texto + ícono + color + activo).
    // Pasa a título + texto + prioridad + fechas de programación/envío. Los
    // avisos viejos ya se habían mandado como notificación al crearlos.
    if (await existeColumna(c, 'avisos', 'activo')) {
        console.log('Migrando avisos al formato nuevo (título, prioridad, programación)...');
        await c.query(`
            ALTER TABLE avisos
              ADD COLUMN IF NOT EXISTS titulo VARCHAR(120),
              ADD COLUMN IF NOT EXISTS prioridad VARCHAR(10) NOT NULL DEFAULT 'normal',
              ADD COLUMN IF NOT EXISTS programado_para TIMESTAMPTZ,
              ADD COLUMN IF NOT EXISTS enviado_en TIMESTAMPTZ,
              ADD COLUMN IF NOT EXISTS creado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
        `);
        await c.query(`UPDATE avisos SET titulo = LEFT(COALESCE(NULLIF(TRIM(icono), ''), '📢') || ' Aviso', 120) WHERE titulo IS NULL`);
        await c.query(`UPDATE avisos SET enviado_en = COALESCE(fecha_creacion, NOW()) WHERE enviado_en IS NULL`);
        await c.query(`ALTER TABLE avisos ALTER COLUMN titulo SET NOT NULL`);
        await c.query(`ALTER TABLE avisos DROP COLUMN activo, DROP COLUMN icono, DROP COLUMN color`);
    }
    await asegurarRestriccion(c, 'avisos', 'chk_avisos_prioridad', `CHECK (prioridad IN ('normal', 'alta'))`);

    // Notificaciones: las de un aviso apuntan al aviso (aviso_id) en vez de
    // copiar su texto en cada fila; mensaje queda NULL para esas.
    await c.query(`ALTER TABLE notificaciones ADD COLUMN IF NOT EXISTS aviso_id INTEGER REFERENCES avisos(id) ON DELETE CASCADE`);
    await c.query(`ALTER TABLE notificaciones ALTER COLUMN mensaje DROP NOT NULL`);
    await asegurarRestriccion(c, 'notificaciones', 'chk_notificaciones_contenido', `CHECK (mensaje IS NOT NULL OR aviso_id IS NOT NULL)`);

    // Logros: los logro_id que ya hay guardados entran al catálogo (con
    // nombre provisorio) para poder crear la FK. seed_games.js les pone
    // después el nombre y la categoría reales.
    await c.query(`
        INSERT INTO logros (id, categoria, nombre)
        SELECT DISTINCT logro_id, 'sin_categoria', logro_id FROM logros_usuario
        ON CONFLICT (id) DO NOTHING;
    `);
    const largo = (await c.query(`
        SELECT character_maximum_length AS n FROM information_schema.columns
        WHERE table_name = 'logros_usuario' AND column_name = 'logro_id'
    `)).rows[0];
    if (largo && largo.n !== 64) {
        await c.query(`ALTER TABLE logros_usuario ALTER COLUMN logro_id TYPE VARCHAR(64)`);
    }
    await asegurarFk(c, 'logros_usuario', 'logro_id', 'logros(id)', 'NO ACTION');

    // Limpieza de duplicados para poder crear las restricciones únicas.
    // Partidas: el backend solo usa el mejor puntaje de cada usuario por
    // juego; las filas de menor puntaje nunca se mostraban.
    await c.query(`
        DELETE FROM partidas a USING partidas b
        WHERE a.usuario_id = b.usuario_id AND a.juego_id = b.juego_id
          AND (a.puntos < b.puntos OR (a.puntos = b.puntos AND a.id > b.id));
    `);
    // Amistades: si existe A→B y B→A, queda la aceptada (o la más vieja).
    await c.query(`DELETE FROM amistades WHERE usuario1_id = usuario2_id`);
    await c.query(`
        DELETE FROM amistades a USING amistades b
        WHERE a.id <> b.id
          AND LEAST(a.usuario1_id, a.usuario2_id) = LEAST(b.usuario1_id, b.usuario2_id)
          AND GREATEST(a.usuario1_id, a.usuario2_id) = GREATEST(b.usuario1_id, b.usuario2_id)
          AND ((b.estado = 'aceptada' AND a.estado <> 'aceptada')
               OR (a.estado = b.estado AND a.id > b.id));
    `);
}

// ─── 3. Restricciones e índices (para bases viejas) ───

async function asegurarRestricciones(c) {
    // FKs: borrar un usuario borra sus datos asociados.
    for (const [tabla, col] of [
        ['partidas', 'usuario_id'], ['duelos', 'retador_id'], ['duelos', 'retado_id'],
        ['amistades', 'usuario1_id'], ['amistades', 'usuario2_id'],
        ['logros_usuario', 'usuario_id'], ['notificaciones', 'usuario_id'],
    ]) {
        await asegurarFk(c, tabla, col, 'usuarios(id)', 'CASCADE');
    }
    await asegurarFk(c, 'juego_tematica', 'juego_id', 'juegos(id)', 'CASCADE');
    await asegurarFk(c, 'juego_tematica', 'tematica_id', 'tematicas(id)', 'CASCADE');

    await opcional(c, 'usuarios: rol válido', async () => {
        await c.query(`UPDATE usuarios SET rol = 'user' WHERE rol IS NULL OR rol NOT IN ('user', 'admin')`);
        await c.query(`ALTER TABLE usuarios ALTER COLUMN rol SET NOT NULL`);
        await asegurarRestriccion(c, 'usuarios', 'chk_usuarios_rol', `CHECK (rol IN ('user', 'admin'))`);
    });
    await opcional(c, 'usuarios: email único sin importar mayúsculas', async () => {
        await c.query(`CREATE UNIQUE INDEX IF NOT EXISTS ux_usuarios_email_lower ON usuarios (LOWER(email))`);
    });
    await opcional(c, 'juegos/notificaciones: flags 0/1', async () => {
        await c.query(`UPDATE juegos SET activo = 1 WHERE activo IS NULL OR activo NOT IN (0, 1)`);
        await c.query(`UPDATE notificaciones SET leido = CASE WHEN COALESCE(leido, 0) <> 0 THEN 1 ELSE 0 END WHERE leido IS NULL OR leido NOT IN (0, 1)`);
        await c.query(`ALTER TABLE juegos ALTER COLUMN activo SET NOT NULL`);
        await c.query(`ALTER TABLE notificaciones ALTER COLUMN leido SET NOT NULL`);
        await asegurarRestriccion(c, 'juegos', 'chk_juegos_activo', `CHECK (activo IN (0, 1))`);
        await asegurarRestriccion(c, 'notificaciones', 'chk_notificaciones_leido', `CHECK (leido IN (0, 1))`);
    });
    await opcional(c, 'partidas: un récord por usuario y juego', async () => {
        await asegurarRestriccion(c, 'partidas', 'ux_partidas_usuario_juego', `UNIQUE (usuario_id, juego_id)`);
        await asegurarRestriccion(c, 'partidas', 'chk_partidas_puntos', `CHECK (puntos >= 0)`);
    });
    await opcional(c, 'duelos: estado y participantes válidos', async () => {
        await asegurarRestriccion(c, 'duelos', 'chk_duelos_estado', `CHECK (estado IN ('pendiente', 'en_curso', 'finalizado'))`);
        await asegurarRestriccion(c, 'duelos', 'chk_duelos_distintos', `CHECK (retador_id <> retado_id)`);
    });
    await opcional(c, 'amistades: estado válido y sin duplicados', async () => {
        await asegurarRestriccion(c, 'amistades', 'chk_amistades_estado', `CHECK (estado IN ('pendiente', 'aceptada'))`);
        await asegurarRestriccion(c, 'amistades', 'chk_amistades_distintos', `CHECK (usuario1_id <> usuario2_id)`);
    });

    // Únicos de contenido (el seed corre en cada arranque: sin esto
    // ON CONFLICT DO NOTHING no frena nada). Primero se borran duplicados
    // existentes (queda el de menor id). LOWER(): el seed guarda en
    // mayúsculas y el panel admin puede guardar en minúsculas.
    await c.query(`
        DELETE FROM palabras_ahorcado a USING palabras_ahorcado b
        WHERE a.id > b.id AND LOWER(a.palabra) = LOWER(b.palabra)
          AND COALESCE(a.tematica_id, 0) = COALESCE(b.tematica_id, 0);
    `);
    await c.query(`
        DELETE FROM palabras_wordle a USING palabras_wordle b
        WHERE a.id > b.id AND LOWER(a.palabra) = LOWER(b.palabra) AND a.tematica_id = b.tematica_id;
    `);
    await c.query(`
        DELETE FROM adivina_items a USING adivina_items b
        WHERE a.id > b.id AND LOWER(a.respuesta) = LOWER(b.respuesta) AND a.tematica_id = b.tematica_id;
    `);

    const indices = [
        `CREATE UNIQUE INDEX IF NOT EXISTS ux_palabras_ahorcado ON palabras_ahorcado (LOWER(palabra), COALESCE(tematica_id, 0))`,
        `CREATE UNIQUE INDEX IF NOT EXISTS ux_palabras_wordle ON palabras_wordle (LOWER(palabra), tematica_id)`,
        `CREATE UNIQUE INDEX IF NOT EXISTS ux_adivina_items ON adivina_items (LOWER(respuesta), tematica_id)`,
        `CREATE UNIQUE INDEX IF NOT EXISTS ux_adivina_aliases_lower ON adivina_aliases (item_id, LOWER(alias))`,
        `CREATE UNIQUE INDEX IF NOT EXISTS ux_amistades_par ON amistades (LEAST(usuario1_id, usuario2_id), GREATEST(usuario1_id, usuario2_id))`,
        // Índices sobre FKs y consultas frecuentes (Postgres no los crea solo).
        `CREATE INDEX IF NOT EXISTS ix_partidas_ranking ON partidas (juego_id, puntos DESC)`,
        `CREATE INDEX IF NOT EXISTS ix_duelos_retador ON duelos (retador_id)`,
        `CREATE INDEX IF NOT EXISTS ix_duelos_retado ON duelos (retado_id)`,
        `CREATE INDEX IF NOT EXISTS ix_notificaciones_usuario ON notificaciones (usuario_id, leido)`,
        `CREATE INDEX IF NOT EXISTS ix_notificaciones_aviso ON notificaciones (aviso_id)`,
        `CREATE INDEX IF NOT EXISTS ix_avisos_pendientes ON avisos (programado_para) WHERE enviado_en IS NULL`,
        `CREATE INDEX IF NOT EXISTS ix_sanciones_vigentes ON sanciones (usuario_id) WHERE levantada_en IS NULL`,
        `CREATE INDEX IF NOT EXISTS ix_palabras_ahorcado_tematica ON palabras_ahorcado (tematica_id)`,
        `CREATE INDEX IF NOT EXISTS ix_palabras_wordle_tematica ON palabras_wordle (tematica_id)`,
        `CREATE INDEX IF NOT EXISTS ix_adivina_items_tematica ON adivina_items (tematica_id)`,
    ];
    for (const sql of indices) {
        await opcional(c, sql.match(/EXISTS (\w+)/)[1], () => c.query(sql));
    }
}

// ─── 4. Vistas ───
// Devuelven las filas con la forma de antes (opcion_a..d, pista_1..4,
// aliases, ganador_id) armadas desde las tablas normalizadas. Las rutas
// leen de acá; las escrituras van a las tablas.

async function crearVistas(c) {
    // Sanción vigente de cada usuario (la más nueva que no se levantó y, si
    // es temporal, que todavía no venció). "Baneado" = tiene fila acá.
    await c.query(`
        CREATE VIEW v_sanciones_activas AS
        SELECT DISTINCT ON (s.usuario_id)
               s.id, s.usuario_id, s.tipo, s.motivo, s.hasta, s.creado_en, s.creado_por
        FROM sanciones s
        WHERE s.levantada_en IS NULL AND (s.tipo = 'permanente' OR s.hasta > NOW())
        ORDER BY s.usuario_id, s.creado_en DESC;
    `);

    await c.query(`
        CREATE VIEW v_preguntas AS
        SELECT p.id, p.tematica_id, p.pregunta,
               MAX(o.texto) FILTER (WHERE o.letra = 'A') AS opcion_a,
               MAX(o.texto) FILTER (WHERE o.letra = 'B') AS opcion_b,
               MAX(o.texto) FILTER (WHERE o.letra = 'C') AS opcion_c,
               MAX(o.texto) FILTER (WHERE o.letra = 'D') AS opcion_d,
               MAX(o.letra) FILTER (WHERE o.es_correcta) AS respuesta_correcta
        FROM preguntas p
        LEFT JOIN pregunta_opciones o ON o.pregunta_id = p.id
        GROUP BY p.id;
    `);

    await c.query(`
        CREATE VIEW v_adivina_items AS
        SELECT i.id, i.tematica_id, i.respuesta, i.imagen,
               COALESCE((SELECT ARRAY_AGG(a.alias::text ORDER BY a.alias)
                         FROM adivina_aliases a WHERE a.item_id = i.id), '{}'::text[]) AS aliases,
               (SELECT texto FROM adivina_pistas WHERE item_id = i.id AND orden = 1) AS pista_1,
               (SELECT texto FROM adivina_pistas WHERE item_id = i.id AND orden = 2) AS pista_2,
               (SELECT texto FROM adivina_pistas WHERE item_id = i.id AND orden = 3) AS pista_3,
               (SELECT texto FROM adivina_pistas WHERE item_id = i.id AND orden = 4) AS pista_4
        FROM adivina_items i;
    `);

    // Ganador: el de más puntos en un duelo finalizado; NULL = empate o
    // duelo sin terminar.
    await c.query(`
        CREATE VIEW v_duelos AS
        SELECT d.*,
               CASE
                   WHEN d.estado <> 'finalizado' THEN NULL
                   WHEN d.puntos_retador > d.puntos_retado THEN d.retador_id
                   WHEN d.puntos_retado > d.puntos_retador THEN d.retado_id
               END AS ganador_id
        FROM duelos d;
    `);
}

// ─── 5. Datos base ───

async function insertarDatosBase(c) {
    await c.query(`
        INSERT INTO juegos (id, nombre, descripcion) VALUES
        (1, 'Sopa de Letras', 'Encontrar palabras ocultas en una grilla'),
        (2, 'Preguntados', 'Responder preguntas de opción múltiple'),
        (3, 'Termina la Palabra', 'Adivinar una palabra incompleta'),
        (4, 'Ahorcado', 'Adivinar letras antes de perder'),
        (5, 'Adivina la Cosa', 'Adivinar con pistas'),
        (6, 'Adivina la Palabra', 'Adiviná la palabra letra por letra, estilo Wordle, en 5 intentos'),
        (7, 'Pixel Runner', 'Saltá obstáculos y conseguí la mayor puntuación posible'),
        (8, 'Castle Escape', 'Plataformas con trampas escondidas: pisos falsos, flechas y sorpresas')
        ON CONFLICT (id) DO NOTHING;
    `);
    // El juego 8 se llamaba "Salto Traicionero" antes de ser Castle Escape.
    await c.query(`UPDATE juegos SET nombre = 'Castle Escape' WHERE id = 8 AND nombre = 'Salto Traicionero';`);

    await c.query(`
        INSERT INTO tematicas (id, nombre) VALUES
        (1, 'Videojuegos'),
        (2, 'Películas'),
        (3, 'Anime'),
        (4, 'Programación')
        ON CONFLICT (id) DO NOTHING;
    `);

    // Juegos con temáticas: Sopa (1), Preguntados (2), Termina (3),
    // Ahorcado (4), Adivina la Cosa (5) y Adivina la Palabra (6).
    await c.query(`
        INSERT INTO juego_tematica (juego_id, tematica_id)
        SELECT j, t FROM unnest(ARRAY[1, 2, 3, 4, 5, 6]) AS j CROSS JOIN unnest(ARRAY[1, 2, 3, 4]) AS t
        ON CONFLICT DO NOTHING;
    `);

    // Los SERIAL quedan atrás de los id forzados de arriba.
    await c.query(`SELECT setval('juegos_id_seq', (SELECT MAX(id) FROM juegos));`);
    await c.query(`SELECT setval('tematicas_id_seq', (SELECT MAX(id) FROM tematicas));`);

    await c.query(`
        INSERT INTO configuracion_global (clave, valor) VALUES
        ('color_tema', 'dark'),
        ('github_rodrigo', ''),
        ('github_santiago', ''),
        ('github_kevin', ''),
        ('anuncio_texto', ''),
        ('anuncio_activo', 'false'),
        ('repo_url', ''),
        ('mostrar_repo', 'false'),
        ('mostrar_devs', 'true'),
        ('mantenimiento_activo', 'false'),
        ('mantenimiento_mensaje', 'Estamos haciendo mejoras en UniGames. Volvé en un rato.'),
        ('registro_abierto', 'true'),
        ('juegos_ocultos', '[]')
        ON CONFLICT (clave) DO NOTHING;
    `);

    const total = Number((await c.query(`SELECT COUNT(*) FROM usuarios`)).rows[0].count);
    if (total === 0) {
        const default_hash = "$2b$10$ihSR4f22dSpEhjaS8zZBSeliOqGhO4lh/a6.7GGUNieNHRfQOKWP2";
        await c.query(`
            INSERT INTO usuarios (nombre_usuario, email, password_hash, rol) VALUES
            ('rodrigo', 'rodrigo@unigames.com', $1, 'admin'),
            ('kevin', 'kevin@unigames.com', $1, 'admin'),
            ('santiago', 'santiago@unigames.com', $1, 'admin'),
            ('testuser', 'test@unigames.com', $1, 'user')
            ON CONFLICT (nombre_usuario) DO NOTHING;
        `, [default_hash]);
    }
}

// ─── Main ───

async function initDb() {
    console.log('--- Iniciando inicialización de Base de Datos PostgreSQL ---');
    const pool = await getDb();
    // Cliente dedicado: BEGIN/COMMIT tienen que ir por la misma conexión
    // (con pool.query cada consulta puede salir por una distinta).
    const c = await pool.connect();
    let ok = false;

    try {
        await c.query('BEGIN');
        // Las vistas dependen de columnas que se migran: se recrean al final.
        await c.query('DROP VIEW IF EXISTS v_preguntas, v_adivina_items, v_duelos, v_sanciones_activas');

        console.log('Creando tablas...');
        await crearTablas(c);
        await migrarEsquemaViejo(c);
        console.log('Aplicando restricciones e índices...');
        await asegurarRestricciones(c);
        await crearVistas(c);
        console.log('Insertando datos base...');
        await insertarDatosBase(c);

        await c.query('COMMIT');
        ok = true;
        console.log('Base de datos PostgreSQL inicializada exitosamente.');
    } catch (error) {
        await c.query('ROLLBACK');
        console.error('Error al inicializar PostgreSQL:', error);
    } finally {
        c.release();
        process.exit(ok ? 0 : 1);
    }
}

initDb();
