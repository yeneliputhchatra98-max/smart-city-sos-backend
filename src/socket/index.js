const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");

let io;

const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : "*",
            methods: ["GET", "POST", "OPTIONS"],
            credentials: true
        },
        pingTimeout: 60000,
        pingInterval: 25000,
    });

    // ── JWT Authentication Middleware ──────────────────────────────
    io.use((socket, next) => {
        const token = socket.handshake.auth.token || socket.handshake.headers['authorization'];
        if (!token) {
            // Allow unauthenticated connections only for public SOS submissions
            socket.user = null;
            return next();
        }
        try {
            const actualToken = token.startsWith('Bearer ') ? token.slice(7) : token;
            const decoded = jwt.verify(actualToken, process.env.JWT_SECRET || "your-super-secret-jwt-key-change-this-now");
            socket.user = decoded;
            next();
        } catch (err) {
            socket.user = null;
            next();
        }
    });

    io.on("connection", (socket) => {
        const userId = socket.user?.id ?? "anonymous";
        const role   = socket.user?.role ?? "PUBLIC";
        logger.info(`🔌 Socket connected: ${socket.id} (userId=${userId}, role=${role})`);

        // ── Room assignment ──────────────────────────────────────────
        // Join operators room to receive live SOS and agent GPS pushes
        socket.join("operators");
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
 * Emit a new SOS alert to all operator clients in the "operators" room.
 */
const emitNewAlert = (alert) => {
    try {
        getIO().to("operators").emit("new_emergency", alert);
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
        getIO().to("operators").emit("status_updated", alert);
        // Also notify anyone watching that specific alert room
        getIO().to(`alert:${alert.id}`).emit("status_updated", alert);
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
        getIO().to("operators").emit("alert_deleted", { id });
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

module.exports = {
    initSocket,
    getIO,
    emitNewAlert,
    emitStatusUpdated,
    emitAlertDeleted,
    emitBroadcastAlert,
};
