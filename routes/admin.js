const express = require('express');
const path = require('path');
const { getDb } = require('../database/db');
const { verificarAdmin, publicRateLimit } = require('../middlewares/auth');
const tiempoReal = require('../services/tiempoReal');
const logs = require('../services/logs');
const { enviarAviso } = require('../services/avisos');
const { invalidarConfig } = require('../services/configSitio');
const { invalidarSancion, mensajeSancion } = require('../services/sanciones');

const router = express.Router();

// Violación de índice UNIQUE en PostgreSQL (palabra/pregunta/item repetido).
const esDuplicado = (err) => err && err.code === '23505';
const MSG_DUPLICADO = 'Ya existe ese contenido para esta temática';

// Mismo criterio que parseAliases de routes/juegos.js. La vista
// v_adivina_items ya los trae como array; el texto (JSON o "a,b,c") queda
// por compatibilidad.
function parseAliases(raw) {
    if (Array.isArray(raw)) return raw;
    if (!raw) return [];
    try {
        const v = JSON.parse(raw);
        return Array.isArray(v) ? v : [];
    } catch {
        return String(raw).split(',').map(a => a.trim()).filter(Boolean);
    }
}

// Página pedida (?pagina=N), de 1 en adelante.
function leerPagina(valor) {
    const n = parseInt(valor, 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
}

// Para usar texto del usuario dentro de un LIKE sin que % y _ hagan de comodín.
function escaparLike(texto) {
    return String(texto).replace(/[\\%_]/g, (c) => '\\' + c);
}

const POR_PAGINA = 20;

// ==========================================
// ENDPOINTS PÚBLICOS (NO REQUIEREN ADMIN)
// ==========================================

// Configuración global del sitio (tema, mantenimiento, juegos ocultos...).
// Es pública a propósito: la usa el frontend al cargar. No guardar secretos acá.
router.get('/config', publicRateLimit, async (req, res) => {
    const db = await getDb();
    try {
        const rows = (await db.query(`SELECT clave, valor FROM configuracion_global`)).rows;
        const config = {};
        rows.forEach(row => {
            config[row.clave] = row.valor;
        });
        res.json(config);
    } catch (error) {
        console.error('Error al obtener config:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// ==========================================
// RUTAS PROTEGIDAS PARA ADMIN
// ==========================================
// verificarAdmin chequea contra la base que el usuario siga siendo admin y
// esté activo (no alcanza con el rol del token).

router.use(verificarAdmin);

// Quién soy (el front lo usa para confirmar el acceso antes de mostrar el panel)
router.get('/me', async (req, res) => {
    res.json({ id: req.user.id, username: req.user.username, rol: 'admin' });
});

// El HTML del panel se sirve desde acá y no desde public/: quien no es admin
// ni siquiera recibe la estructura del panel.
router.get('/panel', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(__dirname, '..', 'views', 'admin_panel.html'));
});

// ─── Configuración ───

// Claves que se pueden guardar desde el panel y cómo se validan.
const CLAVES_CONFIG = {
    color_tema: (v) => ['dark', 'light', 'red'].includes(v),
    github_rodrigo: (v) => v.length <= 200,
    github_santiago: (v) => v.length <= 200,
    github_kevin: (v) => v.length <= 200,
    repo_url: (v) => v === '' || /^https?:\/\/\S+$/.test(v),
    mostrar_repo: (v) => v === 'true' || v === 'false',
    mostrar_devs: (v) => v === 'true' || v === 'false',
    mantenimiento_activo: (v) => v === 'true' || v === 'false',
    mantenimiento_mensaje: (v) => v.length <= 300,
    registro_abierto: (v) => v === 'true' || v === 'false',
    juegos_ocultos: (v) => {
        try {
            const arr = JSON.parse(v);
            return Array.isArray(arr) && arr.length <= 20 && arr.every((x) => typeof x === 'string' && /^[a-z_]{2,30}$/.test(x));
        } catch {
            return false;
        }
    },
};

router.put('/config', async (req, res) => {
    const entradas = Object.entries(req.body || {});
    if (!entradas.length) return res.status(400).json({ error: 'No hay cambios para guardar' });
    for (const [clave, valor] of entradas) {
        const validar = CLAVES_CONFIG[clave];
        if (!validar) return res.status(400).json({ error: `Clave de configuración desconocida: ${clave}` });
        if (typeof valor !== 'string' || !validar(valor.trim())) {
            return res.status(400).json({ error: `Valor inválido para ${clave}` });
        }
    }

    const db = await getDb();
    try {
        await db.transaction(async (c) => {
            for (const [clave, valor] of entradas) {
                await c.query(
                    `INSERT INTO configuracion_global (clave, valor) VALUES ($1, $2)
                     ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor`,
                    [clave, valor.trim()]
                );
            }
        });
        invalidarConfig();
        const cambios = Object.fromEntries(entradas.map(([k, v]) => [k, v.trim()]));
        // A todos los conectados: así el modo mantenimiento o un juego oculto
        // se aplica en el momento, sin recargar.
        tiempoReal.enviarATodos('config', cambios);
        console.log(`${req.user.username} cambió la configuración: ${Object.keys(cambios).join(', ')}`);
        res.json({ message: 'Configuración actualizada con éxito', config: cambios });
    } catch (error) {
        console.error('Error al actualizar config:', error);
        res.status(500).json({ error: 'Error al actualizar configuración' });
    }
});

// ─── Cuentas (paginadas de a 20) ───
// Filtros:
//   filtro=usuarios (todas) | admins | baneados
//   conexion=online | offline   (usuarios y admins)
//   ban=temporal | permanente   (baneados)
// "En línea" sale de las conexiones abiertas en tiempo real (memoria), por
// eso se pasa la lista de ids conectados a la consulta.

const SELECT_CUENTA = `
    SELECT u.id, u.nombre_usuario, u.email, u.rol, u.icono, u.fecha_registro, u.ultima_conexion,
           s.tipo AS ban_tipo, s.motivo AS ban_motivo, s.hasta AS ban_hasta, s.creado_en AS ban_desde
    FROM usuarios u
    LEFT JOIN v_sanciones_activas s ON s.usuario_id = u.id`;

router.get('/usuarios', async (req, res) => {
    const pagina = leerPagina(req.query.pagina);
    const q = String(req.query.q || '').trim().slice(0, 100);
    const { filtro, conexion, ban } = req.query;
    const enLinea = tiempoReal.idsConectados();

    const condiciones = [];
    const params = [];
    if (q) {
        params.push(`%${escaparLike(q)}%`);
        condiciones.push(`(u.nombre_usuario ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
    }
    if (filtro === 'admins') condiciones.push(`u.rol = 'admin'`);
    if (filtro === 'baneados') {
        condiciones.push('s.id IS NOT NULL');
        if (ban === 'temporal' || ban === 'permanente') {
            params.push(ban);
            condiciones.push(`s.tipo = $${params.length}`);
        }
    } else if (conexion === 'online' || conexion === 'offline') {
        params.push(enLinea);
        condiciones.push(`${conexion === 'offline' ? 'NOT ' : ''}(u.id = ANY($${params.length}::int[]))`);
    }
    const where = condiciones.length ? 'WHERE ' + condiciones.join(' AND ') : '';

    const db = await getDb();
    try {
        const total = Number((await db.query(
            `SELECT COUNT(*) AS n FROM usuarios u LEFT JOIN v_sanciones_activas s ON s.usuario_id = u.id ${where}`,
            params
        )).rows[0].n);
        const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
        const actual = Math.min(pagina, paginas);
        const items = (await db.query(
            `${SELECT_CUENTA} ${where}
             ORDER BY u.id DESC
             LIMIT ${POR_PAGINA} OFFSET ${(actual - 1) * POR_PAGINA}`,
            params
        )).rows.map((u) => ({ ...u, en_linea: enLinea.includes(u.id) }));

        // Contadores de los filtros (sin búsqueda ni subfiltros)
        const resumen = (await db.query(`
            SELECT COUNT(*)::int AS total,
                   COUNT(*) FILTER (WHERE u.rol = 'admin')::int AS admins,
                   COUNT(s.id)::int AS baneados,
                   COUNT(*) FILTER (WHERE u.id = ANY($1::int[]))::int AS en_linea
            FROM usuarios u LEFT JOIN v_sanciones_activas s ON s.usuario_id = u.id`, [enLinea])).rows[0];

        res.json({ items, total, pagina: actual, paginas, porPagina: POR_PAGINA, resumen });
    } catch (error) {
        console.error('Error al obtener usuarios:', error);
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
});

// Perfil completo de una cuenta (botón "Ver perfil" del menú ⋯)
router.get('/usuarios/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Usuario inválido' });
    const db = await getDb();
    try {
        const u = (await db.query(`${SELECT_CUENTA} WHERE u.id = $1`, [id])).rows[0];
        if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
        const extra = (await db.query(`
            SELECT u.descripcion,
                   (SELECT COUNT(*)::int FROM logros_usuario l WHERE l.usuario_id = u.id) AS logros,
                   (SELECT COUNT(*)::int FROM amistades a WHERE a.estado = 'aceptada' AND (a.usuario1_id = u.id OR a.usuario2_id = u.id)) AS amigos,
                   (SELECT COUNT(*)::int FROM v_duelos d WHERE d.estado = 'finalizado' AND (d.retador_id = u.id OR d.retado_id = u.id)) AS duelos,
                   (SELECT COUNT(*)::int FROM v_duelos d WHERE d.ganador_id = u.id) AS duelos_ganados
            FROM usuarios u WHERE u.id = $1`, [id])).rows[0];
        const records = (await db.query(`
            SELECT j.nombre AS juego, p.puntos, p.fecha
            FROM partidas p JOIN juegos j ON j.id = p.juego_id
            WHERE p.usuario_id = $1 ORDER BY p.puntos DESC`, [id])).rows;
        const sanciones = (await db.query(`
            SELECT s.id, s.tipo, s.motivo, s.hasta, s.creado_en, s.levantada_en,
                   a.nombre_usuario AS creado_por, b.nombre_usuario AS levantada_por
            FROM sanciones s
            LEFT JOIN usuarios a ON a.id = s.creado_por
            LEFT JOIN usuarios b ON b.id = s.levantada_por
            WHERE s.usuario_id = $1 ORDER BY s.creado_en DESC LIMIT 20`, [id])).rows;
        res.json({ ...u, ...extra, en_linea: tiempoReal.estaConectado(id), records, sanciones });
    } catch (error) {
        console.error('Error al obtener el perfil:', error);
        res.status(500).json({ error: 'Error al obtener el perfil' });
    }
});

// No te podés banear ni sacar el rol a vos mismo, y siempre tiene que
// quedar al menos un admin habilitado (si no, nadie puede volver a entrar
// al panel).
async function validarCambioCuenta(db, req, cambio) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return 'Usuario inválido';
    if (id === req.user.id) return 'No podés cambiar tu propia cuenta desde el panel';
    const u = (await db.query(`${SELECT_CUENTA} WHERE u.id = $1`, [id])).rows[0];
    if (!u) return 'Usuario no encontrado';
    const esAdminHabilitado = u.rol === 'admin' && !u.ban_tipo;
    if (esAdminHabilitado && (cambio.rol === 'user' || cambio.banear)) {
        const n = Number((await db.query(`
            SELECT COUNT(*) AS n FROM usuarios u
            WHERE u.rol = 'admin' AND NOT EXISTS (SELECT 1 FROM v_sanciones_activas s WHERE s.usuario_id = u.id)`)).rows[0].n);
        if (n <= 1) return 'Tiene que quedar al menos un admin habilitado';
    }
    return null;
}

// Banear: { tipo: 'temporal' | 'permanente', motivo, hasta? (ISO, solo temporal) }
// Si ya tenía un baneo vigente, se reemplaza por este.
router.post('/usuarios/:id/sancion', async (req, res) => {
    const { tipo } = req.body || {};
    const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo.trim() : '';
    if (tipo !== 'temporal' && tipo !== 'permanente') return res.status(400).json({ error: 'Tipo de baneo inválido' });
    if (!motivo) return res.status(400).json({ error: 'Escribí el motivo del baneo' });
    if (motivo.length > 300) return res.status(400).json({ error: 'El motivo puede tener hasta 300 caracteres' });
    let hasta = null;
    if (tipo === 'temporal') {
        const fecha = new Date(req.body.hasta);
        if (Number.isNaN(fecha.getTime())) return res.status(400).json({ error: 'Elegí hasta cuándo dura el baneo' });
        if (fecha.getTime() < Date.now() + 60 * 1000) return res.status(400).json({ error: 'La fecha de fin tiene que ser en el futuro' });
        if (fecha.getTime() > Date.now() + 5 * 366 * 24 * 3600 * 1000) return res.status(400).json({ error: 'Para más de 5 años usá un baneo permanente' });
        hasta = fecha.toISOString();
    }

    const db = await getDb();
    try {
        const error = await validarCambioCuenta(db, req, { banear: true });
        if (error) return res.status(400).json({ error });
        const sancion = await db.transaction(async (c) => {
            await c.query(
                `UPDATE sanciones SET levantada_en = NOW(), levantada_por = $2 WHERE usuario_id = $1 AND levantada_en IS NULL`,
                [req.params.id, req.user.id]
            );
            return (await c.query(
                `INSERT INTO sanciones (usuario_id, tipo, motivo, hasta, creado_por) VALUES ($1, $2, $3, $4, $5)
                 RETURNING id, tipo, motivo, hasta, creado_en`,
                [req.params.id, tipo, motivo, hasta, req.user.id]
            )).rows[0];
        });
        invalidarSancion(req.params.id);
        // Si está conectado, le llega el aviso con el motivo y se le cierra todo
        tiempoReal.enviarAUsuario(req.params.id, 'sesion', {
            baneado: true,
            mensaje: mensajeSancion(sancion),
            sancion: { tipo: sancion.tipo, motivo: sancion.motivo, hasta: sancion.hasta },
        });
        tiempoReal.desconectarAdmin(req.params.id);
        setTimeout(() => tiempoReal.desconectarUsuario(req.params.id), 500);
        console.log(`${req.user.username} baneó al usuario #${req.params.id} (${tipo}${hasta ? ' hasta ' + hasta : ''}): ${motivo}`);
        res.status(201).json({ sancion });
    } catch (err) {
        console.error('Error al banear:', err);
        res.status(500).json({ error: 'Error al banear la cuenta' });
    }
});

// Levantar el baneo vigente
router.delete('/usuarios/:id/sancion', async (req, res) => {
    const db = await getDb();
    try {
        const r = await db.query(
            `UPDATE sanciones SET levantada_en = NOW(), levantada_por = $2
             WHERE usuario_id = $1 AND levantada_en IS NULL AND (tipo = 'permanente' OR hasta > NOW())`,
            [req.params.id, req.user.id]
        );
        invalidarSancion(req.params.id);
        if (r.rowCount === 0) return res.status(404).json({ error: 'La cuenta no tiene un baneo vigente' });
        console.log(`${req.user.username} levantó el baneo del usuario #${req.params.id}`);
        res.json({ success: true });
    } catch (err) {
        console.error('Error al desbanear:', err);
        res.status(500).json({ error: 'Error al levantar el baneo' });
    }
});

router.put('/usuarios/:id/rol', async (req, res) => {
    const { rol } = req.body;
    if (rol !== 'admin' && rol !== 'user') return res.status(400).json({ error: 'Rol inválido' });
    const db = await getDb();
    try {
        const error = await validarCambioCuenta(db, req, { rol });
        if (error) return res.status(400).json({ error });
        await db.query(`UPDATE usuarios SET rol = $1 WHERE id = $2`, [rol, req.params.id]);
        // Si estaba en el panel, se lo saca en el momento.
        tiempoReal.enviarAUsuario(req.params.id, 'sesion', { rol });
        if (rol !== 'admin') tiempoReal.desconectarAdmin(req.params.id);
        console.log(`${req.user.username} cambió el rol del usuario #${req.params.id} a ${rol}`);
        res.json({ message: `Rol actualizado a ${rol}` });
    } catch (error) {
        console.error('Error al actualizar rol:', error);
        res.status(500).json({ error: 'Error al actualizar rol' });
    }
});

// ─── Dashboard ───

router.get('/dashboard', async (req, res) => {
    const db = await getDb();
    try {
        const usuarios = (await db.query(`
            SELECT COUNT(*)::int AS total,
                   COUNT(s.id)::int AS baneados,
                   COUNT(*) FILTER (WHERE u.rol = 'admin')::int AS admins,
                   COUNT(*) FILTER (WHERE u.fecha_registro >= NOW() - INTERVAL '7 days')::int AS nuevos_7d
            FROM usuarios u LEFT JOIN v_sanciones_activas s ON s.usuario_id = u.id`)).rows[0];
        usuarios.en_linea = tiempoReal.usuariosConectados();

        // Registros por día de las últimas 2 semanas (los días sin registros van en 0)
        const registros = (await db.query(`
            SELECT TO_CHAR(d.dia, 'YYYY-MM-DD') AS dia, COUNT(u.id)::int AS cantidad
            FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, INTERVAL '1 day') AS d(dia)
            LEFT JOIN usuarios u ON u.fecha_registro::date = d.dia::date
            GROUP BY d.dia ORDER BY d.dia`)).rows;

        const partidasPorJuego = (await db.query(`
            SELECT j.id, j.nombre, COUNT(p.id)::int AS cantidad, COALESCE(MAX(p.puntos), 0)::int AS record
            FROM juegos j
            LEFT JOIN partidas p ON j.id = p.juego_id
            GROUP BY j.id ORDER BY cantidad DESC, j.id`)).rows;

        const duelos = (await db.query(`
            SELECT COUNT(*)::int AS total,
                   COUNT(*) FILTER (WHERE estado = 'pendiente')::int AS pendientes,
                   COUNT(*) FILTER (WHERE estado = 'en_curso')::int AS en_curso,
                   COUNT(*) FILTER (WHERE estado = 'finalizado')::int AS finalizados
            FROM duelos`)).rows[0];

        const social = (await db.query(`
            SELECT (SELECT COUNT(*)::int FROM amistades WHERE estado = 'aceptada') AS amistades,
                   (SELECT COUNT(*)::int FROM logros_usuario) AS logros,
                   (SELECT COUNT(*)::int FROM avisos WHERE enviado_en IS NOT NULL) AS avisos_enviados,
                   (SELECT COUNT(*)::int FROM avisos WHERE enviado_en IS NULL) AS avisos_programados`)).rows[0];

        const top5 = (await db.query(`
            SELECT u.nombre_usuario AS jugador, u.icono, SUM(p.puntos)::int AS "puntosTotales", COUNT(p.id)::int AS juegos
            FROM partidas p
            JOIN usuarios u ON p.usuario_id = u.id
            GROUP BY u.id
            ORDER BY "puntosTotales" DESC
            LIMIT 5`)).rows;

        const ultimos = (await db.query(`
            SELECT nombre_usuario, icono, TO_CHAR(fecha_registro, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_registro
            FROM usuarios ORDER BY id DESC LIMIT 5`)).rows;

        res.json({
            usuarios,
            registros,
            partidasPorJuego,
            duelos,
            social,
            top5,
            ultimos,
            logs: logs.contarPorNivel(),
            servidor: { uptime: Math.round(process.uptime()), memoriaMB: Math.round(process.memoryUsage().rss / 1048576) },
        });
    } catch (err) {
        console.error('Error cargando dashboard:', err);
        res.status(500).json({ error: 'Error cargando dashboard' });
    }
});

// ─── Logs del servidor ───

router.get('/logs', (req, res) => {
    const niveles = String(req.query.niveles || '').split(',').filter(Boolean);
    const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 500, 1), logs.MAX);
    res.json({
        items: logs.buscar({ q: req.query.q || '', niveles, limite }),
        conteo: logs.contarPorNivel(),
        max: logs.MAX,
    });
});

// Logs en vivo (Server-Sent Events). Igual que /api/stream, el front lo
// abre con fetch para mandar el token en el header.
router.get('/logs/stream', (req, res) => {
    tiempoReal.suscribirAdmin(req, res, req.user);
});

// ─── Avisos ───
// Un aviso tiene título, texto y prioridad (normal | alta). Se manda en el
// momento o se programa para una fecha/hora (programado_para). Mientras no
// se envió se puede editar, mandar ya o cancelar; una vez enviado queda en
// el historial (y se puede retirar: borra las notificaciones que generó).

const PRIORIDADES = ['normal', 'alta'];

function validarAviso(body) {
    const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : '';
    const texto = typeof body.texto === 'string' ? body.texto.trim() : '';
    const prioridad = body.prioridad || 'normal';
    if (!titulo) return { error: 'El título es obligatorio' };
    if (titulo.length > 120) return { error: 'El título puede tener hasta 120 caracteres' };
    if (!texto) return { error: 'El texto es obligatorio' };
    if (texto.length > 2000) return { error: 'El texto puede tener hasta 2000 caracteres' };
    if (!PRIORIDADES.includes(prioridad)) return { error: 'Prioridad inválida' };

    let programado = null;
    if (body.programado_para) {
        const fecha = new Date(body.programado_para);
        if (Number.isNaN(fecha.getTime())) return { error: 'Fecha de programación inválida' };
        if (fecha.getTime() < Date.now() + 30 * 1000) return { error: 'La fecha programada tiene que ser en el futuro' };
        if (fecha.getTime() > Date.now() + 366 * 24 * 3600 * 1000) return { error: 'Se puede programar hasta un año adelante' };
        programado = fecha.toISOString();
    }
    return { titulo, texto, prioridad, programado };
}

const SELECT_AVISO = `
    SELECT a.id, a.titulo, a.texto, a.prioridad, a.programado_para, a.enviado_en,
           u.nombre_usuario AS creado_por,
           (SELECT COUNT(*)::int FROM notificaciones n WHERE n.aviso_id = a.id) AS destinatarios,
           (SELECT COUNT(*)::int FROM notificaciones n WHERE n.aviso_id = a.id AND n.leido = 1) AS leidos
    FROM avisos a
    LEFT JOIN usuarios u ON u.id = a.creado_por`;

// Programados (todos) + historial de enviados (paginado de a 20, con búsqueda)
router.get('/avisos', async (req, res) => {
    const pagina = leerPagina(req.query.pagina);
    const q = String(req.query.q || '').trim().slice(0, 100);
    const db = await getDb();
    try {
        const programados = (await db.query(
            `${SELECT_AVISO} WHERE a.enviado_en IS NULL ORDER BY a.programado_para ASC NULLS LAST, a.id`
        )).rows;

        const params = [];
        let filtro = '';
        if (q) {
            params.push(`%${escaparLike(q)}%`);
            filtro = ` AND (a.titulo ILIKE $1 OR a.texto ILIKE $1)`;
        }
        const total = Number((await db.query(
            `SELECT COUNT(*) AS n FROM avisos a WHERE a.enviado_en IS NOT NULL${filtro}`, params
        )).rows[0].n);
        const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
        const actual = Math.min(pagina, paginas);
        const items = (await db.query(
            `${SELECT_AVISO} WHERE a.enviado_en IS NOT NULL${filtro}
             ORDER BY a.enviado_en DESC
             LIMIT ${POR_PAGINA} OFFSET ${(actual - 1) * POR_PAGINA}`,
            params
        )).rows;

        res.json({ programados, historial: { items, total, pagina: actual, paginas, porPagina: POR_PAGINA } });
    } catch (err) {
        console.error('Error al obtener avisos:', err);
        res.status(500).json({ error: 'Error al obtener avisos' });
    }
});

// Crear: sin programado_para se manda en el momento.
router.post('/avisos', async (req, res) => {
    const v = validarAviso(req.body || {});
    if (v.error) return res.status(400).json({ error: v.error });
    const db = await getDb();
    try {
        const id = (await db.query(
            `INSERT INTO avisos (titulo, texto, prioridad, programado_para, creado_por)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [v.titulo, v.texto, v.prioridad, v.programado, req.user.id]
        )).rows[0].id;

        let destinatarios = null;
        if (!v.programado) {
            const r = await enviarAviso(id);
            destinatarios = r ? r.destinatarios : 0;
        } else {
            console.log(`${req.user.username} programó el aviso #${id} "${v.titulo}" para ${v.programado}`);
        }
        const aviso = (await db.query(`${SELECT_AVISO} WHERE a.id = $1`, [id])).rows[0];
        res.status(201).json({ aviso, enviado: !v.programado, destinatarios });
    } catch (err) {
        console.error('Error al crear aviso:', err);
        res.status(500).json({ error: 'Error al crear el aviso' });
    }
});

// Editar (solo si todavía no se mandó)
router.put('/avisos/:id', async (req, res) => {
    const v = validarAviso(req.body || {});
    if (v.error) return res.status(400).json({ error: v.error });
    if (!v.programado) return res.status(400).json({ error: 'Para mandarlo ya usá "Enviar ahora"' });
    const db = await getDb();
    try {
        const r = await db.query(
            `UPDATE avisos SET titulo = $1, texto = $2, prioridad = $3, programado_para = $4
             WHERE id = $5 AND enviado_en IS NULL`,
            [v.titulo, v.texto, v.prioridad, v.programado, req.params.id]
        );
        if (r.rowCount === 0) return res.status(409).json({ error: 'El aviso ya se envió o no existe' });
        res.json({ success: true });
    } catch (err) {
        console.error('Error al editar aviso:', err);
        res.status(500).json({ error: 'Error al editar el aviso' });
    }
});

// Mandar ya un aviso programado
router.post('/avisos/:id/enviar', async (req, res) => {
    try {
        const r = await enviarAviso(Number(req.params.id));
        if (!r) return res.status(409).json({ error: 'El aviso ya se envió o no existe' });
        res.json({ success: true, destinatarios: r.destinatarios });
    } catch (err) {
        console.error('Error al enviar aviso:', err);
        res.status(500).json({ error: 'Error al enviar el aviso' });
    }
});

// Cancelar (programado) o retirar (enviado: borra sus notificaciones por CASCADE)
router.delete('/avisos/:id', async (req, res) => {
    const db = await getDb();
    try {
        const r = await db.query(`DELETE FROM avisos WHERE id = $1 RETURNING id, titulo, enviado_en`, [req.params.id]);
        const aviso = r.rows[0];
        if (!aviso) return res.status(404).json({ error: 'Aviso no encontrado' });
        if (aviso.enviado_en) tiempoReal.enviarATodos('aviso_retirado', { id: aviso.id });
        console.log(`${req.user.username} ${aviso.enviado_en ? 'retiró' : 'canceló'} el aviso #${aviso.id} "${aviso.titulo}"`);
        res.json({ success: true });
    } catch (err) {
        console.error('Error al eliminar aviso:', err);
        res.status(500).json({ error: 'Error al eliminar el aviso' });
    }
});

// ==========================================
// CONTENIDO DE JUEGOS (Ahorcado / Wordle / Preguntados / Adivina)
// ==========================================

// Listado de temáticas (para poblar selects del panel)
router.get('/tematicas', async (req, res) => {
    const db = await getDb();
    try {
        const rows = (await db.query('SELECT * FROM tematicas ORDER BY id ASC')).rows;
        res.json(rows || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Normaliza tematica_id que llega del panel: '', null, undefined, 'normal' -> NULL
function normalizarTematicaId(valor) {
    if (valor === undefined || valor === null || valor === '' || valor === 'normal') return null;
    const n = Number(valor);
    return Number.isInteger(n) ? n : undefined; // undefined = valor inválido
}

// --- Ahorcado ---

router.get('/ahorcado', async (req, res) => {
    const { tematica_id } = req.query;
    const db = await getDb();
    try {
        let sql = 'SELECT * FROM palabras_ahorcado';
        const params = [];
        if (tematica_id !== undefined) {
            const t = normalizarTematicaId(tematica_id);
            if (t === undefined) return res.status(400).json({ error: 'tematica_id inválido' });
            sql += t === null ? ' WHERE tematica_id IS NULL' : ` WHERE tematica_id = $1`;
            if (t !== null) params.push(t);
        }
        sql += ' ORDER BY id DESC';
        const rows = (await db.query(sql, params)).rows;
        res.json(rows || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/ahorcado', async (req, res) => {
    const { palabra, tematica_id } = req.body;
    if (!palabra || !palabra.trim()) return res.status(400).json({ error: 'La palabra es requerida' });
    const t = normalizarTematicaId(tematica_id);
    if (t === undefined) return res.status(400).json({ error: 'tematica_id inválido' });

    const db = await getDb();
    try {
        const result = await db.run(
            `INSERT INTO palabras_ahorcado (palabra, tematica_id) VALUES ($1, $2) RETURNING id`,
            [palabra.trim().toLowerCase(), t]
        );
        res.json({ id: result.rows[0].id, success: true });
    } catch (err) {
        if (esDuplicado(err)) return res.status(400).json({ error: MSG_DUPLICADO });
        res.status(500).json({ error: err.message });
    }
});

router.put('/ahorcado/:id', async (req, res) => {
    const { palabra, tematica_id } = req.body;
    if (!palabra || !palabra.trim()) return res.status(400).json({ error: 'La palabra es requerida' });
    const t = normalizarTematicaId(tematica_id);
    if (t === undefined) return res.status(400).json({ error: 'tematica_id inválido' });

    const db = await getDb();
    try {
        await db.run(
            `UPDATE palabras_ahorcado SET palabra = $1, tematica_id = $2 WHERE id = $3`,
            [palabra.trim().toLowerCase(), t, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        if (esDuplicado(err)) return res.status(400).json({ error: MSG_DUPLICADO });
        res.status(500).json({ error: err.message });
    }
});

router.delete('/ahorcado/:id', async (req, res) => {
    const db = await getDb();
    try {
        await db.query(`DELETE FROM palabras_ahorcado WHERE id = $1`, [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Adivina la Palabra (Wordle) ---

router.get('/wordle', async (req, res) => {
    const { tematica_id } = req.query;
    const db = await getDb();
    try {
        let sql = 'SELECT * FROM palabras_wordle';
        const params = [];
        if (tematica_id !== undefined) {
            if (!/^\d+$/.test(tematica_id)) return res.status(400).json({ error: 'tematica_id inválido' });
            sql += ' WHERE tematica_id = ?';
            params.push(Number(tematica_id));
        }
        sql += ' ORDER BY id DESC';
        const rows = (await db.query(sql, params)).rows;
        res.json(rows || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/wordle', async (req, res) => {
    const { palabra, tematica_id } = req.body;
    if (!palabra || !palabra.trim()) return res.status(400).json({ error: 'La palabra es requerida' });
    if (!/^\d+$/.test(String(tematica_id))) return res.status(400).json({ error: 'tematica_id es requerido' });

    const db = await getDb();
    try {
        const result = await db.run(
            `INSERT INTO palabras_wordle (palabra, tematica_id) VALUES ($1, $2) RETURNING id`,
            [palabra.trim().toLowerCase(), Number(tematica_id)]
        );
        res.json({ id: result.rows[0].id, success: true });
    } catch (err) {
        if (esDuplicado(err)) return res.status(400).json({ error: MSG_DUPLICADO });
        res.status(500).json({ error: err.message });
    }
});

router.put('/wordle/:id', async (req, res) => {
    const { palabra, tematica_id } = req.body;
    if (!palabra || !palabra.trim()) return res.status(400).json({ error: 'La palabra es requerida' });
    if (!/^\d+$/.test(String(tematica_id))) return res.status(400).json({ error: 'tematica_id es requerido' });

    const db = await getDb();
    try {
        await db.run(
            `UPDATE palabras_wordle SET palabra = $1, tematica_id = $2 WHERE id = $3`,
            [palabra.trim().toLowerCase(), Number(tematica_id), req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        if (esDuplicado(err)) return res.status(400).json({ error: MSG_DUPLICADO });
        res.status(500).json({ error: err.message });
    }
});

router.delete('/wordle/:id', async (req, res) => {
    const db = await getDb();
    try {
        await db.query(`DELETE FROM palabras_wordle WHERE id = $1`, [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Preguntados ---
// La pregunta va en `preguntas` y sus 4 opciones en `pregunta_opciones`
// (una fila por opción, con es_correcta). Para leer se usa la vista
// v_preguntas, que las devuelve con la forma de siempre (opcion_a..d +
// respuesta_correcta), así el panel no cambia.

const OPCIONES_VALIDAS = ['A', 'B', 'C', 'D'];

function validarPregunta(body) {
    const { tematica_id, pregunta, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta } = body;
    if (!/^\d+$/.test(String(tematica_id))) return 'tematica_id es requerido';
    if (!pregunta || !String(pregunta).trim()) return 'La pregunta es requerida';
    if (!opcion_a || !opcion_b || !opcion_c || !opcion_d) return 'Las 4 opciones son requeridas';
    if (!OPCIONES_VALIDAS.includes(String(respuesta_correcta).toUpperCase())) return 'respuesta_correcta debe ser A, B, C o D';
    return null;
}

// Reemplaza las 4 opciones de una pregunta (dentro de una transacción).
async function guardarOpciones(client, preguntaId, body) {
    const correcta = String(body.respuesta_correcta).toUpperCase();
    const textos = { A: body.opcion_a, B: body.opcion_b, C: body.opcion_c, D: body.opcion_d };
    await client.query(`DELETE FROM pregunta_opciones WHERE pregunta_id = $1`, [preguntaId]);
    for (const letra of OPCIONES_VALIDAS) {
        await client.query(
            `INSERT INTO pregunta_opciones (pregunta_id, letra, texto, es_correcta) VALUES ($1, $2, $3, $4)`,
            [preguntaId, letra, String(textos[letra]), letra === correcta]
        );
    }
}

router.get('/preguntas', async (req, res) => {
    const { tematica_id } = req.query;
    const db = await getDb();
    try {
        let sql = 'SELECT * FROM v_preguntas';
        const params = [];
        if (tematica_id !== undefined) {
            if (!/^\d+$/.test(tematica_id)) return res.status(400).json({ error: 'tematica_id inválido' });
            sql += ' WHERE tematica_id = ?';
            params.push(Number(tematica_id));
        }
        sql += ' ORDER BY id DESC';
        const rows = (await db.query(sql, params)).rows;
        res.json(rows || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/preguntas', async (req, res) => {
    const error = validarPregunta(req.body);
    if (error) return res.status(400).json({ error });
    const { tematica_id, pregunta } = req.body;

    const db = await getDb();
    try {
        const id = await db.transaction(async (client) => {
            const r = await client.query(
                `INSERT INTO preguntas (tematica_id, pregunta) VALUES ($1, $2) RETURNING id`,
                [Number(tematica_id), String(pregunta).trim()]
            );
            await guardarOpciones(client, r.rows[0].id, req.body);
            return r.rows[0].id;
        });
        res.json({ id, success: true });
    } catch (err) {
        if (esDuplicado(err)) {
            return res.status(400).json({ error: 'Ya existe esa pregunta para esta temática' });
        }
        res.status(500).json({ error: err.message });
    }
});

router.put('/preguntas/:id', async (req, res) => {
    const error = validarPregunta(req.body);
    if (error) return res.status(400).json({ error });
    const { tematica_id, pregunta } = req.body;

    const db = await getDb();
    try {
        const existe = await db.transaction(async (client) => {
            const r = await client.query(
                `UPDATE preguntas SET tematica_id = $1, pregunta = $2 WHERE id = $3`,
                [Number(tematica_id), String(pregunta).trim(), req.params.id]
            );
            if (r.rowCount === 0) return false;
            await guardarOpciones(client, req.params.id, req.body);
            return true;
        });
        if (!existe) return res.status(404).json({ error: 'Pregunta no encontrada' });
        res.json({ success: true });
    } catch (err) {
        if (esDuplicado(err)) {
            return res.status(400).json({ error: 'Ya existe esa pregunta para esta temática' });
        }
        res.status(500).json({ error: err.message });
    }
});

// Las opciones se borran solas (ON DELETE CASCADE).
router.delete('/preguntas/:id', async (req, res) => {
    const db = await getDb();
    try {
        await db.query(`DELETE FROM preguntas WHERE id = $1`, [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Adivina la Cosa ---
// El item va en `adivina_items`, sus pistas en `adivina_pistas` (orden
// 1..4) y sus alias en `adivina_aliases`. Para leer: vista v_adivina_items.

function validarAdivina(body) {
    const { tematica_id, respuesta, pistas, aliases } = body;
    if (!/^\d+$/.test(String(tematica_id))) return 'tematica_id es requerido';
    if (!respuesta || !String(respuesta).trim()) return 'La respuesta es requerida';
    if (pistas !== undefined && !Array.isArray(pistas)) return 'pistas debe ser un array';
    if (Array.isArray(pistas) && pistas.length > 4) return 'Como máximo 4 pistas';
    if (aliases !== undefined && aliases !== null && !Array.isArray(aliases)) return 'aliases debe ser un array';
    return null;
}

// Reemplaza pistas y alias de un item (dentro de una transacción).
async function guardarDetalleAdivina(client, itemId, body) {
    await client.query(`DELETE FROM adivina_pistas WHERE item_id = $1`, [itemId]);
    await client.query(`DELETE FROM adivina_aliases WHERE item_id = $1`, [itemId]);

    const pistas = Array.isArray(body.pistas) ? body.pistas : [];
    for (let i = 0; i < pistas.length; i++) {
        const texto = pistas[i] == null ? '' : String(pistas[i]).trim();
        if (!texto) continue; // pista vacía = no hay pista en ese lugar
        await client.query(
            `INSERT INTO adivina_pistas (item_id, orden, texto) VALUES ($1, $2, $3)`,
            [itemId, i + 1, texto]
        );
    }

    const vistos = new Set();
    for (const raw of Array.isArray(body.aliases) ? body.aliases : []) {
        const alias = String(raw).trim();
        if (!alias || vistos.has(alias.toLowerCase())) continue;
        vistos.add(alias.toLowerCase());
        await client.query(
            `INSERT INTO adivina_aliases (item_id, alias) VALUES ($1, $2)`,
            [itemId, alias]
        );
    }
}

router.get('/adivina', async (req, res) => {
    const { tematica_id } = req.query;
    const db = await getDb();
    try {
        let sql = 'SELECT * FROM v_adivina_items';
        const params = [];
        if (tematica_id !== undefined) {
            if (!/^\d+$/.test(tematica_id)) return res.status(400).json({ error: 'tematica_id inválido' });
            sql += ' WHERE tematica_id = ?';
            params.push(Number(tematica_id));
        }
        sql += ' ORDER BY id DESC';
        const rows = (await db.query(sql, params)).rows;
        // Igual que en /api/adivina/items: exponemos "pistas" como array y "aliases" parseado
        const items = rows.map(r => ({
            ...r,
            aliases: parseAliases(r.aliases),
            pistas: [r.pista_1, r.pista_2, r.pista_3, r.pista_4],
        }));
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/adivina', async (req, res) => {
    const error = validarAdivina(req.body);
    if (error) return res.status(400).json({ error });
    const { tematica_id, respuesta, imagen } = req.body;

    const db = await getDb();
    try {
        const id = await db.transaction(async (client) => {
            const r = await client.query(
                `INSERT INTO adivina_items (tematica_id, respuesta, imagen) VALUES ($1, $2, $3) RETURNING id`,
                [Number(tematica_id), String(respuesta).trim(), imagen || null]
            );
            await guardarDetalleAdivina(client, r.rows[0].id, req.body);
            return r.rows[0].id;
        });
        res.json({ id, success: true });
    } catch (err) {
        if (esDuplicado(err)) return res.status(400).json({ error: MSG_DUPLICADO });
        res.status(500).json({ error: err.message });
    }
});

router.put('/adivina/:id', async (req, res) => {
    const error = validarAdivina(req.body);
    if (error) return res.status(400).json({ error });
    const { tematica_id, respuesta, imagen } = req.body;

    const db = await getDb();
    try {
        const existe = await db.transaction(async (client) => {
            const r = await client.query(
                `UPDATE adivina_items SET tematica_id = $1, respuesta = $2, imagen = $3 WHERE id = $4`,
                [Number(tematica_id), String(respuesta).trim(), imagen || null, req.params.id]
            );
            if (r.rowCount === 0) return false;
            await guardarDetalleAdivina(client, req.params.id, req.body);
            return true;
        });
        if (!existe) return res.status(404).json({ error: 'Item no encontrado' });
        res.json({ success: true });
    } catch (err) {
        if (esDuplicado(err)) return res.status(400).json({ error: MSG_DUPLICADO });
        res.status(500).json({ error: err.message });
    }
});

// Pistas y alias se borran solos (ON DELETE CASCADE).
router.delete('/adivina/:id', async (req, res) => {
    const db = await getDb();
    try {
        await db.query(`DELETE FROM adivina_items WHERE id = $1`, [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
