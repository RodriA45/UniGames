// ══════════════════════════════════════════════════════════════════
//   UniGames — services/logs.js
// ══════════════════════════════════════════════════════════════════
// Registro de logs para el panel admin (pestaña "Logs"):
//   · captura console.log / info / warn / error del servidor
//   · registra cada pedido a la API (método, ruta, estado, tiempo, usuario)
//   · guarda los últimos MAX en memoria y los manda en vivo a los admins
//
// Se pierden al reiniciar el servidor (es un visor en vivo, no un archivo
// histórico). Nunca se registran cuerpos de pedidos, tokens ni query
// strings, para no dejar contraseñas o datos personales en los logs.
// ══════════════════════════════════════════════════════════════════

const util = require('util');
const tiempoReal = require('./tiempoReal');

const MAX = 1000;
const NIVELES = ['info', 'warn', 'error', 'http'];
const buffer = [];
let secuencia = 0;

function registrar(nivel, mensaje, extra = {}) {
    const entrada = {
        id: ++secuencia,
        ts: new Date().toISOString(),
        nivel: NIVELES.includes(nivel) ? nivel : 'info',
        mensaje: String(mensaje).slice(0, 4000),
        ...extra,
    };
    buffer.push(entrada);
    if (buffer.length > MAX) buffer.shift();
    tiempoReal.enviarAAdmins('log', entrada);
    return entrada;
}

function formatear(arg) {
    if (arg instanceof Error) return arg.stack || arg.message;
    if (typeof arg === 'string') return arg;
    return util.inspect(arg, { depth: 3, breakLength: Infinity });
}

// Envuelve console.* para que todo lo que ya se imprime en la terminal
// también llegue al panel. Se llama una sola vez, al arrancar.
let consolaCapturada = false;
function capturarConsola() {
    if (consolaCapturada) return;
    consolaCapturada = true;
    const mapa = { log: 'info', info: 'info', warn: 'warn', error: 'error' };
    for (const [metodo, nivel] of Object.entries(mapa)) {
        const original = console[metodo].bind(console);
        console[metodo] = (...args) => {
            original(...args);
            try {
                registrar(nivel, args.map(formatear).join(' '));
            } catch {
                /* un log nunca puede romper la app */
            }
        };
    }
}

// Middleware: un log por cada pedido a /api cuando termina.
// No se registran el canal SSE ni los pedidos del propio visor de logs
// (si no, abrir la pestaña Logs llenaría los logs de sí misma).
const IGNORAR = [/^\/api\/stream/, /^\/api\/admin\/logs/];

function middlewareHttp(req, res, next) {
    const ruta = req.originalUrl.split('?')[0];
    if (!ruta.startsWith('/api') || IGNORAR.some((re) => re.test(ruta))) return next();

    const inicio = process.hrtime.bigint();
    res.on('finish', () => {
        const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
        const s = res.statusCode;
        // 503 = modo mantenimiento (respuesta esperada, no una falla)
        const nivel = s >= 500 && s !== 503 ? 'error' : s >= 400 ? 'warn' : 'http';
        registrar(nivel, `${req.method} ${ruta} → ${s} (${ms.toFixed(0)} ms)`, {
            metodo: req.method,
            ruta,
            estado: s,
            ms: Math.round(ms),
            usuario: req.user ? req.user.username : null,
        });
    });
    next();
}

// Búsqueda en lo que hay en memoria. q busca en el mensaje y en el usuario
// (sin distinguir mayúsculas); nivel filtra por uno o varios niveles.
function buscar({ q = '', niveles = [], limite = 500 } = {}) {
    const texto = String(q).trim().toLowerCase();
    const filtroNiveles = niveles.filter((n) => NIVELES.includes(n));
    const resultado = [];
    for (let i = buffer.length - 1; i >= 0 && resultado.length < limite; i--) {
        const e = buffer[i];
        if (filtroNiveles.length && !filtroNiveles.includes(e.nivel)) continue;
        if (texto && !e.mensaje.toLowerCase().includes(texto) && !(e.usuario || '').toLowerCase().includes(texto)) continue;
        resultado.push(e);
    }
    return resultado.reverse(); // más viejo primero, como una terminal
}

function contarPorNivel() {
    const conteo = { info: 0, warn: 0, error: 0, http: 0 };
    for (const e of buffer) conteo[e.nivel]++;
    return conteo;
}

module.exports = { registrar, capturarConsola, middlewareHttp, buscar, contarPorNivel, NIVELES, MAX };
