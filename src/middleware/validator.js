// middleware/validator.js

const validateRequest = (schema, source = "body") => {
    return (req, res, next) => {
        // ✅ បើគ្មាន schema → ឆ្លងកាត់
        if (!schema) {
            return next();
        }

        const data = req[source];

        if (!data || typeof data !== "object") {
            return res.status(400).json({
                success: false,
                message: "Request body is required",
                code: "EMPTY_BODY",
                timestamp: new Date().toISOString(),
            });
        }

        // ✅ លុប empty strings, null, undefined ចេញ
        const cleaned = { ...data };
        for (const key in cleaned) {
            const value = cleaned[key];
            if (value === "" || value === null || value === undefined) {
                delete cleaned[key];
            }
        }

        // ✅ Validate ជាមួយ options ត្រឹមត្រូវ
        const { error, value } = schema.validate(cleaned, {
            abortEarly: false,      // បង្ហាញ error ទាំងអស់
            stripUnknown: true,     // លុប field ដែលគ្មានក្នុង schema
            convert: true,          // បំប្លែង type (string → Date)
            allowUnknown: false,
        });

        if (error) {
            const details = error.details.map((detail) => ({
                field: detail.path.join("."),
                message: detail.message,
            }));

            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: details,
                code: "VALIDATION_ERROR",
                timestamp: new Date().toISOString(),
            });
        }

        // ✅ ជំនួស req.body ដោយ value ដែល validate រួច
        req[source] = value;

        next();
    };
};

module.exports = { validateRequest };