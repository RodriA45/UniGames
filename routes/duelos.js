const express = require('express');
const { getDb } = require('../database/db');
const { verificarToken } = require('../middlewares/auth');

const router = express.Router();

// Juegos habilitados para duelo 1v1. La clave es la que manda el
// frontend (app2.js) y el id es el que corresponde en la tabla `juegos`
// (mismo criterio que juego_id en /api/partidas y que GAME_ID_MAP en
// app2.js: Sopa=1, Preguntados=2, Termina la Palabra=3, Ahorcado=4,
// Adivina la Cosa=5, Adivina la Palabra=6, Pixel Runner=7).
const JUEGOS_DUELO = {
    ahorcado:    { id: 4, nombre: 'Ahorcado' },
    sopa:        { id: 1, nombre: 'Sopa de Letras' },
    wordle:      { id: 6, nombre: 'Adivina la Palabra' },
    runner:      { id: 7, nombre: 'Pixel Runner' },
    preguntados: { id: 2, nombre: 'Preguntados' },
    termina:     { id: 3, nombre: 'Termina la Palabra' },
    adivina:     { id: 5, nombre: 'Adivina la Cosa' },
};

// Juegos que necesitan que el retador elija una temática al mandar el reto
// (las mismas 4 que se usan jugando solo: 1=Videojuegos, 2=Películas,
// 3=Anime, 4=Programación). Pixel Runner no tiene temáticas, así que
// queda afuera.
const JUEGOS_CON_TEMATICA = {
    sopa: true, wordle: true, ahorcado: true,
    preguntados: true, termina: true, adivina: true,
};

// De los juegos con temática, cuáles además aceptan "normal" (sin
// temática, tematica_id = NULL) como opción — igual que en modo libre.
// Por ahora solo Ahorcado tiene ese modo "sin temática".
const JUEGOS_TEMATICA_NORMAL = { ahorcado: true };

const TEMATICAS_VALIDAS = [1, 2, 3, 4];

// Juegos que además necesitan elegir cuánto dura la partida al retar.
const JUEGOS_CON_DURACION = { sopa: true };
const DURACIONES_VALIDAS_SOPA = [120, 180, 240, 300]; // 2, 3, 4 y 5 minutos

function juegoValido(juego) {
    return Object.prototype.hasOwnProperty.call(JUEGOS_DUELO, juego);
}

// Valida (y normaliza) la temática/duración recibidas al crear un duelo,
// según lo que requiera cada juego. Devuelve { ok: true, tematicaId,
// duracionSegundos } o { ok: false, error } para responder 400 directo.
function validarOpcionesDuelo(juego, tematica_id, duracion_segundos) {
    let tematicaId = null;
    if (JUEGOS_CON_TEMATICA[juego]) {
        const esNormal = tematica_id === 'normal' || tematica_id === undefined || tematica_id === null || tematica_id === '';
        if (JUEGOS_TEMATICA_NORMAL[juego] && esNormal) {
            tematicaId = null; // "Normal" (sin temática) — solo válido para juegos en JUEGOS_TEMATICA_NORMAL
        } else {
            tematicaId = Number(tematica_id);
            if (!TEMATICAS_VALIDAS.includes(tematicaId)) {
                return { ok: false, error: 'Falta indicar una temática válida' };
            }
        }
    }

    let duracionSegundos = null;
    if (JUEGOS_CON_DURACION[juego]) {
        duracionSegundos = Number(duracion_segundos);
        if (!DURACIONES_VALIDAS_SOPA.includes(duracionSegundos)) {
            return { ok: false, error: 'Falta indicar una duración válida (2 a 5 minutos)' };
        }
    }

    return { ok: true, tematicaId, duracionSegundos };
}

function nombreJuegoPorId(juegoId) {
    const key = Object.keys(JUEGOS_DUELO).find(k => JUEGOS_DUELO[k].id === juegoId);
    return { key: key || null, nombre: key ? JUEGOS_DUELO[key].nombre : 'Juego' };
}

// Trae todo lo necesario en un solo query: datos del duelo + nombre/ícono
// de ambos usuarios (para no tener que resolver el "oponente" en el
// frontend con requests separados).
const SELECT_BASE = `
    SELECT d.*,
           ur.nombre_usuario AS retador_nombre, ur.icono AS retador_icono,
           ud.nombre_usuario AS retado_nombre,  ud.icono AS retado_icono
    FROM duelos d
    JOIN usuarios ur ON ur.id = d.retador_id
    JOIN usuarios ud ON ud.id = d.retado_id
`;

