const { getDb } = require('./database/db');

async function fixWords() {
    try {
        const db = await getDb();
        await db.query("UPDATE palabras_wordle SET palabra = 'GOKU' WHERE palabra = 'GOKUS'");
        await db.query("UPDATE palabras_wordle SET palabra = 'EREN' WHERE palabra = 'ERENS'");
        await db.query("UPDATE palabras_wordle SET palabra = 'LEVI' WHERE palabra = 'LEVIS'");
        console.log("Palabras arregladas en DB.");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
fixWords();
