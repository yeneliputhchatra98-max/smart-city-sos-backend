const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const logger = require("../utils/logger");
const { isBlacklisted } = require("../utils/tokenBlacklist");

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ISSUER = process.env.JWT_ISSUER;
const JWT_AUDIENCE = process.env.JWT_AUDIENCE;

if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is missing in .env");
}

// ===============================
// Verify JWT Token
// ===============================
const verifyToken = async (req, res, next) => {
    const clientIP = req.ip || req.connection?.remoteAddress;

    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
                code: "NO_TOKEN",
            });
        }

        if (!authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Invalid authorization format",
                code: "INVALID_FORMAT",
            });
        }

        const token = authHeader.split(" ")[1];
        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Token missing",
                code: "TOKEN_MISSING",
            });
        }

        if (isBlacklisted(token)) {
            return res.status(401).json({
                success: false,
                message: "Token revoked",
                code: "TOKEN_REVOKED",
            });
        }

        // Verify JWT
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET, {
                issuer: JWT_ISSUER,
                audience: JWT_AUDIENCE,
            });
        } catch (error) {
            return res.status(401).json({
                success: false,
                message:
                    error.name === "TokenExpiredError"
                        ? "Token expired"
                        : "Invalid token",
                code:
                    error.name === "TokenExpiredError"
                        ? "TOKEN_EXPIRED"
                        : "INVALID_TOKEN",
            });
        }

        // Find user + role
        const user = await prisma.user.findUnique({
            where: { id: decoded.id || decoded.userId },
            include: { role: true },
        });

        // ✅ Check user exists
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found",
                code: "USER_NOT_FOUND",
            });
        }

        // ✅ Check soft delete — សំខាន់បំផុត
        if (user.deletedAt || user.status === "DELETED") {
            return res.status(403).json({
                success: false,
                message: "Account has been deleted",
                code: "ACCOUNT_DELETED",
            });
        }

        // ✅ Check BLOCKED មុន ACTIVE
        if (user.status === "BLOCKED") {
            return res.status(403).json({
                success: false,
                message: "Account has been blocked",
                code: "ACCOUNT_BLOCKED",
            });
        }

        // ✅ Check INACTIVE / PENDING_VERIFICATION
        if (user.status !== "ACTIVE") {
            return res.status(403).json({
                success: false,
                message: "Account is not active",
                code: "ACCOUNT_INACTIVE",
            });
        }

        // ✅ BUG 2 FIX: Verify the specific session is still active.
        //   sessionId is embedded in the JWT by login/refresh — if it's present,
        //   we check that the Session row has not been revoked or expired.
        //   This makes logout take effect immediately without waiting for JWT expiry.
        if (decoded.sessionId) {
            const session = await prisma.session.findUnique({
                where: { id: decoded.sessionId },
                select: { revokedAt: true, expiresAt: true },
            });

            if (!session) {
                return res.status(401).json({
                    success: false,
                    message: "Session not found",
                    code: "SESSION_NOT_FOUND",
                });
            }

            if (session.revokedAt) {
                return res.status(401).json({
                    success: false,
                    message: "Session has been revoked",
                    code: "SESSION_REVOKED",
                });
            }

            if (session.expiresAt <= new Date()) {
                return res.status(401).json({
                    success: false,
                    message: "Session has expired",
                    code: "SESSION_EXPIRED",
                });
            }
        }

        // ✅ Pick fields — មិនដាក់ password/deletedAt
        req.user = {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            username: user.username,
            avatar: user.avatar,
            phone: user.phone,
            status: user.status,
            emailVerified: user.emailVerified,
            role: user.role ? user.role.name : null,
            roleId: user.roleId,
            organizationId: user.organizationId,
            sessionId: decoded.sessionId || null,
            tabId: decoded.tabId || null,
        };
        req.token = token;

        next();
    } catch (error) {
        logger.error(`Auth error: ${error.message} IP:${clientIP}`);
        return res.status(500).json({
            success: false,
            message: "Authentication server error",
        });
    }
};

// ===============================
// Role Authorization
// ===============================
const checkRole = (allowedRoles = []) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
                code: "UNAUTHORIZED",
            });
        }

        if (!req.user.role) {
            return res.status(403).json({
                success: false,
                message: "User role not assigned",
                code: "NO_ROLE",
            });
        }

        // ✅ Safe casting
        const userRole = String(req.user.role).toUpperCase();
        const roles = allowedRoles.map((r) => String(r).toUpperCase());

        if (!roles.includes(userRole)) {
            return res.status(403).json({
                success: false,
                message: "Access denied",
                code: "FORBIDDEN",
                requiredRoles: roles,
                currentRole: userRole,
            });
        }

        next();
    };
};

// ===============================
// Optional Auth (public endpoints)
// ===============================
const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return next();
    }

    try {
        const token = authHeader.split(" ")[1];
        if (isBlacklisted(token)) return next();

        const decoded = jwt.verify(token, JWT_SECRET, {
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
        });

        const user = await prisma.user.findUnique({
            where: { id: decoded.id || decoded.userId },
            include: { role: true },
        });

        if (user && !user.deletedAt && user.status === "ACTIVE") {
            req.user = {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                username: user.username,
                avatar: user.avatar,
                role: user.role ? user.role.name : null,
                roleId: user.roleId,
                organizationId: user.organizationId,
            };
            req.token = token;
        }
    } catch (e) {
        // Ignore — continue as anonymous
    }
    next();
};

module.exports = {
    verifyToken,
    checkRole,
    optionalAuth,
};