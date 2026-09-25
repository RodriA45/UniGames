const { getDb } = require('./db');

async function seed() {
    const db = await getDb();
    try {
        console.log('Insertando datos de prueba para los juegos...');

        // 1. Ahorcado
        await db.query(`
            INSERT INTO palabras_ahorcado (palabra, tematica_id) VALUES
            ('MARIO', 1), ('ZELDA', 1), ('MINECRAFT', 1), ('TETRIS', 1), ('SONIC', 1), ('PORTAL', 1), ('FALLOUT', 1), ('SKYRIM', 1), ('PACMAN', 1), ('DOOM', 1), ('HALO', 1),
            ('AVATAR', 2), ('TITANIC', 2), ('MATRIX', 2), ('GLADIADOR', 2), ('ALIEN', 2), ('ROCKY', 2), ('SHREK', 2), ('TERMINATOR', 2), ('INCEPTION', 2), ('JURASSIC', 2),
            ('NARUTO', 3), ('EVANGELION', 3), ('BLEACH', 3), ('AKIRA', 3), ('GOKU', 3), ('LUFFY', 3), ('LIGHT', 3), ('INUYASHA', 3), ('SAILOR', 3), ('POKEMON', 3),
            ('JAVASCRIPT', 4), ('PYTHON', 4), ('POSTGRES', 4), ('REACT', 4), ('NODEJS', 4), ('TYPESCRIPT', 4), ('HTML', 4), ('CSS', 4), ('JAVA', 4), ('DOCKER', 4)
            ON CONFLICT DO NOTHING;
        `);

        // 2. Preguntados
        await db.query(`
            INSERT INTO preguntas (tematica_id, pregunta, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta) VALUES
            (1, '¿Cuál es el fontanero más famoso de los videojuegos?', 'Luigi', 'Mario', 'Wario', 'Toad', 'b'),
            (1, '¿En qué juego aparece Master Chief?', 'Halo', 'Gears of War', 'Doom', 'Destiny', 'a'),
            (1, '¿Cuál de estos juegos fue creado por Markus Persson (Notch)?', 'Roblox', 'Terraria', 'Minecraft', 'Rust', 'c'),
            (1, '¿En qué año salió la primera consola PlayStation?', '1992', '1994', '1996', '1998', 'b'),
            (1, '¿Cómo se llama la princesa en The Legend of Zelda?', 'Zelda', 'Peach', 'Daisy', 'Rosalina', 'a'),
            (1, '¿Cuál es la consola más vendida de la historia?', 'PS2', 'PS4', 'Nintendo DS', 'Game Boy', 'a'),
            (1, '¿Qué empresa desarrolló el juego Fortnite?', 'Valve', 'Riot Games', 'Epic Games', 'Blizzard', 'c'),
            (1, '¿En qué juego la moneda es el "Baya" o "Bell"?', 'Animal Crossing', 'Harvest Moon', 'Stardew Valley', 'The Sims', 'a'),
            (1, '¿Cuál es el apellido de Solid en Metal Gear?', 'Snake', 'Fox', 'Wolf', 'Hound', 'a'),
            (1, '¿En qué ciudad ocurre GTA Vice City?', 'Los Santos', 'Liberty City', 'Vice City', 'San Fierro', 'c'),

            (2, '¿Quién dirigió la película Titanic?', 'Steven Spielberg', 'Christopher Nolan', 'James Cameron', 'Quentin Tarantino', 'c'),
            (2, '¿Qué actor interpreta a Neo en Matrix?', 'Brad Pitt', 'Tom Cruise', 'Keanu Reeves', 'Will Smith', 'c'),
            (2, '¿Qué película ganó el Oscar a Mejor Película en 2020?', '1917', 'Joker', 'Parasite', 'Once Upon a Time in Hollywood', 'c'),
            (2, '¿Cuál es la primera regla del Club de la Pelea?', 'No hablar del club', 'Llegar a tiempo', 'Pelear sin camisa', 'No hay reglas', 'a'),
            (2, '¿Cómo se llama el villano de Avengers: Infinity War?', 'Loki', 'Ultron', 'Thanos', 'Galactus', 'c'),
            (2, '¿En qué año se estrenó Jurassic Park?', '1990', '1993', '1995', '1997', 'b'),
            (2, '¿Qué película de Disney trata sobre emociones antropomórficas?', 'Up', 'Inside Out', 'Soul', 'Coco', 'b'),
            (2, '¿Cuál es el nombre del protagonista en "Volver al Futuro"?', 'Doc Brown', 'Marty McFly', 'Biff Tannen', 'George McFly', 'b'),
            (2, '¿Qué mago es famoso por tener una cicatriz de rayo?', 'Gandalf', 'Dumbledore', 'Harry Potter', 'Merlin', 'c'),
            (2, '¿Cuál es la película más taquillera de todos los tiempos?', 'Avatar', 'Avengers: Endgame', 'Titanic', 'Star Wars', 'a'),

            (3, '¿Cómo se llama el protagonista de Dragon Ball?', 'Vegeta', 'Goku', 'Gohan', 'Piccolo', 'b'),
            (3, '¿Qué es el One Piece?', 'Un tesoro', 'Una espada', 'Un barco', 'Una fruta', 'a'),
            (3, '¿Cómo se llama el espíritu en forma de zorro que tiene Naruto?', 'Shukaku', 'Matatabi', 'Kurama', 'Gyuki', 'c'),
            (3, '¿Qué anime trata sobre el alquimista de acero?', 'Fullmetal Alchemist', 'Bleach', 'Fairy Tail', 'Black Clover', 'a'),
            (3, '¿Quién es el creador de Neon Genesis Evangelion?', 'Hayao Miyazaki', 'Hideaki Anno', 'Masashi Kishimoto', 'Akira Toriyama', 'b'),
            (3, '¿En Attack on Titan, cuál es el muro más externo?', 'Muro Rose', 'Muro Sina', 'Muro Maria', 'Muro Sheena', 'c'),
            (3, '¿Qué nombre recibe la libreta en Death Note?', 'Death Note', 'Life Note', 'Shinigami Note', 'Kill Note', 'a'),
            (3, '¿Cómo se llama la técnica principal de Goku?', 'Rasengan', 'Kamehameha', 'Chidori', 'Genkidama', 'b'),
            (3, '¿Cuál de estos Pokémon es tipo planta?', 'Charmander', 'Squirtle', 'Bulbasaur', 'Pikachu', 'c'),
            (3, '¿Qué estudio de animación creó "El Viaje de Chihiro"?', 'Toei Animation', 'Studio Ghibli', 'Madhouse', 'Bones', 'b'),

            (4, '¿Qué significa HTML?', 'HyperText Markup Language', 'HyperText Machine Language', 'HyperToken Markup Language', 'HyperTech Markup Language', 'a'),
            (4, '¿Cuál de estos NO es un lenguaje de programación?', 'Python', 'Java', 'HTML', 'C++', 'c'),
            (4, '¿En qué año fue creado JavaScript?', '1990', '1995', '2000', '2005', 'b'),
            (4, '¿Qué significa CSS?', 'Cascading Style Sheets', 'Creative Style System', 'Computer Style Sheets', 'Colorful Style Sheets', 'a'),
            (4, '¿Cuál de estos es un sistema de control de versiones?', 'Docker', 'Git', 'Jenkins', 'Kubernetes', 'b'),
            (4, '¿Qué lenguaje se usa principalmente para iOS?', 'Java', 'Kotlin', 'Swift', 'C#', 'c'),
            (4, '¿Cuál es la base de datos relacional más usada de código abierto?', 'MongoDB', 'MySQL', 'Redis', 'Cassandra', 'b'),
            (4, '¿Qué significa API?', 'Application Programming Interface', 'Advanced Programming Interface', 'Automated Programming Interface', 'Application Process Interface', 'a'),
            (4, '¿En Python, cómo se define una función?', 'function()', 'def', 'func', 'define', 'b'),
            (4, '¿Qué empresa desarrolló React?', 'Google', 'Microsoft', 'Facebook', 'Amazon', 'c')
            ON CONFLICT DO NOTHING;
        `);

        // 3. Wordle
        await db.query(`
            INSERT INTO palabras_wordle (palabra, tematica_id) VALUES
            ('SONIC', 1), ('MARIO', 1), ('ZELDA', 1), ('KIRBY', 1), ('YOSHI', 1), ('LUIGI', 1), ('TETRA', 1), ('FINAL', 1), ('FIGHT', 1), ('PUNCH', 1),
            ('ROCKY', 2), ('ALIEN', 2), ('SHREK', 2), ('JOKER', 2), ('RAMBO', 2), ('VADER', 2), ('FRODO', 2), ('BLADE', 2), ('SEVEN', 2), ('MULAN', 2),
            ('GOKUS', 3), ('LUFFY', 3), ('LIGHT', 3), ('GOHAN', 3), ('BULMA', 3), ('BROLY', 3), ('ERENS', 3), ('LEVIS', 3), ('OTAKU', 3), ('NINJA', 3),
            ('LINUX', 4), ('ARRAY', 4), ('CLASE', 4), ('REACT', 4), ('SWIFT', 4), ('REDUX', 4), ('MOUSE', 4), ('PIXEL', 4), ('BYTES', 4), ('CLICK', 4)
            ON CONFLICT DO NOTHING;
        `);
        
        // 4. Adivina la Cosa
        // aliases va como JSON (array), igual que lo guarda el panel admin:
        // /api/adivina/items lo lee con JSON.parse.
        await db.query(`
            INSERT INTO adivina_items (tematica_id, respuesta, aliases, imagen, pista_1, pista_2, pista_3, pista_4) VALUES
            (1, 'Pac-Man', '["pacman", "pac man"]', '', 'Es amarillo', 'Come pastillas', 'Lo persiguen fantasmas', 'Es redondo'),
            (1, 'Mario Bros', '["mario", "super mario"]', '', 'Es un fontanero', 'Salta mucho', 'Rescata princesas', 'Come hongos'),
            (1, 'Minecraft', '["mine", "minecraft"]', '', 'Todo es de bloques', 'Sobrevives en la noche', 'Haces crafteos', 'Cuidado con los Creepers'),
            (2, 'Darth Vader', '["darthvader", "vader"]', '', 'Usa casco negro', 'Respira muy fuerte', 'Tiene un sable de luz rojo', 'Es el padre de Luke'),
            (2, 'Harry Potter', '["harry", "potter"]', '', 'Es un mago', 'Va a una escuela de magia', 'Tiene una cicatriz', 'Usa varita'),
            (2, 'Spiderman', '["spider", "spiderman", "peter parker"]', '', 'Superhéroe de Marvel', 'Tira telarañas', 'Tiene sentido arácnido', 'Le picó un bicho'),
            (3, 'Pikachu', '["pika", "pikachu"]', '', 'Es amarillo', 'Tira electricidad', 'No le gusta entrar a la pokébola', 'Su mejor amigo es Ash'),
            (3, 'Goku', '["goku", "kakaroto"]', '', 'Es un Sayayin', 'Pelo de punta', 'Lucha por proteger la tierra', 'Busca las esferas del dragón'),
            (3, 'Totoro', '["totoro", "mi vecino totoro"]', '', 'Película de Ghibli', 'Espíritu del bosque grande', 'Pelo gris y panzón', 'Espera el autobús con paraguas'),
            (4, 'GitHub', '["git hub", "git"]', '', 'El logo es un gato/pulpo', 'Sirve para guardar código', 'Lo compró Microsoft', 'Usa control de versiones'),
            (4, 'Stack Overflow', '["stackoverflow", "stack"]', '', 'Web para programadores', 'Donde copias y pegas código', 'Resuelve tus dudas', 'El logo es un pilar de papeles'),
            (4, 'Teclado', '["teclado", "keyboard"]', '', 'Es hardware', 'Tiene teclas', 'Haces ruido al escribir', 'Usas WASD para jugar')
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
