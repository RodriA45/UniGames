import sqlite3

conexion = sqlite3.connect("unigames.db")
cursor = conexion.cursor()

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

cursor.execute("""
INSERT OR IGNORE INTO juegos (id, nombre, descripcion) VALUES
(1, 'Sopa de Letras', 'Encontrar palabras ocultas en una grilla'),
(2, 'Preguntados', 'Responder preguntas de opción múltiple'),
(3, 'Termina la Palabra', 'Adivinar una palabra incompleta'),
(4, 'Ahorcado', 'Adivinar letras antes de perder'),
(5, 'Adivina la Cosa', 'Adivinar con pistas');
""")

cursor.execute("""
INSERT OR IGNORE INTO tematicas (id, nombre) VALUES
(1, 'Videojuegos'),
(2, 'Películas'),
(3, 'Anime');
""")

cursor.execute("""
INSERT OR IGNORE INTO juego_tematica (juego_id, tematica_id) VALUES
(1, 1), (1, 2), (1, 3),
(2, 1), (2, 2), (2, 3),
(3, 1), (3, 2), (3, 3),
(5, 1), (5, 2), (5, 3);
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS palabras_ahorcado (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    palabra TEXT NOT NULL UNIQUE
);
""")

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

# Insertar palabras para ahorcado
cursor.execute("""
INSERT OR IGNORE INTO palabras_ahorcado (palabra) VALUES
('javascript'), ('python'), ('pokemon'), ('minecraft'), ('naruto'),
('programacion'), ('variable'), ('funcion'), ('algoritmo'), ('teclado'),
('anime'), ('pelicula'), ('videojuego'), ('pantalla'), ('servidor'),
('express'), ('database'), ('frontend'), ('backend'), ('framework'),
('react'), ('github'), ('terminal'), ('interfaz'), ('dragon');
""")

# Insertar algunas preguntas (Temática 1 = Videojuegos)
cursor.execute("""
INSERT OR IGNORE INTO preguntas (tematica_id, pregunta, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta) VALUES
(1, '¿Cuál es el nombre del protagonista de The Legend of Zelda?', 'Zelda', 'Link', 'Mario', 'Luigi', 'B'),
(1, '¿En qué año se lanzó Minecraft oficialmente?', '2009', '2010', '2011', '2012', 'C'),
(2, '¿Quién dirigió la película "Inception" (El Origen)?', 'Steven Spielberg', 'Christopher Nolan', 'Quentin Tarantino', 'James Cameron', 'B'),
(3, '¿Cómo se llama el zorro de nueve colas sellado en Naruto?', 'Shukaku', 'Matatabi', 'Kurama', 'Son Goku', 'C');
""")

conexion.commit()
conexion.close()

print("Base de datos unigames.db creada correctamente.")


