import sqlite3

conexion = sqlite3.connect("unigames.db")
cursor = conexion.cursor()

# ──────────────────────────────────────────────
#  TABLAS BASE (se crean si no existen)
# ──────────────────────────────────────────────

cursor.execute("""
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre_usuario TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    fecha_registro TEXT DEFAULT CURRENT_TIMESTAMP
);
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS juegos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,
    descripcion TEXT,
    activo INTEGER DEFAULT 1
);
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS tematicas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE
);
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS juego_tematica (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    juego_id INTEGER NOT NULL,
    tematica_id INTEGER NOT NULL,
    FOREIGN KEY (juego_id) REFERENCES juegos(id),
    FOREIGN KEY (tematica_id) REFERENCES tematicas(id)
);
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS partidas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    juego_id INTEGER NOT NULL,
    tematica_id INTEGER,
    puntos INTEGER NOT NULL DEFAULT 0,
    fecha TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY (juego_id) REFERENCES juegos(id),
    FOREIGN KEY (tematica_id) REFERENCES tematicas(id)
);
""")

# palabras_ahorcado: se crea ya con tematica_id (NULL = "Normal", sin temática)
# Nota: ya NO tiene UNIQUE global en 'palabra', porque ahora una misma palabra
# puede repetirse en distintas temáticas (se controla duplicado manualmente abajo).
cursor.execute("""
CREATE TABLE IF NOT EXISTS palabras_ahorcado (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    palabra TEXT NOT NULL,
    tematica_id INTEGER,
    FOREIGN KEY (tematica_id) REFERENCES tematicas(id)
);
""")

# Migración desde versiones viejas: la tabla original tenía
# "palabra TEXT NOT NULL UNIQUE" y no tenía columna tematica_id.
# Si detectamos ese esquema viejo, reconstruimos la tabla y reasignamos
# cada palabra vieja a la temática que le corresponde (en vez de mandarlas
# todas a "Normal", que debe quedar solo con palabras cotidianas).
MAPEO_PALABRAS_VIEJAS = {
    'javascript': 4, 'python': 4, 'pokemon': 1, 'minecraft': 1, 'naruto': 3,
    'programacion': 4, 'variable': 4, 'funcion': 4, 'algoritmo': 4,
    'teclado': None, 'anime': 3, 'pelicula': 2, 'videojuego': 1,
    'pantalla': None, 'servidor': 4, 'express': 4, 'database': 4,
    'frontend': 4, 'backend': 4, 'framework': 4, 'react': 4, 'github': 4,
    'terminal': 4, 'interfaz': 4, 'dragon': None,
}

existing_cols = [row[1] for row in cursor.execute("PRAGMA table_info(palabras_ahorcado)").fetchall()]
if 'tematica_id' not in existing_cols:
    cursor.execute("ALTER TABLE palabras_ahorcado RENAME TO palabras_ahorcado_old")
    cursor.execute("""
        CREATE TABLE palabras_ahorcado (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            palabra TEXT NOT NULL,
            tematica_id INTEGER,
            FOREIGN KEY (tematica_id) REFERENCES tematicas(id)
        );
    """)
    for (palabra,) in cursor.execute("SELECT palabra FROM palabras_ahorcado_old").fetchall():
        tematica_id = MAPEO_PALABRAS_VIEJAS.get(palabra, None)
        cursor.execute(
            "INSERT INTO palabras_ahorcado (palabra, tematica_id) VALUES (?, ?)",
            (palabra, tematica_id)
        )
    cursor.execute("DROP TABLE palabras_ahorcado_old")

cursor.execute("""
CREATE TABLE IF NOT EXISTS preguntas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tematica_id INTEGER NOT NULL,
    pregunta TEXT NOT NULL,
    opcion_a TEXT NOT NULL,
    opcion_b TEXT NOT NULL,
    opcion_c TEXT NOT NULL,
    opcion_d TEXT NOT NULL,
    respuesta_correcta TEXT NOT NULL,
    FOREIGN KEY (tematica_id) REFERENCES tematicas(id)
);
""")

# Nueva tabla para el minijuego "Adivina la Palabra" (estilo Wordle).
# Siempre tiene temática (no existe la opción "Normal" para este juego).
cursor.execute("""
CREATE TABLE IF NOT EXISTS palabras_wordle (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    palabra TEXT NOT NULL,
    tematica_id INTEGER NOT NULL,
    FOREIGN KEY (tematica_id) REFERENCES tematicas(id)
);
""")

conexion.commit()

# ──────────────────────────────────────────────
#  DATOS BASE
# ──────────────────────────────────────────────

cursor.execute("""
INSERT OR IGNORE INTO juegos (id, nombre, descripcion) VALUES
(1, 'Sopa de Letras', 'Encontrar palabras ocultas en una grilla'),
(2, 'Preguntados', 'Responder preguntas de opción múltiple'),
(3, 'Termina la Palabra', 'Adivinar una palabra incompleta'),
(4, 'Ahorcado', 'Adivinar letras antes de perder'),
(5, 'Adivina la Cosa', 'Adivinar con pistas'),
(6, 'Adivina la Palabra', 'Adiviná la palabra letra por letra, estilo Wordle, en 5 intentos');
""")

# Temáticas: se agrega "Programación" como 4ta temática (ya usada en el selector del frontend)
cursor.execute("""
INSERT OR IGNORE INTO tematicas (id, nombre) VALUES
(1, 'Videojuegos'),
(2, 'Películas'),
(3, 'Anime'),
(4, 'Programación');
""")

