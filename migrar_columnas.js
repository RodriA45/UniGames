// ══════════════════════════════════════
//   UniGames — migrar_columnas.js
// ══════════════════════════════════════
//
// La tabla `usuarios` se creó (con crear_bd.py) antes de que el código
// empezara a usar `rol` y `estado` (ver auth.js/admin.js), así que en
// bases ya existentes esas columnas no están — de ahí el error
// "SQLITE_ERROR: no such column: rol".
//
// Este script agrega SOLO las columnas que falten (chequea con PRAGMA
// table_info antes de tocar nada) y les pone un valor por default a las
// filas que ya existen — no borra ni recrea nada, así no perdés los
// usuarios ya registrados. Es seguro correrlo más de una vez: si ya están
// las columnas, no hace nada.
//
// Uso: node migrar_columnas.js
// ══════════════════════════════════════

const { getDb } = require('./database/db');

// Columnas que el código espera encontrar en `usuarios` (ver auth.js,
// admin.js) — agregá acá si en algún momento sumás otra columna nueva al
// código sin migrar la base.
const COLUMNAS_REQUERIDAS = [
  { nombre: 'rol',             sql: "ALTER TABLE usuarios ADD COLUMN rol TEXT NOT NULL DEFAULT 'user'" },
  { nombre: 'estado',          sql: "ALTER TABLE usuarios ADD COLUMN estado TEXT NOT NULL DEFAULT 'activo'" },
  { nombre: 'fecha_registro',  sql: "ALTER TABLE usuarios ADD COLUMN fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP" },
];

async function migrar() {
  const db = await getDb();
  const columnasActuales = (await db.all('PRAGMA table_info(usuarios)')).map(c => c.name);

  console.log('Columnas actuales en `usuarios`:', columnasActuales.join(', '));

  let algoCambio = false;
  for (const col of COLUMNAS_REQUERIDAS) {
    if (columnasActuales.includes(col.nombre)) {
      console.log(`✅ '${col.nombre}' ya existe — no se toca.`);
      continue;
    }
    console.log(`➕ Agregando columna '${col.nombre}'...`);
    await db.run(col.sql);
    algoCambio = true;
    console.log(`✅ '${col.nombre}' agregada.`);
  }

  if (!algoCambio) {
    console.log('\nNo hacía falta migrar nada — la tabla ya estaba al día.');
  } else {
    console.log('\n✅ Migración completa. Ahora podés correr "node hacer_admin.js" (o el .bat) sin el error.');
  }
}

migrar().catch(err => {
  console.error('❌ Error migrando:', err);
  process.exit(1);
});
