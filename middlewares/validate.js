const validate = (schema) => (req, res, next) => {
    try {
        schema.parse(req.body);
        next();
    } catch (err) {
        // Formatear los errores de Zod para que sean amigables para el cliente
        const errorMessage = err.errors.map(e => e.message).join('. ');
        return res.status(400).json({ error: errorMessage });
    }
};

module.exports = { validate };
