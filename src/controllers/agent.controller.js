const agentService = require("../services/agent.service");
const sosService = require("../services/sos.service");

// Get all
exports.getAllAgents = async (req, res, next) => {
    try {
        const agents = await agentService.getAllAgents();
        res.json({
            success: true,
            data: agents,
        });
    } catch (err) {
        next(err);
    }
};

// Get available agents with filter (station, org, type, status)
exports.getAvailableAgents = async (req, res, next) => {
    try {
        const { stationId, organizationId, type, status } = req.query;
        const agents = await sosService.getAvailableAgents({
            stationId,
            organizationId,
            type,
            status: status || "AVAILABLE",
        });

        res.json({
            success: true,
            data: agents,
        });
    } catch (err) {
        next(err);
    }
};

// Get by id
exports.getAgentById = async (req, res, next) => {
    try {
        const agent = await agentService.getAgentById(req.params.id);
        if (!agent) {
            return res.status(404).json({
                success: false,
                message: "Agent not found"
            });
        }

        res.json({
            success: true,
            data: agent
        });
    } catch (err) {
        next(err);
    }
};

// Create
exports.createAgent = async (req, res, next) => {
    try {
        const agent = await agentService.createAgent(req.body);
        res.status(201).json({
            success: true,
            message: "Agent created successfully",
            data: agent
        });
    } catch (err) {
        next(err);
    }
};

// Update
exports.updateAgent = async (req, res, next) => {
    try {
        const agent = await agentService.updateAgent(
            req.params.id,
            req.body
        );

        res.json({
            success: true,
            message: "Agent updated successfully",
            data: agent
        });
    } catch (err) {
        next(err);
    }
};

// Update status and coordinates
exports.updateAgentStatus = async (req, res, next) => {
    try {
        const { status, lat, lng } = req.body;

        if (!status && lat === undefined && lng === undefined) {
            return res.status(400).json({
                success: false,
                message: "Status or coordinates (lat, lng) are required"
            });
        }

        const agent = await sosService.updateAgentStatus(
            req.params.id,
            status,
            { lat, lng }
        );

        res.json({
            success: true,
            message: "Agent status updated",
            data: agent
        });
    } catch (err) {
        next(err);
    }
};


// Delete
exports.deleteAgent = async (req, res, next) => {

    try {

        await agentService.deleteAgent(req.params.id);

        res.json({

            success: true,

            message: "Agent deleted successfully"

        });

    } catch (err) {

        next(err);

    }

};