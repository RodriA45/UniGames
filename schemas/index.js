const { z } = require('zod');

// ══════════════════════════════════════
//   Esquemas de validación (Zod 4)
// ══════════════════════════════════════
// En Zod 4 los mensajes personalizados van en `error` (los
// `required_error` / `invalid_type_error` de Zod 3 ya no existen y se
// ignoraban en silencio: por eso salían los mensajes genéricos en inglés).
// `error` puede ser un texto o una función que recibe el problema: así se
// distingue "no vino el campo" de "vino con otro tipo".
const msgNumero = (campo) => ({
    error: (iss) => iss.input === undefined
        ? `${campo} es obligatorio`
        : `${campo} debe ser un número`,
});

// ─── Topes de puntaje por juego ───
// Puntaje máximo que puede dar una partida legítima de cada juego (según
// cómo puntúa hoy el front). No frena a alguien que mande 999 a mano con
// fetch, pero sí los valores absurdos que después ensucian el ranking y
// los números fuera de rango de la columna INTEGER.
// Si cambia la fórmula de puntos de un juego, hay que actualizarlo acá.
const MAX_PUNTOS = {
    1: 1000,      // Sopa de Letras: 8 palabras x hasta 60 pts (120s / 2)      = 480
    2: 1500,      // Preguntados: 10 preguntas x 150                           = 1500
    3: 600,       // Termina la Palabra: acierto al primer intento             = 600
    4: 1000,      // Ahorcado: palabra sin errores                             = 1000
    5: 25000,     // Adivina la Cosa: hasta 50 items x 500 (sin pistas)        = 25000
    6: 1500,      // Adivina la Palabra (Wordle): acierto al primer intento    = 1500
    7: 1000000,   // Pixel Runner: el modo infinito no tiene techo natural
    8: 5000,      // Castle Escape: hasta 20 niveles x 250 (100 + 3 estrellas) = 5000
};

// ─── Juegos ───
const partidaSchema = z.object({
    juego_id: z.number(msgNumero('El ID del juego'))
        .int('El ID del juego debe ser un entero')
        .refine((id) => Object.hasOwn(MAX_PUNTOS, id), { error: 'Juego inválido' }),
    puntos: z.number(msgNumero('Los puntos'))
        .int('Los puntos deben ser un número entero')
        .min(0, 'Los puntos no pueden ser negativos'),
    tematica_id: z.number(msgNumero('La temática'))
        .int('La temática debe ser un entero')
        .positive('La temática no es válida')
        .nullish(),
}).refine(
    // Si el juego no existe, ya lo reporta la validación de juego_id.
    (d) => !Object.hasOwn(MAX_PUNTOS, d.juego_id) || d.puntos <= MAX_PUNTOS[d.juego_id],
    { error: 'Puntaje fuera de rango', path: ['puntos'] }
);

module.exports = {
    partidaSchema,
    MAX_PUNTOS,
};