// Convierte una fila cruda de la tabla `duelos` (con los datos de ambos
// usuarios ya traídos por el JOIN) en el objeto que espera el frontend,
// ya resuelto desde el punto de vista de "miId" (quién es el oponente,
// mis puntos vs los suyos, si ya jugué, si gané/perdí/empaté).
function formatearDuelo(row, miId) {
    const soyRetador = row.retador_id === miId;
    const { key: juegoKey, nombre: juegoNombre } = nombreJuegoPorId(row.juego_id);

    let resultado = null;
    if (row.estado === 'finalizado') {
        resultado = row.ganador_id === null ? 'empate' : (row.ganador_id === miId ? 'gano' : 'perdio');
    }

    const misPuntos = soyRetador ? row.puntos_retador : row.puntos_retado;

    return {
        id: row.id,
        juego: juegoKey,
        juegoNombre,
        tematicaId: row.tematica_id || null,
        duracionSegundos: row.duracion_segundos || null,
        estado: row.estado, // 'pendiente' | 'en_curso' | 'finalizado'
        soyRetador,
        yo: {
            id: miId,
            username: soyRetador ? row.retador_nombre : row.retado_nombre,
            avatar: soyRetador ? row.retador_icono : row.retado_icono,
        },
        oponente: {
            id: soyRetador ? row.retado_id : row.retador_id,
            username: soyRetador ? row.retado_nombre : row.retador_nombre,
            avatar: soyRetador ? row.retado_icono : row.retador_icono,
        },
        misPuntos,
        puntosOponente: soyRetador ? row.puntos_retado : row.puntos_retador,
        yaJugue: misPuntos !== null && misPuntos !== undefined,
        resultado,
        fecha: row.fecha_creacion,
    };
}

// Evita mandar/tener más de un duelo pendiente o en curso contra el
// mismo rival en el mismo juego a la vez (si ya hay uno, hay que
// resolverlo antes de crear otro).
async function existeDueloAbierto(db, juegoId, idA, idB) {
    return db.get(
        `SELECT id FROM duelos WHERE juego_id = ? AND estado IN ('pendiente','en_curso')
         AND ((retador_id = ? AND retado_id = ?) OR (retador_id = ? AND retado_id = ?))`,
        [juegoId, idA, idB, idB, idA]
    );
}

// 1. Listado de mis duelos (cualquier estado), más recientes primero.
router.get('/duelos', verificarToken, async (req, res) => {
    const db = await getDb();
    try {
        const rows = await db.all(
            `${SELECT_BASE} WHERE d.retador_id = ? OR d.retado_id = ? ORDER BY d.fecha_creacion DESC`,
            [req.user.id, req.user.id]
        );
        res.json(rows.map(r => formatearDuelo(r, req.user.id)));
    } catch (error) {
        console.error('Error en GET /api/duelos:', error);
        res.status(500).json({ error: 'Error al obtener los duelos' });
    }
});

// 2. Retar a un amigo a duelo.
router.post('/duelos', verificarToken, async (req, res) => {
    const { amigo_id, juego, tematica_id, duracion_segundos } = req.body;

    if (!amigo_id || !/^\d+$/.test(String(amigo_id))) {
        return res.status(400).json({ error: 'Falta indicar un amigo válido' });
    }
    if (!juegoValido(juego)) {
        return res.status(400).json({ error: 'Ese juego no está disponible para duelos' });
    }
    const amigoId = Number(amigo_id);
    if (amigoId === req.user.id) {
        return res.status(400).json({ error: 'No podés retarte a vos mismo' });
    }

    const opciones = validarOpcionesDuelo(juego, tematica_id, duracion_segundos);
    if (!opciones.ok) return res.status(400).json({ error: opciones.error });
    const { tematicaId, duracionSegundos } = opciones;

    const db = await getDb();
    try {
        const amistad = await db.get(
            `SELECT id FROM amistades WHERE estado = 'aceptada' AND ((usuario1_id = ? AND usuario2_id = ?) OR (usuario1_id = ? AND usuario2_id = ?))`,
            [req.user.id, amigoId, amigoId, req.user.id]
        );
        if (!amistad) return res.status(400).json({ error: 'Solo podés retar a duelo a tus amigos' });

        const juegoId = JUEGOS_DUELO[juego].id;
        const abierto = await existeDueloAbierto(db, juegoId, req.user.id, amigoId);
        if (abierto) return res.status(400).json({ error: 'Ya tenés un duelo pendiente con este amigo en ese juego' });

        const result = await db.query(
            `INSERT INTO duelos (retador_id, retado_id, juego_id, estado, tematica_id, duracion_segundos) VALUES (?, ?, ?, 'pendiente', ?, ?) RETURNING id`,
            [req.user.id, amigoId, juegoId, tematicaId, duracionSegundos]
        );

        try {
            await db.run(
                `INSERT INTO notificaciones (usuario_id, tipo, mensaje, enlace) VALUES (?, 'duelo', ?, NULL) RETURNING id`,
                [amigoId, `${req.user.username} te retó a un duelo de ${JUEGOS_DUELO[juego].nombre}`]
            );
        } catch (notifError) {
            console.error('Error al crear notificación de duelo:', notifError);
        }

        res.status(201).json({ message: 'Duelo enviado', id: result.rows[0].id });
    } catch (error) {
        console.error('Error en POST /api/duelos:', error);
        res.status(500).json({ error: 'Error al crear el duelo' });
    }
});

