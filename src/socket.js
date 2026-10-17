const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const logger = require("./utils/logger");

let io = null;

const initSocket = (server) => {
    const rawOrigins = process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
        : [
              process.env.FRONTEND_URL || "http://localhost:3000",
              "http://localhost:3000",
              "http://127.0.0.1:3000",
          ];

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
            credentials: true,
        },
        pingTimeout: 60000,
        pingInterval: 25000,
    });

    // JWT Authentication Middleware
    io.use((socket, next) => {
        const token =
            socket.handshake.auth.token ||
            socket.handshake.headers["authorization"];
        const tabId =
            socket.handshake.auth.tabId ||
            socket.handshake.query?.tabId ||
            null;
        socket.tabId = tabId;

        if (!token) {
            socket.user = null;
            return next();
        }

        try {
            const actualToken = token.startsWith("Bearer ")
                ? token.slice(7)
                : token;
            const decoded = jwt.verify(
                actualToken,
                process.env.JWT_SECRET ||
                    "your-super-secret-jwt-key-change-this-now"
            );
            socket.user = decoded;
            if (!socket.tabId && decoded.tabId) {
                socket.tabId = decoded.tabId;
            }
            next();
        } catch {
            socket.user = null;
            next();
        }
    });

    io.on("connection", (socket) => {
        const userId = socket.user?.id ?? "anonymous";
        const role = socket.user?.role ?? "PUBLIC";
        const tabId = socket.tabId || "none";
        logger.info(
            `🔌 Socket connected: ${socket.id} (userId=${userId}, role=${role}, tabId=${tabId})`
        );

        socket.join("operators");
        if (socket.tabId) {
            socket.join(`tab:${socket.tabId}`);
        }

        socket.on("join_alert", (alertId) => {
            socket.join(`alert:${alertId}`);
        });

        socket.on("leave_alert", (alertId) => {
            socket.leave(`alert:${alertId}`);
        });

        socket.on("agent_location_update", (payload) => {
            io.to("operators").emit("agent_location_updated", payload);
        });

        socket.on("ping_check", () => {
            socket.emit("pong_check", { time: Date.now() });
        });

        socket.on("disconnect", (reason) => {
            logger.info(
                `🔌 Socket disconnected: ${socket.id} (reason: ${reason})`
            );
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
 * 9. Emit agent dispatch event (`agent:dispatched`)
 *
 * @param {Object} data - Dispatch payload
 * @param {Object} data.alert - SOS alert data object
 * @param {Object} data.agent - Dispatched agent data object
 * @param {string} [data.dispatchedAt] - ISO timestamp
 */
const emitDispatchAgent = (data) => {
    try {
        const activeIo = getIO();
        activeIo.to("operators").emit("agent:dispatched", data);
        activeIo.emit("agent:dispatched", data);

        if (data?.alert?.id) {
            activeIo.to(`alert:${data.alert.id}`).emit("agent:dispatched", data);
        }

        logger.info(
            `📡 Broadcasted agent:dispatched for Alert ${data?.alert?.id || "N/A"} → Agent ${data?.agent?.name || data?.agent?.id || "N/A"}`
        );
    } catch (e) {
        logger.warn(`Socket emit failed (agent:dispatched): ${e.message}`);
    }
};

/**
 * 10. Emit agent status and coordinates update event (`agent:status:updated`)
 *
 * @param {Object} agent - Updated agent object containing status, lat, lng
 */
const emitAgentStatusUpdate = (agent) => {
    try {
        const activeIo = getIO();
        activeIo.to("operators").emit("agent:status:updated", agent);
        activeIo.emit("agent:status:updated", agent);

        if (agent?.lat !== undefined && agent?.lng !== undefined && agent?.lat !== null && agent?.lng !== null) {
            activeIo.to("operators").emit("agent_location_updated", {
                agentId: agent.id,
                lat: agent.lat,
                lng: agent.lng,
                status: agent.status,
            });
        }

        logger.info(
            `📡 Broadcasted agent:status:updated for Agent ${agent?.name || agent?.id} → ${agent?.status}`
        );
    } catch (e) {
        logger.warn(`Socket emit failed (agent:status:updated): ${e.message}`);
    }
};

const emitAlertResolved = (alert) => {
    try {
        const activeIo = getIO();
        activeIo.to("operators").emit("alert:resolved", alert);
        activeIo.emit("alert:resolved", alert);
        if (alert?.id) {
            activeIo.to(`alert:${alert.id}`).emit("alert:resolved", alert);
        }
        logger.info(`📡 Broadcasted alert:resolved for Alert ${alert?.id}`);
    } catch (e) {
        logger.warn(`Socket emit failed (alert:resolved): ${e.message}`);
    }
};

const emitNewAlert = (alert) => {
    try {
        getIO().to("operators").emit("new_emergency", alert);
        getIO().emit("new_emergency", alert);
    } catch (e) {
        logger.warn(`Socket emit failed (new_emergency): ${e.message}`);
    }
};

const emitStatusUpdated = (alert) => {
    try {
        getIO().to("operators").emit("status_updated", alert);
        getIO().to(`alert:${alert.id}`).emit("status_updated", alert);
    } catch (e) {
        logger.warn(`Socket emit failed (status_updated): ${e.message}`);
    }
};

const emitAlertDeleted = (id) => {
    try {
        getIO().to("operators").emit("alert_deleted", { id });
    } catch (e) {
        logger.warn(`Socket emit failed (alert_deleted): ${e.message}`);
    }
};

const emitBroadcastAlert = (broadcast) => {
    try {
        getIO().emit("broadcast_alert", broadcast);
    } catch (e) {
        logger.warn(`Socket emit failed (broadcast_alert): ${e.message}`);
    }
};

const emitVehicleUpdated = (vehicle) => {
    try {
        getIO().emit("vehicle_updated", vehicle);
    } catch (e) {
        logger.warn(`Socket emit failed (vehicle_updated): ${e.message}`);
    }
};

const emitVehicleCountsChanged = (counts) => {
    try {
        getIO().emit("vehicle_counts_changed", counts);
    } catch (e) {
        logger.warn(`Socket emit failed (vehicle_counts_changed): ${e.message}`);
    }
};

const emitAuditLogCreated = (log) => {
    try {
        getIO().emit("audit_log_created", log);
    } catch (e) {
        logger.warn(`Socket emit failed (audit_log_created): ${e.message}`);
    }
};

module.exports = {
    initSocket,
    getIO,
    emitDispatchAgent,
    emitAgentStatusUpdate,
    emitAlertResolved,
    emitNewAlert,
    emitStatusUpdated,
    emitAlertDeleted,
    emitBroadcastAlert,
    emitVehicleUpdated,
    emitVehicleCountsChanged,
    emitAuditLogCreated,
};
