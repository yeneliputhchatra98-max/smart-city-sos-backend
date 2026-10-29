const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");

let io;

const initSocket = (server) => {
    const rawOrigins = process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
        : [process.env.FRONTEND_URL || "http://localhost:3000", "http://localhost:3000", "http://127.0.0.1:3000"];

    io = new Server(server, {
        cors: {
            origin: (origin, callback) => {
                if (!origin) return callback(null, true);
                if (
                    rawOrigins.includes(origin) ||
                    rawOrigins.includes("*") ||
                    process.env.NODE_ENV === "development"
                ) {
                    return callback(null, origin);
                }
                return callback(new Error("Not allowed by CORS"));
            },
            methods: ["GET", "POST", "OPTIONS"],
            credentials: true
        },
        pingTimeout: 60000,
        pingInterval: 25000,
    });

    // ── JWT Authentication Middleware ──────────────────────────────
    io.use((socket, next) => {
        const token = socket.handshake.auth.token || socket.handshake.headers['authorization'];
        const tabId = socket.handshake.auth.tabId || socket.handshake.query?.tabId || null;
        socket.tabId = tabId;

        if (!token) {
            // Allow unauthenticated connections only for public SOS submissions
            socket.user = null;
            return next();
        }
        try {
            const actualToken = token.startsWith('Bearer ') ? token.slice(7) : token;
            const decoded = jwt.verify(actualToken, process.env.JWT_SECRET || "your-super-secret-jwt-key-change-this-now");
            socket.user = decoded;
            if (!socket.tabId && decoded.tabId) {
                socket.tabId = decoded.tabId;
            }
            next();
        } catch (err) {
            socket.user = null;
            next();
        }
    });

    io.on("connection", (socket) => {
        const userId = socket.user?.id ?? "anonymous";
        const role   = socket.user?.role ?? "PUBLIC";
        const tabId  = socket.tabId || "none";
        logger.info(`🔌 Socket connected: ${socket.id} (userId=${userId}, role=${role}, tabId=${tabId})`);

        // ── Room assignment ──────────────────────────────────────────
        // Join operators room to receive live SOS and agent GPS pushes
        socket.join("operators");
        if (socket.tabId) {
            socket.join(`tab:${socket.tabId}`);
        }
        logger.info(`Socket ${socket.id} joined room: operators`);

        // ── Client requests to join a specific alert room ────────────
        socket.on("join_alert", (alertId) => {
            socket.join(`alert:${alertId}`);
            logger.info(`Socket ${socket.id} joined room: alert:${alertId}`);
        });

        socket.on("leave_alert", (alertId) => {
            socket.leave(`alert:${alertId}`);
        });

        // ── Agent sends live GPS location update ─────────────────────
        socket.on("agent_location_update", (payload) => {
            // payload: { agentId, lat, lng }
            io.to("operators").emit("agent_location_updated", payload);
        });

        // ── Ping/pong for connection health check ─────────────────────
        socket.on("ping_check", () => {
            socket.emit("pong_check", { time: Date.now() });
        });

        socket.on("disconnect", (reason) => {
            logger.info(`🔌 Socket disconnected: ${socket.id} (reason: ${reason})`);
        });
    });

    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};

/**
 * Emit a new SOS alert to all operator clients.
 */
const emitNewAlert = (alert) => {
    try {
        getIO().emit("new_emergency", alert);
        logger.info(`📡 Broadcasted new_emergency: ${alert.id}`);
    } catch (e) {
        logger.warn(`Socket emit failed (new_emergency): ${e.message}`);
    }
};

/**
 * Emit a status change on an existing alert.
 */
const emitStatusUpdated = (alert) => {
    try {
        const activeIo = getIO();
        activeIo.emit("status_updated", alert);
        if (alert?.id) {
            activeIo.to(`alert:${alert.id}`).emit("status_updated", alert);
        }
        if (alert?.assignedAgentId) {
            activeIo.to(`agent:${alert.assignedAgentId}`).emit("status_updated", alert);
        }
        if (alert?.assignedAgent?.userId) {
            activeIo.to(`user:${alert.assignedAgent.userId}`).emit("status_updated", alert);
        }
        logger.info(`📡 Broadcasted status_updated: ${alert.id} → ${alert.status}`);
    } catch (e) {
        logger.warn(`Socket emit failed (status_updated): ${e.message}`);
    }
};

/**
 * Emit an alert deletion event.
 */
const emitAlertDeleted = (id) => {
    try {
        getIO().emit("alert_deleted", { id });
        logger.info(`📡 Broadcasted alert_deleted: ${id}`);
    } catch (e) {
        logger.warn(`Socket emit failed (alert_deleted): ${e.message}`);
    }
};

/**
 * Emit a broadcast/announcement to ALL connected clients.
 */
const emitBroadcastAlert = (broadcast) => {
    try {
        getIO().emit("broadcast_alert", broadcast);
        logger.info(`📡 Broadcasted broadcast_alert: ${broadcast.id}`);
    } catch (e) {
        logger.warn(`Socket emit failed (broadcast_alert): ${e.message}`);
    }
};

/**
 * Emit vehicle update to operators and admins.
 */
const emitVehicleUpdated = (vehicle) => {
    try {
        getIO().emit("vehicle_updated", vehicle);
        logger.info(`📡 Broadcasted vehicle_updated: ${vehicle.plateNumber || vehicle.id}`);
    } catch (e) {
        logger.warn(`Socket emit failed (vehicle_updated): ${e.message}`);
    }
};

/**
 * Emit hierarchy vehicle count change.
 */
