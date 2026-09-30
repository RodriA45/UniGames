require('dotenv').config();
const { getDb } = require('./database/db');

async function run() {
    const db = await getDb();
    
    console.log('Insertando mas datos...');

    // Ahorcado
    await db.query(`
        INSERT INTO palabras_ahorcado (palabra, tematica_id) VALUES
        ('BORDERLANDS', 1), ('SEKIRO', 1), ('CELESTE', 1), ('BLOODBORNE', 1), ('WARCRAFT', 1), ('STARCRAFT', 1), ('DIABLO', 1), ('VALORANT', 1), ('OVERWATCH', 1),
        ('INTERSTELLAR', 2), ('GODFATHER', 2), ('SPIDERMAN', 2), ('BATMAN', 2), ('SUPERMAN', 2), ('AVENGERS', 2), ('HALLOWEEN', 2), ('DEADPOOL', 2), ('JUMANJI', 2), ('TOYSTORY', 2),
        ('ALCHEMIST', 3), ('BERSERK', 3), ('JOJO', 3), ('HUNTER', 3), ('GINTAMA', 3), ('HAIKYUU', 3), ('FAIRYTAIL', 3), ('DEMONSLAYER', 3), ('JUJUTSU', 3), ('CHAINSAW', 3),
        ('ANGULAR', 4), ('VUE', 4), ('SVELTE', 4), ('MYSQL', 4), ('MONGODB', 4), ('KOTLIN', 4), ('RUBY', 4), ('GOLANG', 4), ('RUST', 4)
        ON CONFLICT DO NOTHING;
    `);

    // Wordle
    await db.query(`
        INSERT INTO palabras_wordle (palabra, tematica_id) VALUES
        ('CRASH', 1), ('SMASH', 1), ('GHOST', 1), ('SHEIK', 1), ('CLOUD', 1), ('CHIEF', 1), ('STEAM', 1), ('LEVEL', 1), ('SPAWN', 1),
        ('OSCAR', 2), ('ACTOR', 2), ('GUION', 2), ('CINTA', 2), ('CLON', 2), ('SIMBA', 2), ('STARK', 2), ('BRUCE', 2), ('BONES', 2),
        ('MANGA', 3), ('MECHA', 3), ('MAGIA', 3), ('TITAN', 3), ('GHOUL', 3), ('STAND', 3), ('SHINJ', 3), ('SAIYA', 3), ('AKIRA', 3),
        ('LOGIC', 4), ('BATCH', 4), ('CACHE', 4), ('MACRO', 4), ('QUERY', 4), ('SHELL', 4), ('TOKEN', 4), ('DEBUG', 4), ('FLOAT', 4), ('STATE', 4)
        ON CONFLICT DO NOTHING;
    `);

    // Preguntados
    await db.query(`
        INSERT INTO preguntas (tematica_id, pregunta, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta) VALUES
        (1, '¿Qué compañía creó a Sonic the Hedgehog?', 'SEGA', 'Nintendo', 'Sony', 'Capcom', 'a'),
        (1, '¿En qué juego eres el "Sangre de Dragón" (Dragonborn)?', 'The Witcher 3', 'Skyrim', 'Dark Souls', 'Dragon Age', 'b'),
        (1, '¿Cuál es la ciudad submarina de BioShock?', 'Rapture', 'Columbia', 'Atlantis', 'City 17', 'a'),
        (2, '¿Quién es el protagonista de "El Padrino"?', 'Vito Corleone', 'Tony Montana', 'Henry Hill', 'Michael Corleone', 'a'),
        (2, '¿De qué color es el sable de luz de Yoda?', 'Azul', 'Rojo', 'Verde', 'Morado', 'c'),
        (2, '¿En "Toy Story", cómo se llama el niño dueño de los juguetes?', 'Sid', 'Andy', 'Tommy', 'Billy', 'b'),
        (3, '¿Cuál es el nombre real de L en Death Note?', 'L Lawliet', 'Light Yagami', 'Nate River', 'Mihael Keehl', 'a'),
        (3, '¿En "Jujutsu Kaisen", quién es el recipiente de Sukuna?', 'Megumi Fushiguro', 'Yuji Itadori', 'Satoru Gojo', 'Nobara Kugisaki', 'b'),
        (3, '¿Cómo se llama la hermana de Tanjiro en Demon Slayer?', 'Nezuko', 'Shinobu', 'Mitsuri', 'Kanao', 'a'),
        (4, '¿Qué significa SQL?', 'Structured Query Language', 'Standard Query Language', 'Simple Query Language', 'System Query Language', 'a'),
        (4, '¿En Git, qué comando se usa para subir los cambios al repositorio remoto?', 'git pull', 'git commit', 'git push', 'git add', 'c'),
        (4, '¿Cuál de estos es un framework de PHP?', 'Django', 'Laravel', 'Spring', 'Express', 'b')
        ON CONFLICT DO NOTHING;
    `);

    console.log('Nuevos datos agregados!');
    process.exit(0);
}
run();
