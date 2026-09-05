const auditService = require("../services/audit.service");

// Get Audit Logs
exports.getAuditLogs = async (req, res, next) => {
    try {

        const result = await auditService.getAuditLogs(req.query);

        return res.status(200).json({
            success: true,
            ...result
        });

    } catch (err) {
        next(err);
    }
};