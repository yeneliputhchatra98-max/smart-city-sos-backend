const sosService = require("../services/sos.service");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const listAlerts = async (req, res) => {
    try {
        const alerts = await sosService.listAlerts();

        res.json({
            success: true,
            data: alerts
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
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