require('dotenv').config();
const { getDb } = require('./database/db');

async function run() {
    const db = await getDb();
    await db.query("UPDATE palabras_wordle SET palabra = 'GOKU' WHERE palabra = 'GOKUS'");
    await db.query("UPDATE palabras_wordle SET palabra = 'EREN' WHERE palabra = 'ERENS'");
    await db.query("UPDATE palabras_wordle SET palabra = 'LEVI' WHERE palabra = 'LEVIS'");
    await db.query("UPDATE palabras_ahorcado SET palabra = 'GOKU' WHERE palabra = 'GOKUS'");
    console.log('Fixed DB');
    process.exit(0);
}
run();
