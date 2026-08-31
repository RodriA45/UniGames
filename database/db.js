const { Pool } = require('pg');
require('dotenv').config();

let poolInstance = null;

async function getDb() {
    if (poolInstance) return poolInstance;
    
    try {
        poolInstance = new Pool({
            connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/unigames',
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });

        // Test the connection
        await poolInstance.query('SELECT 1');
        console.log('✅ Conectado a PostgreSQL (UniGames)');
        
        return poolInstance;
    } catch (error) {
        console.error('❌ Error crítico al conectar a PostgreSQL:', error);
        process.exit(1);
    }
}

module.exports = { getDb };
