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

    const clientIP =
        req.ip || req.connection.remoteAddress;

    try {

        const authHeader = req.headers.authorization;

        // Check Token
        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
                code: "NO_TOKEN"
            });
        }

        // Bearer Token Format
        if (!authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Invalid authorization format",
                code: "INVALID_FORMAT"
            });
        }

        const token = authHeader.split(" ")[1];
        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Token missing",
                code: "TOKEN_MISSING"
            });
        }

        // Check blacklist
        if (isBlacklisted(token)) {

            return res.status(401).json({
                success: false,
                message: "Token revoked",
                code: "TOKEN_REVOKED"
            });

        }

        // Verify JWT
        let decoded;

        try {

            decoded = jwt.verify(
                token,
                JWT_SECRET,
                {
                    issuer: JWT_ISSUER,
                    audience: JWT_AUDIENCE
                }
            );


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
                        : "INVALID_TOKEN"

            });

        }

        // Find User + Role
        const user = await prisma.user.findUnique({

            where: {
                id: decoded.id || decoded.userId
            },

            include: {
                role: true
            }

        });
        if (!user) {

            return res.status(401).json({

                success: false,
                message: "User not found"

            });

        }

        // Account Status

        if (user.status !== "ACTIVE") {

            return res.status(403).json({

                success: false,
                message: "Account is not active",
                code: "ACCOUNT_DISABLED"

            });

        }

        if (user.status === "BLOCKED") {

            return res.status(403).json({
                success: false,
                message: "Account blocked"
            });

        }
        // Attach User

        req.user = {

            id: user.id,
            email: user.email,
            fullName: user.fullName,
            // important
            role: user.role
                ? user.role.name
                : null,
            roleId: user.roleId,
            organizationId: user.organizationId,
            token: token

        };

        next();

    } catch (error) {


        logger.error(
            `Auth error: ${error.message} IP:${clientIP}`
        );

        return res.status(500).json({

            success: false,
            message: "Authentication server error"

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
                message: "Unauthorized"

            });

        }



        if (!req.user.role) {

            return res.status(403).json({

                success: false,
                message: "User role not assigned"

            });

        }



        const userRole =
            req.user.role.toUpperCase();



        const roles =
            allowedRoles.map(
                role => role.toUpperCase()
            );




        if (!roles.includes(userRole)) {


            return res.status(403).json({

                success: false,

                message: "Access denied",

                requiredRoles: roles,

                currentRole: userRole

            });


        }



        next();

    };


};



module.exports = {

    verifyToken,

    checkRole

};