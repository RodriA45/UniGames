const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

let dbInstance = null;

async function getDb() {
    if (dbInstance) return dbInstance;
    
    try {
        dbInstance = await open({
            filename: path.join(__dirname, '..', 'unigames.db'),
            driver: sqlite3.Database
        });
        await dbInstance.exec('PRAGMA foreign_keys = ON');
        console.log('✅ Conectado a unigames.db (SQLite)');
        return dbInstance;
    } catch (error) {
        console.error('❌ Error crítico al conectar a la base de datos:', error);
        process.exit(1);
    }
}

module.exports = { getDb };
