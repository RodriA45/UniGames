const { Pool } = require('pg');
require('dotenv').config();

let poolInstance = null;

async function getDb() {
    if (poolInstance) return poolInstance;
    
    try {
        const connStr = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/unigames';
        // Las DB en la nube (Supabase, Neon, Render, Railway...) exigen SSL
        // SIEMPRE, en dev y en prod. Antes esto dependía de NODE_ENV === 'production',
        // así que en local (npm run dev) se conectaba sin SSL y el proveedor cortaba
        // la conexión de entrada -> ECONNRESET. Ahora se decide por el host: si NO es
        // localhost/127.0.0.1, se asume que necesita SSL.
        const isLocalHost = /localhost|127\.0\.0\.1/.test(connStr);
        poolInstance = new Pool({
            connectionString: connStr,
            ssl: isLocalHost ? false : { rejectUnauthorized: false }
        });

        // Test the connection
        await poolInstance.query('SELECT 1');
        console.log('Conectado a PostgreSQL (UniGames)');
        
        // --- Capa de compatibilidad SQLite -> PostgreSQL ---
        // Permite que las rutas sigan usando db.get, db.all, db.run y '?' en lugar de '$1'
        const originalQuery = poolInstance.query.bind(poolInstance);
        
        function convertQuery(sql, params) {
            let newSql = '';
            let paramIndex = 1;
            let inString = false;
            for (let i = 0; i < sql.length; i++) {
                const char = sql[i];
                if (char === "'") inString = !inString;
                if (char === '?' && !inString) {
                    newSql += '$' + (paramIndex++);
                } else {
                    newSql += char;
                }
            }
            // Si params no es un array (e.g. un solo valor o undef), lo ajustamos
            const newParams = Array.isArray(params) ? params : (params !== undefined ? [params] : []);
            return { newSql, newParams };
        }

        poolInstance.query = async function(sql, params) {
            if (typeof sql === 'string') {
                const { newSql, newParams } = convertQuery(sql, params);
                return originalQuery(newSql, newParams);
            }
            return originalQuery(sql, params);
        };

        poolInstance.get = async function(sql, params) {
            const { newSql, newParams } = convertQuery(sql, params);
            const res = await originalQuery(newSql, newParams);
            return res.rows[0];
        };

        poolInstance.all = async function(sql, params) {
            const { newSql, newParams } = convertQuery(sql, params);
            const res = await originalQuery(newSql, newParams);
            return res.rows;
        };

        poolInstance.run = async function(sql, params) {
            const { newSql, newParams } = convertQuery(sql, params);
            const res = await originalQuery(newSql, newParams);
            return { changes: res.rowCount }; // Compatible con result.changes de SQLite
        };

        // Transacción: corre fn(client) en una sola conexión entre BEGIN y
        // COMMIT (ROLLBACK si tira error). El client es el de `pg` directo,
        // así que adentro se usan parámetros $1, $2... (no '?').
        poolInstance.transaction = async function(fn) {
            const client = await poolInstance.connect();
            try {
                await client.query('BEGIN');
                const resultado = await fn(client);
                await client.query('COMMIT');
                return resultado;
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            } finally {
                client.release();
            }
        };
        // ----------------------------------------------------
        
        return poolInstance;
    } catch (error) {
        console.error('Error crítico al conectar a PostgreSQL:', error);
        process.exit(1);
    }
}

module.exports = { getDb };
