const sosService = require("../services/sos.service");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
// sos.controller.js
const listAlerts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { search, type, status } = req.query;

        const result = await sosService.listAlerts(page, limit, { search, type, status });

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
    req.files,
    req.user
);

        res.status(201).json({
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
    updateStatus,
    addMedia,
    deleteAlert
};