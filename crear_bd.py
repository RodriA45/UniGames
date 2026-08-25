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
    fecha_registro TEXT DEFAULT CURRENT_TIMESTAMP,
    rol TEXT DEFAULT 'user',
    estado TEXT DEFAULT 'activo'
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
    FOREIGN KEY (tematica_id) REFERENCES tematicas(id),
    UNIQUE(tematica_id, pregunta)
);
""")

# Migración: si la tabla ya existe sin UNIQUE, limpiar duplicados y recrear con constraint.
cols_preg = [r[1] for r in cursor.execute("PRAGMA table_info(preguntas)").fetchall()]
idx_preg  = [r[1] for r in cursor.execute("PRAGMA index_list(preguntas)").fetchall()]
has_unique = any('pregunta' in i or 'unique' in i.lower() for i in idx_preg)
if not has_unique:
    # Quedarse solo con el primer id por (tematica_id, pregunta)
    cursor.execute("""
        DELETE FROM preguntas WHERE id NOT IN (
            SELECT MIN(id) FROM preguntas GROUP BY tematica_id, pregunta
        )
    """)
    # Recrear tabla con UNIQUE
    cursor.execute("ALTER TABLE preguntas RENAME TO preguntas_old")
    cursor.execute("""
        CREATE TABLE preguntas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tematica_id INTEGER NOT NULL,
            pregunta TEXT NOT NULL,
            opcion_a TEXT NOT NULL,
            opcion_b TEXT NOT NULL,
            opcion_c TEXT NOT NULL,
            opcion_d TEXT NOT NULL,
            respuesta_correcta TEXT NOT NULL,
            FOREIGN KEY (tematica_id) REFERENCES tematicas(id),
            UNIQUE(tematica_id, pregunta)
        )
    """)
    cursor.execute("""
        INSERT INTO preguntas SELECT * FROM preguntas_old
    """)
    cursor.execute("DROP TABLE preguntas_old")

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

cursor.execute("""
CREATE TABLE IF NOT EXISTS avisos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    texto TEXT NOT NULL,
    icono TEXT DEFAULT '📢',
    color TEXT DEFAULT '#3b82f6',
    activo INTEGER DEFAULT 0,
    fecha_creacion TEXT DEFAULT CURRENT_TIMESTAMP
);
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS configuracion_global (
    clave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
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
(6, 'Adivina la Palabra', 'Adiviná la palabra letra por letra, estilo Wordle, en 5 intentos'),
(7, 'Pixel Runner', 'Saltá obstáculos y conseguí la mayor puntuación posible'),
(8, 'Salto Traicionero', 'Plataformas con trampas escondidas: pisos falsos, flechas y sorpresas');
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
        'escalera', 'lampara', 'computadora', 'televisor', 'cuchara',
        'tenedor', 'cuchillo', 'campera', 'zapatillas', 'pantalon', 'reloj', 'cuaderno'
    ],
    1: [  # Videojuegos
        'pokemon', 'minecraft', 'videojuego', 'joystick', 'consola',
        'nintendo', 'playstation', 'fortnite', 'zelda', 'mario',
        'multijugador', 'control', 'pixeles', 'arcade', 'gamer',
        'tetris', 'pacman', 'supermario', 'bloodborne', 'sekiro',
        'skyrim', 'fallout', 'doom', 'mortal kombat'
    ],
    2: [  # Películas
        'pelicula', 'cinema', 'director', 'actor', 'guion', 'escena',
        'taquilla', 'estreno', 'subtitulos', 'protagonista', 'trailer',
        'productor', 'hollywood', 'drama', 'comedia', 'avatar', 'titanic',
        'gladiador', 'matrix', 'rocky', 'terminator', 'alien', 'jurassic park', 'batman'
    ],
    3: [  # Anime
        'anime', 'naruto', 'manga', 'otaku', 'shonen', 'ninja', 'samurai',
        'kawaii', 'sensei', 'dragon', 'goku', 'cosplay', 'mecha',
        'shinigami', 'mangaka', 'bleach', 'one piece', 'hunterxhunter',
        'evangelion', 'sailormoon', 'akira', 'ghibli', 'jojos', 'my hero academia'
    ],
    4: [  # Programación
        'javascript', 'python', 'programacion', 'variable', 'funcion',
        'algoritmo', 'teclado', 'servidor', 'express', 'database',
        'frontend', 'backend', 'framework', 'react', 'github',
        'terminal', 'interfaz', 'html', 'css', 'typescript', 'angular',
        'vue', 'linux', 'ubuntu', 'docker', 'kubernetes', 'aws'
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
        'runescape', 'halflife', 'valorant', 'tetris', 'pacman',
        'skyrim', 'fallout', 'sekiro', 'roblox', 'tekken', 'mario', 'sonic'
    ],
    2: [  # Películas
        'thriller', 'comedia', 'suspenso', 'guionista', 'animacion',
        'documental', 'narrativa', 'fotografia', 'taquillera',
        'productor', 'hollywood', 'cortometraje', 'avatar', 'titanic',
        'matrix', 'rocky', 'alien', 'batman', 'marvel', 'oscar', 'shrek'
    ],
    3: [  # Anime
        'mangaka', 'shounen', 'doblaje', 'tsundere', 'shinigami',
        'subtitulado', 'temporada', 'personaje', 'protagonista',
        'villano', 'cosplay', 'opening', 'bleach', 'akira', 'ghibli',
        'jojos', 'gintama', 'naruto', 'boruto', 'seinen', 'isekai'
    ],
    4: [  # Programación
        'algoritmo', 'variable', 'funcion', 'servidor', 'framework',
        'terminal', 'interfaz', 'database', 'frontend', 'backend',
        'navegador', 'compilador', 'depuracion', 'linux', 'docker',
        'ubuntu', 'react', 'angular', 'github', 'agile', 'scrum', 'python'
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

# Limpiar preguntas near-duplicadas que pudieron quedar de versiones anteriores
# (mismo significado pero texto levemente distinto — el INSERT OR IGNORE no las atrapa)
preguntas_a_eliminar = [
    # Videojuegos
    (1, '¿Cómo se llama el caballo de Link en Ocarina of Time?'),
    # Películas
    (2, '¿Qué actor interpreta a Iron Man en el UCM?'),
    (2, '¿Cómo se llama el protagonista de "The Matrix"?'),
    (2, 'En "El Rey León", ¿cómo se llama el padre de Simba?'),
    (2, '¿Cuántas películas conforman la trilogía de El Señor de los Anillos?'),
    # Anime
    (3, '¿Cómo se llama el protagonista de "Shingeki no Kyojin"?'),
    # Programación
    (4, '¿Qué hace "console.log()" en JavaScript?'),
    (4, '¿Qué símbolo se usa para comentarios de una línea en Python?'),
    (4, '¿Qué estructura de datos usa el principio LIFO?'),
    (4, '¿Qué método de array devuelve un nuevo array transformado en JS?'),
]
for (tid, preg) in preguntas_a_eliminar:
    cursor.execute("DELETE FROM preguntas WHERE tematica_id = ? AND pregunta = ?", (tid, preg))

conexion.commit()

cursor.execute("""
INSERT OR IGNORE INTO preguntas (tematica_id, pregunta, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta) VALUES
-- Videojuegos (Temática 1)
(1, '¿Cuál es el nombre del protagonista de The Legend of Zelda?', 'Zelda', 'Link', 'Mario', 'Luigi', 'B'),
(1, '¿En qué año se lanzó Minecraft oficialmente?', '2009', '2010', '2011', '2012', 'C'),
(1, '¿Qué empresa desarrolló el juego "Half-Life"?', 'Valve', 'Epic Games', 'Blizzard', 'Bethesda', 'A'),
(1, '¿Cómo se llama el villano principal de la saga Super Mario?', 'Wario', 'Donkey Kong', 'Bowser', 'Waluigi', 'C'),
(1, '¿En qué juego aparece el personaje "Master Chief"?', 'Gears of War', 'Halo', 'Destiny', 'Mass Effect', 'B'),
(1, '¿Cuál es el juego más vendido de la historia (hasta 2023)?', 'Tetris', 'Minecraft', 'GTA V', 'Wii Sports', 'B'),
(1, '¿En qué año se lanzó el primer juego de Pokémon?', '1994', '1995', '1996', '1997', 'C'),
(1, '¿Cómo se llama el caballo de Link en The Legend of Zelda: Ocarina of Time?', 'Rocinante', 'Epona', 'Binky', 'Agro', 'B'),
(1, '¿Qué empresa creó la consola PlayStation?', 'Nintendo', 'Microsoft', 'Sony', 'Sega', 'C'),
(1, '¿Cuál es el nombre del protagonista de God of War?', 'Kratos', 'Dante', 'Geralt', 'Ezio', 'A'),

-- Películas (Temática 2)
(2, '¿Quién dirigió la película "Inception" (El Origen)?', 'Steven Spielberg', 'Christopher Nolan', 'Quentin Tarantino', 'James Cameron', 'B'),
(2, '¿Qué actor interpreta a Iron Man en el Universo Cinematográfico de Marvel?', 'Chris Evans', 'Chris Hemsworth', 'Robert Downey Jr.', 'Mark Ruffalo', 'C'),
(2, '¿En qué año se estrenó la primera película de "Star Wars"?', '1977', '1980', '1983', '1975', 'A'),
(2, '¿Qué película ganó el Oscar a Mejor Película en 2020?', 'Joker', '1917', 'Parasite', 'Once Upon a Time in Hollywood', 'C'),
(2, '¿Cómo se llama el personaje principal de "The Matrix"?', 'Morpheus', 'Neo', 'Trinity', 'Agent Smith', 'B'),
(2, 'En la película "El Rey León", ¿cómo se llama el padre de Simba?', 'Scar', 'Timón', 'Pumba', 'Mufasa', 'D'),
(2, '¿Cuántas películas conforman la trilogía original de El Señor de los Anillos?', '2', '3', '4', '6', 'B'),
(2, '¿Quién compuso la música de la saga Star Wars?', 'Hans Zimmer', 'John Williams', 'Ennio Morricone', 'Danny Elfman', 'B'),
(2, '¿En qué película aparece el personaje "Forrest Gump"?', 'Cast Away', 'Philadelphia', 'Forrest Gump', 'The Green Mile', 'C'),
(2, '¿De qué país es la película "Parasite" que ganó el Oscar 2020?', 'China', 'Japón', 'Tailandia', 'Corea del Sur', 'D'),

-- Anime (Temática 3)
(3, '¿Cómo se llama el zorro de nueve colas sellado en Naruto?', 'Shukaku', 'Matatabi', 'Kurama', 'Son Goku', 'C'),
(3, '¿Cuál es el verdadero nombre de "L" en Death Note?', 'Light Yagami', 'L Lawliet', 'Nate River', 'Mihael Keehl', 'B'),
(3, '¿Qué busca el protagonista en "One Piece"?', 'El tesoro One Piece', 'Ser Hokage', 'Las Esferas del Dragón', 'Vengar a su clan', 'A'),
(3, '¿Cómo se llama el protagonista de "Shingeki no Kyojin" (Attack on Titan)?', 'Levi', 'Eren', 'Mikasa', 'Armin', 'B'),
(3, '¿De qué anime es el personaje "Edward Elric"?', 'Bleach', 'Fairy Tail', 'Fullmetal Alchemist', 'Sword Art Online', 'C'),
(3, '¿Cuál es la técnica característica de Goku en Dragon Ball?', 'Rasengan', 'Getsuga Tenshou', 'Chidori', 'Kamehameha', 'D'),
(3, '¿En qué ciudad transcurre gran parte de Shingeki no Kyojin?', 'Ciudad de las Paredes', 'Tokyo-3', 'Konohagakure', 'Soul Society', 'A'),
(3, '¿Cómo se llama el dios de la muerte en Death Note?', 'Ryuk', 'Rem', 'Jealous', 'Armonia', 'A'),
(3, '¿Qué tipo de fruta otorga poderes en One Piece?', 'Fruta del Demonio', 'Fruta del Diablo', 'Fruta Akuma', 'Fruta del Poder', 'B'),
(3, '¿Cuántos miembros tiene el grupo Akatsuki en Naruto Shippuden?', '7', '8', '9', '10', 'D'),

-- Programación (Temática 4)
(4, '¿Qué significa HTML?', 'Hyper Text Markup Language', 'High Text Machine Language', 'Hyper Tool Multi Language', 'Hyper Text Multiple Links', 'A'),
(4, '¿Cuál de estos NO es un lenguaje de programación?', 'Python', 'Java', 'HTML', 'C++', 'C'),
(4, '¿Qué hace la función "console.log()" en JavaScript?', 'Muestra un mensaje en la consola', 'Guarda datos en base de datos', 'Cierra el programa', 'Borra la consola', 'A'),
(4, '¿Qué significa CSS?', 'Computer Style Sheets', 'Cascading Style Sheets', 'Creative Style System', 'Colorful Style Sheets', 'B'),
(4, '¿Qué símbolo se usa comúnmente para comentarios de una línea en Python?', '//', '/*', '<!--', '#', 'D'),
(4, '¿Qué estructura de datos usa el principio LIFO (Last In, First Out)?', 'Cola (Queue)', 'Pila (Stack)', 'Árbol', 'Grafo', 'B'),
(4, '¿Cuál es la extensión de un archivo JavaScript?', '.java', '.js', '.jscript', '.jsx', 'B'),
(4, '¿Qué método de array en JavaScript devuelve un nuevo array con elementos transformados?', 'filter()', 'forEach()', 'map()', 'reduce()', 'C'),
(4, '¿Qué significa SQL?', 'Structured Query Language', 'Simple Query Logic', 'Scalable Query Language', 'Stored Query Logic', 'A'),
(4, '¿Cuál de estos es un sistema de control de versiones?', 'Docker', 'Git', 'Node', 'Webpack', 'B');
""")

# --- Usuarios por defecto y Configuración Global ---
cursor.execute("SELECT COUNT(*) FROM usuarios")
if cursor.fetchone()[0] == 0:
    print("Insertando usuarios por defecto...")
    default_hash = "$2b$10$ihSR4f22dSpEhjaS8zZBSeliOqGhO4lh/a6.7GGUNieNHRfQOKWP2" # pre-hashed for Render
    usuarios_default = [
        ('rodrigo', 'rodrigo@unigames.com', default_hash, 'admin'),
        ('kevin', 'kevin@unigames.com', default_hash, 'admin'),
        ('santiago', 'santiago@unigames.com', default_hash, 'admin'),
        ('testuser', 'test@unigames.com', default_hash, 'user')
    ]
    cursor.executemany("INSERT INTO usuarios (nombre_usuario, email, password_hash, rol) VALUES (?, ?, ?, ?)", usuarios_default)
    print("Usuarios de prueba insertados.")

cursor.execute("SELECT COUNT(*) FROM configuracion_global")
if cursor.fetchone()[0] == 0:
    print("Insertando configuracion por defecto...")
    config_default = [
        ('color_tema', 'dark'),
        ('github_rodrigo', ''),
        ('github_santiago', ''),
        ('github_kevin', ''),
        ('anuncio_texto', ''),
        ('anuncio_activo', 'false'),
        ('repo_url', ''),
        ('mostrar_repo', 'false'),
        ('mostrar_devs', 'true')
    ]
    cursor.executemany("INSERT INTO configuracion_global (clave, valor) VALUES (?, ?)", config_default)
    print("Configuracion insertada.")

conexion.commit()
conexion.close()

print("Base de datos unigames.db creada/actualizada correctamente.")

