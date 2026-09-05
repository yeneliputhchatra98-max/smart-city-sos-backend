const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const path = require("path");
const fs = require("fs");

// =====================================================
// Load Environment Variables
// =====================================================
require("dotenv").config();

// =====================================================
// Utils
// =====================================================
const logger = require("./utils/logger");
const { errorHandler } = require("./middleware/errorHandler");
const { requestLogger } = require("./middleware/logger");

// =====================================================
// Initialize Express App
// =====================================================
const app = express();
// Railway reverse proxy
app.set("trust proxy", 1);
// =====================================================
// Ensure Log Directory Exists
// =====================================================
const logDir = path.join(__dirname, "logs");

if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// =====================================================
// Security Middleware - Helmet
// =====================================================
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", "data:", "https:"],
            },
        },

        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
        },
    })
);

// =====================================================
// CORS
// =====================================================

// Frontend URLs that are allowed to access this backend.
// Set CORS_ORIGINS in Railway as a comma-separated list.
const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:5173",
    ...(process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
];

const corsOptions = {
    origin: "http://localhost:3000",

    methods: [
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
    ],

    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Origin",
    ],

    credentials: true,

    optionsSuccessStatus: 204,

    maxAge: 86400,
};

app.use(cors(corsOptions));

// =====================================================
// Compression
// =====================================================
app.use(compression());

// =====================================================
// Body Parsers
// =====================================================
app.use(
    express.json({
        limit: "10mb",
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "10mb",
    })
);

// =====================================================
// Cookie Parser
// =====================================================
app.use(
    cookieParser(
        process.env.COOKIE_SECRET || "cookie-secret"
    )
);

// =====================================================
// Static Files
// =====================================================
app.use(
    "/uploads",
    express.static(
        path.join(__dirname, "uploads")
    )
);

app.use(
    "/public",
    express.static(
        path.join(__dirname, "public")
    )
);

// =====================================================
// Request Logging
// =====================================================
if (process.env.NODE_ENV === "development") {
    app.use(morgan("dev"));
} else {
    const accessLogStream = fs.createWriteStream(
        path.join(logDir, "access.log"),
        {
            flags: "a",
        }
    );

    app.use(
        morgan("combined", {
            stream: accessLogStream,
        })
    );
}

// =====================================================
// Global Rate Limiting
// =====================================================
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,

    max: 1000,

    standardHeaders: true,

    legacyHeaders: false,

    message: {
        success: false,
        message:
            "Too many requests, please try again later",
        code: "RATE_LIMITED",
    },

    skip: (req) => {
        return (
            req.path === "/health" ||
            req.path === "/ping"
        );
    },
});

app.use("/api", globalLimiter);

// =====================================================
// Custom Request Logger
// =====================================================
app.use(requestLogger);

// =====================================================
// Health Check
// =====================================================
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "healthy",

        uptime: process.uptime(),

        timestamp: new Date().toISOString(),

        environment:
            process.env.NODE_ENV || "development",

        memory: process.memoryUsage(),

        version:
            process.env.npm_package_version || "1.0.0",
    });
});

// =====================================================
// Ping
// =====================================================
app.get("/ping", (req, res) => {
    res.status(200).json({
        message: "pong",
    });
});

// =====================================================
// API Routes
// =====================================================

// Authentication
app.use(
    "/api/auth",
    require("./routes/auth.routes")
);

// Users
app.use(
    "/api/users",
    require("./routes/user.routes")
);

// Items
app.use(
    "/api/items",
    require("./routes/item.routes")
);

// SOS
app.use(
    "/api/sos",
    require("./routes/sos.routes")
);

// Organizations
app.use(
    "/api/orgs",
    require("./routes/org.routes")
);

// Stations
app.use(
    "/api/stations",
    require("./routes/station.routes")
);

// Rescue Agents
app.use(
    "/api/agents",
    require("./routes/agent.routes")
);

// Officers
app.use(
    "/api/officers",
    require("./routes/officer.routes")
);

// Emergency Broadcasts
app.use(
    "/api/broadcasts",
    require("./routes/broadcast.routes")
);

// Audit Logs
app.use(
    "/api/audit-logs",
    require("./routes/audit.routes")
);

// News
app.use(
    "/api/news",
    require("./routes/news.routes")
);

// Settings
app.use(
    "/api/settings",
    require("./routes/setting.routes")
);

// Roles & Permissions
app.use(
    "/api/roles-permissions",
    require("./routes/permission.routes")
);

// Reports
app.use(
    "/api/reports",
    require("./routes/report.routes")
);

// =====================================================
// Swagger API Documentation
// =====================================================
if (process.env.NODE_ENV !== "production") {
    const swaggerUi = require("swagger-ui-express");

    const swaggerDocument = require("./swagger.json");

    app.use(
        "/api-docs",
        swaggerUi.serve,
        swaggerUi.setup(swaggerDocument)
    );

    logger.info(
        "📚 Swagger docs available at /api-docs"
    );
}

// =====================================================
// 404 Handler
// =====================================================
app.use((req, res, next) => {
    res.status(404).json({
        success: false,

        message: `Route ${req.method} ${req.path} not found`,

        code: "ROUTE_NOT_FOUND",

        timestamp: new Date().toISOString(),
    });
});

// =====================================================
// Global Error Handler
// =====================================================
app.use(errorHandler);

// =====================================================
// Export App
// =====================================================
module.exports = app;