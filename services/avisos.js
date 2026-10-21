// ══════════════════════════════════════════════════════════════════
//   UniGames — services/avisos.js
// ══════════════════════════════════════════════════════════════════
// Envío de avisos (anuncios del admin) y programador de avisos.
//
//   · prioridad "normal": le llega a cada usuario como notificación.
//   · prioridad "alta":  además, a los que están en la página se les abre
//                        un cartel en el medio de la pantalla; los que no
//                        estaban lo ven la próxima vez que entran.
//
// Un aviso programado queda con enviado_en = NULL hasta su fecha; el
// programador revisa cada 30 s y manda los que ya vencieron. Si el
// servidor estaba dormido (Render free), sale apenas se despierta.
// ══════════════════════════════════════════════════════════════════

const { getDb } = require('../database/db');
const tiempoReal = require('./tiempoReal');

const INTERVALO_MS = 30 * 1000;

// Marca el aviso como enviado y le crea una notificación a cada usuario
// activo, todo en una transacción. El UPDATE ... WHERE enviado_en IS NULL
// hace de "candado": si el programador y el botón "Enviar ahora" chocan,
// solo uno lo manda.
async function enviarAviso(avisoId) {
    const db = await getDb();
    const resultado = await db.transaction(async (c) => {
        const r = await c.query(
            `UPDATE avisos SET enviado_en = NOW()
             WHERE id = $1 AND enviado_en IS NULL
             RETURNING id, titulo, texto, prioridad, enviado_en, creado_por`,
            [avisoId]
        );
        const aviso = r.rows[0];
        if (!aviso) return null;
        // Al admin que lo escribió le queda como leída (ya sabe lo que dice)
        const ins = await c.query(
            `INSERT INTO notificaciones (usuario_id, tipo, aviso_id, leido)
             SELECT u.id, 'aviso', $1, CASE WHEN u.id = $2 THEN 1 ELSE 0 END
             FROM usuarios u
             WHERE NOT EXISTS (SELECT 1 FROM v_sanciones_activas s WHERE s.usuario_id = u.id)`,
            [aviso.id, aviso.creado_por]
        );
        return { aviso, destinatarios: ins.rowCount };
    });

    if (resultado) {
        const { aviso, destinatarios } = resultado;
        tiempoReal.enviarATodos('aviso', {
            id: aviso.id,
            titulo: aviso.titulo,
            texto: aviso.texto,
            prioridad: aviso.prioridad,
            enviado_en: aviso.enviado_en,
            creado_por: aviso.creado_por,
        });
        console.log(`Aviso #${aviso.id} "${aviso.titulo}" (${aviso.prioridad}) enviado a ${destinatarios} usuarios`);
    }
    return resultado;
}

async function enviarAvisosVencidos() {
    try {
        const db = await getDb();
        const { rows } = await db.query(
            `SELECT id FROM avisos
             WHERE enviado_en IS NULL AND programado_para IS NOT NULL AND programado_para <= NOW()
             ORDER BY programado_para`
        );
        for (const { id } of rows) await enviarAviso(id);
    } catch (err) {
        console.error('Error en el programador de avisos:', err.message);
    }
}

let timer = null;
function iniciarProgramador() {
    if (timer) return;
    enviarAvisosVencidos(); // los que vencieron mientras el server estaba apagado
    timer = setInterval(enviarAvisosVencidos, INTERVALO_MS);
    timer.unref();
}

module.exports = { enviarAviso, iniciarProgramador, enviarAvisosVencidos };
