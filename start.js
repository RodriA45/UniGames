const { execSync } = require('child_process');

console.log('--- Iniciando UniGames ---');
console.log('Paso 1: Configurando Base de Datos SQLite...');

try {
  try {
    // Intenta con python3 (típico en Render/Linux)
    execSync('python3 crear_bd.py', { stdio: 'inherit' });
  } catch (err) {
    // Si falla, intenta con python (típico en Windows)
    execSync('python crear_bd.py', { stdio: 'inherit' });
  }
  console.log('Base de datos inicializada correctamente.');
} catch (error) {
  console.error('⚠️ Advertencia: No se pudo ejecutar el script de base de datos de Python. Si la DB no existe, la app podría fallar.');
  console.error(error.message);
}

console.log('Paso 2: Iniciando el servidor Node.js...');
require('./server.js');
