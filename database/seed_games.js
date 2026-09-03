const { getDb } = require('./db');

async function seed() {
    const db = await getDb();
    try {
        console.log('Insertando datos de prueba para los juegos...');

        // 1. Ahorcado
        await db.query(`
            INSERT INTO palabras_ahorcado (palabra, tematica_id) VALUES
            ('MARIO', 1), ('ZELDA', 1), ('MINECRAFT', 1), ('TETRIS', 1),
            ('AVATAR', 2), ('TITANIC', 2), ('MATRIX', 2), ('GLADIADOR', 2),
            ('NARUTO', 3), ('EVANGELION', 3), ('BLEACH', 3), ('AKIRA', 3),
            ('JAVASCRIPT', 4), ('PYTHON', 4), ('POSTGRES', 4), ('REACT', 4)
            ON CONFLICT DO NOTHING;
        `);

        // 2. Preguntados
        await db.query(`
            INSERT INTO preguntas (tematica_id, pregunta, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta) VALUES
            (1, '¿Cuál es el fontanero más famoso de los videojuegos?', 'Luigi', 'Mario', 'Wario', 'Toad', 'b'),
            (1, '¿En qué juego aparece Master Chief?', 'Halo', 'Gears of War', 'Doom', 'Destiny', 'a'),
            (2, '¿Quién dirigió la película Titanic?', 'Steven Spielberg', 'Christopher Nolan', 'James Cameron', 'Quentin Tarantino', 'c'),
            (2, '¿Qué actor interpreta a Neo en Matrix?', 'Brad Pitt', 'Tom Cruise', 'Keanu Reeves', 'Will Smith', 'c'),
            (3, '¿Cómo se llama el protagonista de Dragon Ball?', 'Vegeta', 'Goku', 'Gohan', 'Piccolo', 'b'),
            (3, '¿Qué es el One Piece?', 'Un tesoro', 'Una espada', 'Un barco', 'Una fruta', 'a'),
            (4, '¿Qué significa HTML?', 'HyperText Markup Language', 'HyperText Machine Language', 'HyperToken Markup Language', 'HyperTech Markup Language', 'a'),
            (4, '¿Cuál de estos NO es un lenguaje de programación?', 'Python', 'Java', 'HTML', 'C++', 'c')
            ON CONFLICT DO NOTHING;
        `);

        // 3. Wordle
        await db.query(`
            INSERT INTO palabras_wordle (palabra, tematica_id) VALUES
            ('SONIC', 1), ('MARIO', 1), ('ZELDA', 1),
            ('ROCKY', 2), ('ALIEN', 2), ('SHREK', 2),
            ('GOKUS', 3), ('LUFFY', 3), ('LIGHT', 3),
            ('LINUX', 4), ('ARRAY', 4), ('CLASE', 4)
            ON CONFLICT DO NOTHING;
        `);
        
        // 4. Adivina la Cosa
        await db.query(`
            INSERT INTO adivina_items (tematica_id, respuesta, aliases, imagen, pista_1, pista_2, pista_3, pista_4) VALUES
            (1, 'Pac-Man', 'pacman,pac man', '', 'Es amarillo', 'Come pastillas', 'Lo persiguen fantasmas', 'Es redondo'),
            (2, 'Darth Vader', 'darthvader,vader', '', 'Usa casco negro', 'Respira muy fuerte', 'Tiene un sable de luz rojo', 'Es el padre de Luke'),
            (3, 'Pikachu', 'pika,pikachu', '', 'Es amarillo', 'Tira electricidad', 'No le gusta entrar a la pokébola', 'Su mejor amigo es Ash'),
            (4, 'GitHub', 'git hub,git', '', 'El logo es un gato/pulpo', 'Sirve para guardar código', 'Lo compró Microsoft', 'Usa control de versiones')
            ON CONFLICT DO NOTHING;
        `);

        console.log('¡Datos insertados correctamente!');
    } catch (error) {
        console.error('Error insertando datos:', error);
    } finally {
        process.exit(0);
    }
}

seed();
