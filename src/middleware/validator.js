const validateRequest = (schema, source = "body") => {
    return (req, res, next) => {
        const data = req[source];
        
        if (!schema) {
            return next();
        }
        
        const { error } = schema.validate(data);
        
        if (error) {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: error.details.map(detail => ({
                    field: detail.path.join("."),
                    message: detail.message
                })),
                code: "VALIDATION_ERROR",
                timestamp: new Date().toISOString()
            });
        }
        
        next();
    };
};

module.exports = { validateRequest };