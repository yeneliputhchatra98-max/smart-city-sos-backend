const express = require("express");
const router = express.Router();

const agentController = require("../controllers/agent.controller");

const {
    verifyToken,
    checkRole
} = require("../middleware/auth.middleware");

const {
    validateRequest
} = require("../middleware/validator");

const {
    createAgentSchema,
    updateAgentSchema
} = require("../validators/agent.validator");


// ==========================
// Get all agents
// ADMIN + OPERATOR
// ==========================
router.get(
    "/",
    verifyToken,
    checkRole(["ADMIN", "OPERATOR"]),
    agentController.getAllAgents
);


// ==========================
// Get agent by ID
// ADMIN + OPERATOR + AGENT
// ==========================
router.get(
    "/:id",
    verifyToken,
    checkRole(["ADMIN", "OPERATOR", "AGENT"]),
    agentController.getAgentById
);


// ==========================
// Create agent
// ADMIN + OPERATOR
// ==========================
router.post(
    "/",
    verifyToken,
    checkRole(["ADMIN", "OPERATOR"]),
    validateRequest(createAgentSchema),
    agentController.createAgent
);


// ==========================
// Update agent information
// ADMIN + OPERATOR + AGENT
// ==========================
router.put(
    "/:id",
    verifyToken,
    checkRole(["ADMIN", "OPERATOR", "AGENT"]),
    validateRequest(updateAgentSchema),
    agentController.updateAgent
);


// ==========================
// Update agent status
// ADMIN + OPERATOR + AGENT
// ==========================
router.patch(
    "/:id/status",
    verifyToken,
    checkRole(["ADMIN", "OPERATOR", "AGENT"]),
    agentController.updateAgentStatus
);


// ==========================
// Delete agent
// ADMIN + OPERATOR
// ==========================
router.delete(
    "/:id",
    verifyToken,
    checkRole(["ADMIN", "OPERATOR"]),
    agentController.deleteAgent
);

module.exports = router;