// 3. Aceptar un duelo recibido.
router.post('/duelos/:id/aceptar', verificarToken, async (req, res) => {
    const { id } = req.params;
    const db = await getDb();
    try {
        const duelo = (await db.query(`SELECT * FROM duelos WHERE id = $1 AND estado = 'pendiente'`, [id])).rows[0];
        if (!duelo) return res.status(404).json({ error: 'Duelo no encontrado' });
        if (duelo.retado_id !== req.user.id) return res.status(403).json({ error: 'No podés aceptar este duelo' });

        await db.query(`UPDATE duelos SET estado = 'en_curso' WHERE id = $1`, [id]);

        try {
            await db.run(
                `INSERT INTO notificaciones (usuario_id, tipo, mensaje, enlace) VALUES (?, 'duelo', ?, NULL) RETURNING id`,
                [duelo.retador_id, `${req.user.username} aceptó tu duelo`]
            );
        } catch (notifError) {
            console.error('Error al crear notificación de aceptación de duelo:', notifError);
        }

        res.json({ message: 'Duelo aceptado' });
    } catch (error) {
        console.error('Error en POST /api/duelos/:id/aceptar:', error);
        res.status(500).json({ error: 'Error al aceptar el duelo' });
    }
});

// 4. Rechazar un duelo recibido, o cancelar uno que mandaste (mientras
// siga 'pendiente'; una vez aceptado ya no se puede cancelar).
router.post('/duelos/:id/rechazar', verificarToken, async (req, res) => {
    const { id } = req.params;
    const db = await getDb();
    try {
        const duelo = (await db.query(`SELECT * FROM duelos WHERE id = $1 AND estado = 'pendiente'`, [id])).rows[0];
        if (!duelo) return res.status(404).json({ error: 'Duelo no encontrado' });
        if (duelo.retador_id !== req.user.id && duelo.retado_id !== req.user.id) {
            return res.status(403).json({ error: 'No podés modificar este duelo' });
        }
        await db.query(`DELETE FROM duelos WHERE id = $1`, [id]);
        res.json({ message: 'Duelo eliminado' });
    } catch (error) {
        console.error('Error en POST /api/duelos/:id/rechazar:', error);
        res.status(500).json({ error: 'Error al rechazar el duelo' });
    }
});