const emitVehicleCountsChanged = (counts) => {
    try {
        getIO().emit("vehicle_counts_changed", counts);
        logger.info(`📡 Broadcasted vehicle_counts_changed: ${JSON.stringify(counts)}`);
    } catch (e) {
        logger.warn(`Socket emit failed (vehicle_counts_changed): ${e.message}`);
    }
};

/**
 * 9. Emit agent dispatch event (`agent:dispatched`) to operators and alert watchers.
 */
const emitDispatchAgent = (data) => {
    try {
        const activeIo = getIO();
        activeIo.emit("agent:dispatched", data);
        if (data?.agent?.id) {
            activeIo.to(`agent:${data.agent.id}`).emit("agent:assigned", data);
            activeIo.to(`agent:${data.agent.id}`).emit("agent:dispatched", data);
        }
        if (data?.agent?.userId) {
            activeIo.to(`user:${data.agent.userId}`).emit("agent:assigned", data);
            activeIo.to(`user:${data.agent.userId}`).emit("agent:dispatched", data);
        }
        if (data?.alert?.id) {
            activeIo.to(`alert:${data.alert.id}`).emit("agent:dispatched", data);
        }
        logger.info(`📡 Broadcasted agent:dispatched for Alert ${data?.alert?.id || 'N/A'}`);
    } catch (e) {
        logger.warn(`Socket emit failed (agent:dispatched): ${e.message}`);
    }
};

/**
 * 10. Emit agent status and coordinates update event (`agent:status:updated`).
 */
const emitAgentStatusUpdate = (agent) => {
    try {
        const activeIo = getIO();
        activeIo.emit("agent:status:updated", agent);

        if (agent?.lat !== undefined && agent?.lng !== undefined && agent?.lat !== null && agent?.lng !== null) {
            activeIo.emit("agent_location_updated", {
                agentId: agent.id,
                lat: agent.lat,
                lng: agent.lng,
                status: agent.status,
            });
        }
        logger.info(`📡 Broadcasted agent:status:updated for Agent ${agent?.name || agent?.id} -> ${agent?.status}`);
    } catch (e) {
        logger.warn(`Socket emit failed (agent:status:updated): ${e.message}`);
    }
};

/**
 * Emit alert resolved event (`alert:resolved`)
 */
const emitAlertResolved = (alert) => {
    try {
        const activeIo = getIO();
        activeIo.emit("alert:resolved", alert);
        if (alert?.id) {
            activeIo.to(`alert:${alert.id}`).emit("alert:resolved", alert);
        }
        logger.info(`📡 Broadcasted alert:resolved for Alert ${alert?.id}`);
    } catch (e) {
        logger.warn(`Socket emit failed (alert:resolved): ${e.message}`);
    }
};

const emitMissionDeclined = (payload) => {
    try {
        const activeIo = getIO();
        activeIo.emit("mission:declined", payload);
    } catch (e) {
        logger.warn(`Socket emit failed (mission:declined): ${e.message}`);
    }
};

const emitMissionAcknowledged = (payload) => {
    try {
        const activeIo = getIO();
        activeIo.emit("mission:acknowledged", payload);
        if (payload?.alert?.id) {
            activeIo.to(`alert:${payload.alert.id}`).emit("mission:acknowledged", payload);
        }
    } catch (e) {
        logger.warn(`Socket emit failed (mission:acknowledged): ${e.message}`);
    }
};

const emitMissionRerouted = (payload) => {
    try {
        const activeIo = getIO();
        activeIo.emit("mission:rerouted", payload);
        if (payload?.alert?.id) {
            activeIo.to(`alert:${payload.alert.id}`).emit("mission:rerouted", payload);
        }
    } catch (e) {
        logger.warn(`Socket emit failed (mission:rerouted): ${e.message}`);
    }
};

const emitDispatchEscalation = (payload) => {
    try {
        const activeIo = getIO();
        activeIo.emit("dispatch:escalated", payload);
    } catch (e) {
        logger.warn(`Socket emit failed (dispatch:escalated): ${e.message}`);
    }
};

const emitAutoDispatchSuccess = (payload) => {
    try {
        const activeIo = getIO();
        activeIo.emit("auto_dispatch:success", payload);
    } catch (e) {
        logger.warn(`Socket emit failed (auto_dispatch:success): ${e.message}`);
    }
};

const emitAutoDispatchFailed = (payload) => {
    try {
        const activeIo = getIO();
        activeIo.emit("auto_dispatch:failed", payload);
        logger.info(
            `⚠️ Broadcasted auto_dispatch:failed for Alert ${payload?.alertId}: ${payload?.reason}`
        );
    } catch (e) {
        logger.warn(`Socket emit failed (auto_dispatch:failed): ${e.message}`);
    }
};

const emitCitizenReportUpdated = (report) => {
    try {
        const activeIo = getIO();
        activeIo.emit("citizen_report:updated", report);
        logger.info(
            `📡 Broadcasted citizen_report:updated for Report #${report?.id} -> ${report?.status}`
        );
    } catch (e) {
        logger.warn(`Socket emit failed (citizen_report:updated): ${e.message}`);
    }
};

module.exports = {
    initSocket,
    getIO,
    emitNewAlert,
    emitStatusUpdated,
    emitAlertDeleted,
    emitBroadcastAlert,
    emitVehicleUpdated,
    emitVehicleCountsChanged,
    emitDispatchAgent,
    emitAgentStatusUpdate,
    emitAlertResolved,
    emitMissionDeclined,
    emitMissionAcknowledged,
    emitMissionRerouted,
    emitDispatchEscalation,
    emitAutoDispatchSuccess,
    emitAutoDispatchFailed,
    emitCitizenReportUpdated,
};

