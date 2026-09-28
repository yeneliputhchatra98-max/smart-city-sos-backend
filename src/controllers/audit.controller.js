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
// =============================
// Create Audit Log
// =============================
exports.createAuditLog = async (req, res, next) => {
    try {
        const { event } = req.body;

        if (!event) {
            return res.status(400).json({
                success: false,
                message: "Event is required"
            });
        }

        const log = await auditService.createAuditLog(
            {
                event,
                userName: req.user?.fullName,
                userId: req.user?.id,
                ipAddress: req.ip
            },
            req.user?.id
        );

        return res.status(201).json({
            success: true,
            data: log
        });
    } catch (err) {
        next(err);
    }
};