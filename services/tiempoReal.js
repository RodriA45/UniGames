// ══════════════════════════════════════════════════════════════════
//   UniGames — services/tiempoReal.js
// ══════════════════════════════════════════════════════════════════
// Canal de eventos en tiempo real con Server-Sent Events (SSE): una
// conexión HTTP que queda abierta y por la que el servidor va mandando
// mensajes. Se usa para:
//   · notificaciones nuevas (amistad, duelos, récords, avisos)
//   · avisos de prioridad alta (cartel en el medio de la pantalla)
//   · cambios de configuración del sitio (modo mantenimiento, juegos)
//   · logs del servidor en vivo (solo admins)
//
// Los clientes viven en memoria: con una sola instancia del servidor
// (Render free) alcanza. Ojo: este archivo NO usa console.* para no
// entrar en loop con services/logs.js, que manda cada log por acá.
// ══════════════════════════════════════════════════════════════════

const PING_MS = 25000; // Render corta conexiones sin tráfico a los ~60s

// usuarioId -> Set<res> (un usuario puede tener varias pestañas abiertas)
const usuarios = new Map();
// Conexiones de admins suscriptas a los logs: res -> usuarioId
const admins = new Map();
// Quien quiera enterarse de conexiones/desconexiones (dashboard "en línea")
const oyentesPresencia = new Set();

function escribir(res, evento, data) {
    if (res.writableEnded || res.destroyed) return; // ya cerrada: escribir tiraría un 'error' sin atrapar
    try {
        res.write(`event: ${evento}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
        /* conexión ya cerrada: se limpia en el 'close' */
    }
}

// Cabeceras SSE + ping periódico. Devuelve una función para cortar el ping.
function prepararRespuesta(req, res) {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // que ningún proxy lo acumule
    });
    // Un error de la conexión (cliente que se fue de golpe) nunca debe tirar el servidor
    res.on('error', () => {});
    res.write('retry: 5000\n\n');
    const ping = setInterval(() => {
        if (res.writableEnded || res.destroyed) return;
        try { res.write(': ping\n\n'); } catch { /* cerrada */ }
    }, PING_MS);
    return () => clearInterval(ping);
}

// ─── Canal de cada usuario ───

function suscribirUsuario(req, res, usuario) {
    const cortarPing = prepararRespuesta(req, res);
    let set = usuarios.get(usuario.id);
    if (!set) {
        set = new Set();
        usuarios.set(usuario.id, set);
    }
    set.add(res);
    escribir(res, 'hola', { usuarioId: usuario.id });
    avisarPresencia();

    req.on('close', () => {
        cortarPing();
        set.delete(res);
        if (set.size === 0) usuarios.delete(usuario.id);
        avisarPresencia();
    });
}

function enviarAUsuario(usuarioId, evento, data) {
    const set = usuarios.get(Number(usuarioId));
    if (!set) return 0;
    for (const res of set) escribir(res, evento, data);
    return set.size;
}

function enviarATodos(evento, data) {
    for (const set of usuarios.values()) {
        for (const res of set) escribir(res, evento, data);
    }
}

// Corta las conexiones de un usuario (ej. lo suspendieron).
function desconectarUsuario(usuarioId) {
    const set = usuarios.get(Number(usuarioId));
    if (!set) return;
    for (const res of set) {
        try { res.end(); } catch { /* ya cerrada */ }
    }
    usuarios.delete(Number(usuarioId));
    avisarPresencia();
}

function usuariosConectados() {
    return usuarios.size;
}

function estaConectado(usuarioId) {
    return usuarios.has(Number(usuarioId));
}

function idsConectados() {
    return [...usuarios.keys()];
}

// ─── Presencia (para el dashboard) ───

function avisarPresencia() {
    const enLinea = usuarios.size;
    for (const fn of oyentesPresencia) {
        try { fn(enLinea); } catch { /* que un oyente roto no corte al resto */ }
    }
}

function alCambiarPresencia(fn) {
    oyentesPresencia.add(fn);
}

// ─── Canal de admins (logs en vivo) ───

function suscribirAdmin(req, res, usuario) {
    const cortarPing = prepararRespuesta(req, res);
    admins.set(res, usuario.id);
    escribir(res, 'hola', { enLinea: usuarios.size });
    req.on('close', () => {
        cortarPing();
        admins.delete(res);
    });
}

function enviarAAdmins(evento, data) {
    for (const res of admins.keys()) escribir(res, evento, data);
}

// Si a alguien le sacan el rol de admin, se le cierra el canal de logs.
function desconectarAdmin(usuarioId) {
    for (const [res, id] of admins) {
        if (id === Number(usuarioId)) {
            admins.delete(res); // primero se saca, así ningún log le escribe después del end()
            try { res.end(); } catch { /* ya cerrada */ }
        }
    }
}

// Los admins conectados ven en vivo cuántos usuarios hay en línea.
alCambiarPresencia((enLinea) => enviarAAdmins('presencia', { enLinea }));

module.exports = {
    suscribirUsuario,
    enviarAUsuario,
    enviarATodos,
    desconectarUsuario,
    usuariosConectados,
    estaConectado,
    idsConectados,
    suscribirAdmin,
    enviarAAdmins,
    desconectarAdmin,
};
