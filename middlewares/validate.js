// Valida req.body contra un schema de Zod (v4).
// - safeParse en vez de parse + try/catch: no depende del tipo de error.
// - En Zod 4 los errores están en error.issues (err.errors ya no existe).
// - req.body se reemplaza por el resultado: aplica defaults/transforms y
//   descarta los campos que no están en el schema.
const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
        const errorMessage = result.error.issues.map(e => e.message).join('. ');
        return res.status(400).json({ error: errorMessage });
    }
    req.body = result.data;
    next();
};

module.exports = { validate };
