const sosService = require("../services/sos.service");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
// sos.controller.js

// =====================================
// ✅ [Mobile Integration Fix] ទាញយកប្រវត្តិ SOS របស់ពលរដ្ឋផ្ទាល់ខ្លួន
// កំណត់ឱ្យទាញយកបានតែ Alert ណាដែលជារបស់ User នោះប៉ុណ្ណោះ (ការពារ Data Leak)
// =====================================
const getMyAlerts = async (req, res) => {
    try {
        const { status, page, limit } = req.query;
        const result = await sosService.getMyAlerts(req.user, { status, page, limit });
        res.json({
            success: true,
            data: result.alerts,
            pagination: result.pagination,
        });
    } catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message
        });
    }
};

const listAssignedAlerts = async (req, res) => {
    try {
        // ✅ [P0 Security Fix] ទប់ស្កាត់ Parameter Injection លើ agentId
        // បើជា AGENT/RESPONDER ត្រូវបង្ខំឱ្យប្រើ req.user.agentId ពី JWT
        const isPrivileged = req.user?.role === "ADMIN" || req.user?.role === "OPERATOR";
        const agentId = isPrivileged ? (req.query.agentId || req.user?.agentId) : req.user?.agentId;

        if (!agentId) {
            return res.status(403).json({
                success: false,
                message: "Forbidden: No responder agent profile associated with this account",
            });
        }
        const { status, page, limit } = req.query;
        const result = await sosService.getAssignedAlerts(agentId, { status, page, limit });
        res.json({
            success: true,
            data: result.alerts,
            pagination: result.pagination,
        });
    } catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message
        });
    }
};

const listAlerts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { search, type, status, stationId, agentId, excludeEscalated, isEscalated } = req.query;

        const result = await sosService.listAlerts(page, limit, {
            search,
            type,
            status,
            stationId,
            agentId,
            excludeEscalated: excludeEscalated === 'true' || excludeEscalated === true,
            isEscalated: isEscalated === 'true' || isEscalated === true,
        });

        res.json({
            success: true,
            data: result.alerts,
            pagination: result.pagination,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// =====================================
// ✅ [P0 Security Fix] ទាញយកព័ត៌មានលម្អិត SOS Alert
// បញ្ជូន req.user ទៅកាន់ Service ដើម្បីផ្ទៀងផ្ទាត់សិទ្ធិចូលមើល (IDOR Protection)
// =====================================
const getAlert = async (req, res) => {
    try {
        const alert = await sosService.getAlert(req.params.id, req.user);

        res.json({
            success: true,
            data: alert
        });
    } catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message
        });
    }
};

const createAlert = async (req, res) => {
    try {
        const alert = await sosService.createAlert(
            req.body,
            req.files || [],
            req.user || null
        );

        res.status(201).json({
            success: true,
            message: "SOS alert created successfully",
            data: alert,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const dispatchAgent = async (req, res) => {
    try {
        const { id } = req.params;
        const { agentId, dispatchReason } = req.body;

        if (!agentId) {
            return res.status(400).json({
                success: false,
                message: "agentId is required",
            });
        }

        const result = await sosService.dispatchAgent(id, agentId, req.user, dispatchReason);

        res.json({
            success: true,
            message: "Agent dispatched successfully",
            data: result,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const updateStatus = async (req, res) => {
    try {
        const alert = await sosService.updateStatus(req.params.id, req.body, req.user);

        res.json({
            success: true,
            data: alert
        });
    } catch (error) {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message
        });
    }
};

const addMedia = async (req, res) => {
    try {
        // ✅ [P0 Security Fix] បញ្ជូន req.user ទៅកាន់ Service ដើម្បីផ្ទៀងផ្ទាត់សិទ្ធិកាន់កាប់ (IDOR Protection)
        const result = await sosService.addMedia(req.params.id, req.files, req.user);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const deleteAlert = async (req, res) => {
    try {
        await sosService.deleteAlert(req.params.id);

        res.json({
            success: true,
            message: "Alert deleted successfully"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const declineMission = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason, agentId } = req.body || {};
        // ✅ [P0 Security Fix] Responder អាច decline បានតែ Mission របស់ខ្លួនឯងប៉ុណ្ណោះ
        const isPrivileged = req.user?.role === "ADMIN" || req.user?.role === "OPERATOR";
        const effectiveAgentId = isPrivileged ? (agentId || req.user?.agentId) : req.user?.agentId;

        const result = await sosService.declineMission(
            id,
            effectiveAgentId,
            reason || "Unable to respond",
            req.user
        );

        res.json({
            success: true,
            message: "Mission declined successfully and alert reverted for re-dispatch",
            data: result,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const acknowledgeMission = async (req, res) => {
    try {
        const { id } = req.params;
        const { agentId } = req.body || {};
        // ✅ [P0 Security Fix] Responder អាច accept បានតែ Mission របស់ខ្លួនឯងប៉ុណ្ណោះ
        const isPrivileged = req.user?.role === "ADMIN" || req.user?.role === "OPERATOR";
        const effectiveAgentId = isPrivileged ? (agentId || req.user?.agentId) : req.user?.agentId;

        const result = await sosService.acknowledgeMission(id, effectiveAgentId, req.user);

        res.json({
            success: true,
            message: "Mission acknowledged successfully",
            data: result,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const triggerAutoDispatch = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await sosService.evaluateAndAutoDispatch(id);

        if (!result) {
            return res.status(400).json({
                success: false,
                message: "Auto-dispatch could not find any available matching responders",
            });
        }

        res.json({
            success: true,
            message: "Auto-dispatch executed successfully",
            data: result,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const getCandidateAgents = async (req, res) => {
    try {
        const { id } = req.params;
        const alert = await sosService.getAlert(id);
        if (!alert) {
            return res.status(404).json({ success: false, message: "Alert not found" });
        }
        const candidates = await sosService.findCandidateAgents(alert);

        res.json({
            success: true,
            data: candidates,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const getAlertTimeline = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await sosService.getAlertTimeline(id);

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

module.exports = {
    listAlerts,
    getMyAlerts,
    listAssignedAlerts,
    getAlert,
    getAlertTimeline,
    createAlert,
    dispatchAgent,
    declineMission,
    acknowledgeMission,
    triggerAutoDispatch,
    getCandidateAgents,
    updateStatus,
    addMedia,
    deleteAlert,
};