cursor.execute("""
INSERT OR IGNORE INTO juego_tematica (juego_id, tematica_id) VALUES
(1, 1), (1, 2), (1, 3), (1, 4),
(2, 1), (2, 2), (2, 3), (2, 4),
(3, 1), (3, 2), (3, 3), (3, 4),
(5, 1), (5, 2), (5, 3), (5, 4),
(6, 1), (6, 2), (6, 3), (6, 4);
""")

conexion.commit()

# ──────────────────────────────────────────────
#  PALABRAS PARA AHORCADO (con temática + "Normal")
# ──────────────────────────────────────────────

palabras_ahorcado_por_tematica = {
    None: [  # "Normal" -> palabras cotidianas que cualquiera conoce
        'mesa', 'ventana', 'telefono', 'bicicleta', 'escuela', 'hospital',
        'mercado', 'jardin', 'montana', 'desierto', 'oceano', 'biblioteca',
        'semaforo', 'paraguas', 'calendario', 'almohada', 'espejo',
        'chimenea', 'cocina', 'garage', 'zapato', 'sombrero', 'ventilador',
        'escalera', 'lampara',
    ],
    1: [  # Videojuegos
        'pokemon', 'minecraft', 'videojuego', 'joystick', 'consola',
        'nintendo', 'playstation', 'fortnite', 'zelda', 'mario',
        'multijugador', 'control', 'pixeles', 'arcade', 'gamer',
    ],
    2: [  # Películas
        'pelicula', 'cinema', 'director', 'actor', 'guion', 'escena',
        'taquilla', 'estreno', 'subtitulos', 'protagonista', 'trailer',
        'productor', 'hollywood', 'drama', 'comedia',
    ],
    3: [  # Anime
        'anime', 'naruto', 'manga', 'otaku', 'shonen', 'ninja', 'samurai',
        'kawaii', 'sensei', 'dragon', 'goku', 'cosplay', 'mecha',
        'shinigami', 'mangaka',
    ],
    4: [  # Programación
        'javascript', 'python', 'programacion', 'variable', 'funcion',
        'algoritmo', 'teclado', 'servidor', 'express', 'database',
        'frontend', 'backend', 'framework', 'react', 'github',
        'terminal', 'interfaz',
    ],
}

for tematica_id, palabras in palabras_ahorcado_por_tematica.items():
    for palabra in palabras:
        existe = cursor.execute(
            "SELECT 1 FROM palabras_ahorcado WHERE palabra = ? AND tematica_id IS ?",
            (palabra, tematica_id)
        ).fetchone()
        if not existe:
            cursor.execute(
                "INSERT INTO palabras_ahorcado (palabra, tematica_id) VALUES (?, ?)",
                (palabra, tematica_id)
            )

# ──────────────────────────────────────────────
#  PALABRAS PARA "ADIVINA LA PALABRA" (estilo Wordle, hard, con temática)
# ──────────────────────────────────────────────

palabras_wordle_por_tematica = {
    1: [  # Videojuegos
        'minecraft', 'warcraft', 'fortnite', 'starcraft', 'nintendo',
        'katamari', 'overwatch', 'bayonetta', 'splatoon', 'terraria',
        'runescape', 'halflife', 'valorant',
    ],
    2: [  # Películas
        'thriller', 'comedia', 'suspenso', 'guionista', 'animacion',
        'documental', 'narrativa', 'fotografia', 'taquillera',
        'productor', 'hollywood', 'cortometraje',
    ],
    3: [  # Anime
        'mangaka', 'shounen', 'doblaje', 'tsundere', 'shinigami',
        'subtitulado', 'temporada', 'personaje', 'protagonista',
        'villano', 'cosplay', 'opening',
    ],
    4: [  # Programación
        'algoritmo', 'variable', 'funcion', 'servidor', 'framework',
        'terminal', 'interfaz', 'database', 'frontend', 'backend',
        'navegador', 'compilador', 'depuracion',
    ],
}

for tematica_id, palabras in palabras_wordle_por_tematica.items():
    for palabra in palabras:
        existe = cursor.execute(
            "SELECT 1 FROM palabras_wordle WHERE palabra = ? AND tematica_id = ?",
            (palabra, tematica_id)
        ).fetchone()
        if not existe:
            cursor.execute(
                "INSERT INTO palabras_wordle (palabra, tematica_id) VALUES (?, ?)",
                (palabra, tematica_id)
            )

# ──────────────────────────────────────────────
#  PREGUNTAS (Preguntados)
# ──────────────────────────────────────────────

cursor.execute("""
INSERT OR IGNORE INTO preguntas (tematica_id, pregunta, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta) VALUES
(1, '¿Cuál es el nombre del protagonista de The Legend of Zelda?', 'Zelda', 'Link', 'Mario', 'Luigi', 'B'),
(1, '¿En qué año se lanzó Minecraft oficialmente?', '2009', '2010', '2011', '2012', 'C'),
(2, '¿Quién dirigió la película "Inception" (El Origen)?', 'Steven Spielberg', 'Christopher Nolan', 'Quentin Tarantino', 'James Cameron', 'B'),
(3, '¿Cómo se llama el zorro de nueve colas sellado en Naruto?', 'Shukaku', 'Matatabi', 'Kurama', 'Son Goku', 'C');
""")

conexion.commit()
conexion.close()

print("Base de datos unigames.db creada/actualizada correctamente.")
