const { execSync } = require('child_process');

console.log('--- Iniciando UniGames ---');
console.log('Paso 1: Configurando Base de Datos PostgreSQL...');

try {
  // Ejecutamos la inicialización de Postgres
  execSync('node database/init_db.js', { stdio: 'inherit' });
  execSync('node database/seed_games.js', { stdio: 'inherit' });
  console.log('Base de datos inicializada correctamente.');
} catch (error) {
  console.error('⚠️ Advertencia: No se pudo ejecutar el script de inicialización de la base de datos.');
  console.error(error.message);
}

console.log('Paso 2: Iniciando el servidor Node.js...');
require('./server.js');
