// ══════════════════════════════════════
//   UniGames — hacer_admin.js
// ══════════════════════════════════════
//
// Reemplazo en Node del hacer_admin.py. Reutiliza getDb() de database/db.js,
// así que la ruta a unigames.db SIEMPRE es la correcta (se arma con
// __dirname adentro de db.js, no depende de la carpeta desde la que
// ejecutes este script) — el bug típico de "no se encontró la base de
// datos" por correr el .bat desde el lugar equivocado no puede pasar acá.
//
// Uso: node hacer_admin.js
// (o agregá "admin": "node hacer_admin.js" en el package.json, reemplazando
// la línea de python — ver comentario al final de este archivo)
//
// AJUSTE DE RUTA: este archivo asume que vive en la RAÍZ del proyecto,
// al lado de database/. Si lo movés a otra carpeta (ej. scripts/),
// cambiá el require de abajo a '../database/db'.
// ══════════════════════════════════════

const readline = require('readline');
const { getDb } = require('./database/db');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(resolve => rl.question(q, resolve));

const C_GREEN = '\x1b[92m', C_WARNING = '\x1b[93m', C_FAIL = '\x1b[91m',
      C_BLUE = '\x1b[94m', C_CYAN = '\x1b[96m', C_BOLD = '\x1b[1m', C_END = '\x1b[0m';

function banner() {
  console.log(`${C_CYAN}${C_BOLD}`);
  console.log('=======================================');
  console.log('   🛡️  UNIGAMES - PANEL DE CONTROL 🛡️   ');
  console.log('=======================================');
  console.log(C_END);
}

async function listarUsuarios(db) {
  const usuarios = await db.all('SELECT id, nombre_usuario, email, rol FROM usuarios ORDER BY id ASC');
  console.log(`\n${C_BLUE}--- Usuarios registrados ---${C_END}\n`);
  if (!usuarios.length) {
    console.log(`${C_WARNING}No hay usuarios registrados.${C_END}`);
  } else {
    console.log(`${'ID'.padEnd(5)} | ${'USUARIO'.padEnd(15)} | ${'ROL'.padEnd(10)} | EMAIL`);
    console.log('-'.repeat(60));
    usuarios.forEach(u => {
      const rolStr = u.rol === 'admin' ? `${C_GREEN}${u.rol}${C_END}` : u.rol;
      console.log(`${String(u.id).padEnd(5)} | ${u.nombre_usuario.padEnd(15)} | ${rolStr.padEnd(19)} | ${u.email}`);
    });
  }
  console.log('');
}

async function cambiarRol(db, nuevoRol) {
  const titulo = nuevoRol === 'admin' ? 'DAR PERMISOS DE ADMINISTRADOR' : 'QUITAR PERMISOS DE ADMINISTRADOR';
  console.log(`\n${C_BLUE}--- ${titulo} ---${C_END}\n`);

  const email = (await ask("Email del usuario (o '0' para volver): ")).trim();
  if (email === '0' || !email) return;

  const row = await db.get('SELECT id, nombre_usuario, rol FROM usuarios WHERE email = ?', [email]);
  if (!row) {
    console.log(`\n${C_FAIL}❌ No se encontró un usuario con el correo '${email}'.${C_END}\n`);
    return;
  }
  if (row.rol === nuevoRol) {
    console.log(`\n${C_WARNING}'${row.nombre_usuario}' ya tiene el rol '${nuevoRol}'.${C_END}\n`);
    return;
  }

  const confirm = (await ask(`¿Actualizar el rol de '${row.nombre_usuario}' a '${nuevoRol}'? (s/n): `)).trim().toLowerCase();
  if (confirm !== 's') {
    console.log(`\n${C_WARNING}Operación cancelada.${C_END}\n`);
    return;
  }
  await db.run('UPDATE usuarios SET rol = ? WHERE email = ?', [nuevoRol, email]);
  console.log(`\n${C_GREEN}✅ Rol de '${row.nombre_usuario}' actualizado a ${nuevoRol}.${C_END}\n`);
}

async function menuPrincipal() {
  const db = await getDb(); // acá se ve enseguida si la ruta a unigames.db falla
  while (true) {
    banner();
    console.log('Selecciona una opción:');
    console.log(`  ${C_GREEN}1.${C_END} Ver lista de usuarios`);
    console.log(`  ${C_GREEN}2.${C_END} Hacer a un usuario Administrador`);
    console.log(`  ${C_GREEN}3.${C_END} Quitar rol de Administrador`);
    console.log(`  ${C_WARNING}0. Salir${C_END}\n`);

    const opcion = (await ask(`${C_BOLD}Tu opción: ${C_END}`)).trim();
    if (opcion === '1') await listarUsuarios(db);
    else if (opcion === '2') await cambiarRol(db, 'admin');
    else if (opcion === '3') await cambiarRol(db, 'user');
    else if (opcion === '0') { console.log(`${C_GREEN}¡Hasta luego!${C_END}`); rl.close(); process.exit(0); }
    else console.log(`${C_FAIL}❌ Opción no válida.${C_END}\n`);
  }
}

menuPrincipal().catch(err => {
  console.error(`${C_FAIL}Error:${C_END}`, err);
  process.exit(1);
});