// 5. Guardar mi puntaje de la partida de duelo. Cuando los dos ya
// jugaron, cierra el duelo y calcula el ganador (mayor puntaje gana;
// puntaje igual = empate). No se puede reenviar un puntaje ya guardado
// (evita mandar el resultado dos veces para "mejorarlo").
router.post('/duelos/:id/resultado', verificarToken, async (req, res) => {
    const { id } = req.params;
    const { puntos } = req.body;

    if (typeof puntos !== 'number' || !Number.isFinite(puntos) || puntos < 0) {
        return res.status(400).json({ error: 'Puntaje inválido' });
    }

    const db = await getDb();
    try {
        const duelo = (await db.query(`SELECT * FROM duelos WHERE id = $1 AND estado = 'en_curso'`, [id])).rows[0];
        if (!duelo) return res.status(404).json({ error: 'Duelo no encontrado o no está en curso' });

        const soyRetador = duelo.retador_id === req.user.id;
        const soyRetado = duelo.retado_id === req.user.id;
        if (!soyRetador && !soyRetado) return res.status(403).json({ error: 'No participás de este duelo' });

        const yaJugue = soyRetador ? duelo.puntos_retador !== null : duelo.puntos_retado !== null;
        if (yaJugue) return res.status(400).json({ error: 'Ya registraste tu puntaje en este duelo' });

        const campo = soyRetador ? 'puntos_retador' : 'puntos_retado';
        await db.query(`UPDATE duelos SET ${campo} = $1 WHERE id = $2`, [Math.round(puntos), id]);

        const actualizado = (await db.query(`SELECT * FROM duelos WHERE id = $1`, [id])).rows[0];
        const ambosJugaron = actualizado.puntos_retador !== null && actualizado.puntos_retado !== null;

        if (ambosJugaron) {
            let ganadorId = null;
            if (actualizado.puntos_retador > actualizado.puntos_retado) ganadorId = actualizado.retador_id;
            else if (actualizado.puntos_retado > actualizado.puntos_retador) ganadorId = actualizado.retado_id;

            await db.run(
                `UPDATE duelos SET estado = 'finalizado', ganador_id = ?, fecha_fin = CURRENT_TIMESTAMP WHERE id = ?`,
                [ganadorId, id]
            );

            const otroId = soyRetador ? duelo.retado_id : duelo.retador_id;
            try {
                let mensaje;
                if (ganadorId === null) mensaje = `Tu duelo con ${req.user.username} terminó empatado`;
                else if (ganadorId === otroId) mensaje = `Ganaste el duelo contra ${req.user.username}`;
                else mensaje = `${req.user.username} te ganó el duelo`;
                await db.run(
                    `INSERT INTO notificaciones (usuario_id, tipo, mensaje, enlace) VALUES (?, 'duelo', ?, NULL) RETURNING id`,
                    [otroId, mensaje]
                );
            } catch (notifError) {
                console.error('Error al crear notificación de resultado de duelo:', notifError);
            }
        }

        const row = (await db.query(`${SELECT_BASE} WHERE d.id = $1`, [id])).rows[0];
        res.json(formatearDuelo(row, req.user.id));
    } catch (error) {
        console.error('Error en POST /api/duelos/:id/resultado:', error);
        res.status(500).json({ error: 'Error al guardar el resultado del duelo' });
    }
});

// 6. Revancha: crea un duelo nuevo pendiente, mismo rival y mismo juego
// que el duelo finalizado indicado. La invitación la manda quien toca
// el botón (no hace falta que haya sido el ganador ni el perdedor).
router.post('/duelos/:id/revancha', verificarToken, async (req, res) => {
    const { id } = req.params;
    const db = await getDb();
    try {
        const duelo = (await db.query(`SELECT * FROM duelos WHERE id = $1 AND estado = 'finalizado'`, [id])).rows[0];
        if (!duelo) return res.status(404).json({ error: 'Duelo no encontrado' });
        if (duelo.retador_id !== req.user.id && duelo.retado_id !== req.user.id) {
            return res.status(403).json({ error: 'No podés revanchar este duelo' });
        }

        const oponenteId = duelo.retador_id === req.user.id ? duelo.retado_id : duelo.retador_id;

        const abierto = await existeDueloAbierto(db, duelo.juego_id, req.user.id, oponenteId);
        if (abierto) return res.status(400).json({ error: 'Ya tenés un duelo pendiente con este amigo en ese juego' });

        const result = await db.query(
            `INSERT INTO duelos (retador_id, retado_id, juego_id, estado, tematica_id, duracion_segundos) VALUES (?, ?, ?, 'pendiente', ?, ?) RETURNING id`,
            [req.user.id, oponenteId, duelo.juego_id, duelo.tematica_id, duelo.duracion_segundos]
        );

        try {
            await db.run(
                `INSERT INTO notificaciones (usuario_id, tipo, mensaje, enlace) VALUES (?, 'duelo', ?, NULL) RETURNING id`,
                [oponenteId, `${req.user.username} te retó a la revancha`]
            );
        } catch (notifError) {
            console.error('Error al crear notificación de revancha:', notifError);
        }

        res.status(201).json({ message: 'Revancha enviada', id: result.rows[0].id });
    } catch (error) {
        console.error('Error en POST /api/duelos/:id/revancha:', error);
        res.status(500).json({ error: 'Error al crear la revancha' });
    }
});

module.exports = router;
