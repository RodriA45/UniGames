const { z } = require('zod');

// --- ESQUEMAS DE AUTENTICACIÓN ---

const registerSchema = z.object({
    username: z.string()
        .min(3, "El nombre de usuario debe tener al menos 3 caracteres")
        .max(20, "El nombre de usuario no puede exceder 20 caracteres")
        .regex(/^[a-zA-Z0-9_]+$/, "El nombre de usuario solo puede contener letras, números y guiones bajos"),
    email: z.string()
        .email("El email ingresado no es válido"),
    password: z.string()
        .min(6, "La contraseña debe tener al menos 6 caracteres")
        .max(50, "La contraseña es demasiado larga")
});

const loginSchema = z.object({
    identity: z.string().min(1, "Debes ingresar tu usuario o email"),
    password: z.string().min(1, "Debes ingresar tu contraseña")
});

// --- ESQUEMAS DE JUEGOS ---

const partidaSchema = z.object({
    juego_id: z.number({
        required_error: "El ID del juego es obligatorio",
        invalid_type_error: "El ID del juego debe ser un número"
    }).int().positive(),
    puntos: z.number({
        required_error: "Los puntos son obligatorios",
        invalid_type_error: "Los puntos deben ser numéricos"
    }).min(0, "Los puntos no pueden ser negativos"),
    tematica_id: z.number().int().positive().optional().nullable()
});

module.exports = {
    registerSchema,
    loginSchema,
    partidaSchema
};
