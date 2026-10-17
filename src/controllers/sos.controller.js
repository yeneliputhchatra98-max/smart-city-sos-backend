const sosService = require("../services/sos.service");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
// sos.controller.js
const listAlerts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { search, type, status, stationId, agentId } = req.query;

        const result = await sosService.listAlerts(page, limit, {
            search,
            type,
            status,
            stationId,
            agentId,
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

const getAlert = async (req, res) => {
    try {
        const alert = await sosService.getAlert(req.params.id);

        res.json({
            success: true,
            data: alert
        });
    } catch (error) {
        res.status(500).json({
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
        const { agentId } = req.body;

        if (!agentId) {
            return res.status(400).json({
                success: false,
                message: "agentId is required",
            });
        }

        const result = await sosService.dispatchAgent(id, agentId, req.user);

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
        const alert = await sosService.updateStatus(req.params.id, req.body);

        res.json({
            success: true,
            data: alert
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const addMedia = async (req, res) => {
    try {
        const result = await sosService.addMedia(req.params.id, req.files);

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

module.exports = {
    listAlerts,
    getAlert,
    createAlert,
    dispatchAgent,
    updateStatus,
    addMedia,
    deleteAlert
};