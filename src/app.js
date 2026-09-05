const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const path = require("path");
const fs = require("fs");

// --- Load Environment ---
require("dotenv").config();

// --- Utils ---
const logger = require("./utils/logger");
const { errorHandler } = require("./middleware/errorHandler");
const { requestLogger } = require("./middleware/logger");

// --- Initialize App ---
const app = express();

// --- Ensure Log Directory Exists ---
const logDir = path.join(__dirname, "logs");
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// --- Security Middleware ---
app.use(helmet({
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
        preload: true
    }
}));

// --- CORS Configuration ---
const corsOptions = {
  origin: [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://smart-city-sos-backend-production.up.railway.app",
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
  ],
  credentials: true,
  maxAge: 86400,
};

app.use(cors(corsOptions));

// --- Compression ---
app.use(compression());

// --- Body Parsers ---
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser(process.env.COOKIE_SECRET || "cookie-secret"));

// --- Static Files ---
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/public", express.static(path.join(__dirname, "public")));

// --- Request Logging ---
if (process.env.NODE_ENV === "development") {
    app.use(morgan("dev"));
} else {
    // Create write stream for access logs
    const accessLogStream = fs.createWriteStream(
        path.join(logDir, "access.log"),
        { flags: "a" }
    );
    app.use(morgan("combined", { stream: accessLogStream }));
}

// --- Global Rate Limiting ---
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 1000 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many requests, please try again later",
        code: "RATE_LIMITED"
    },
    skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === "/health" || req.path === "/ping";
    }
});
app.use("/api", globalLimiter);

// --- Custom Request Logger ---
app.use(requestLogger);

// --- Health Check Endpoints ---
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "healthy",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development",
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || "1.0.0"
    });
});

app.get("/ping", (req, res) => {
    res.status(200).json({ message: "pong" });
});

// --- API Routes ---
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/users", require("./routes/user.routes"));
app.use("/api/items", require("./routes/item.routes"));
app.use("/api/sos", require("./routes/sos.routes"));
app.use("/api/orgs", require("./routes/org.routes"));
app.use("/api/stations", require("./routes/station.routes"));
app.use("/api/agents", require("./routes/agent.routes"));
app.use("/api/officers", require("./routes/officer.routes"));
app.use("/api/broadcasts", require("./routes/broadcast.routes"));
app.use("/api/audit-logs", require("./routes/audit.routes"));
app.use("/api/news", require("./routes/news.routes"));
app.use("/api/settings", require("./routes/setting.routes"));
app.use("/api/roles-permissions", require("./routes/permission.routes"));
app.use("/api/reports", require("./routes/report.routes"));

// --- API Documentation (Swagger) ---
if (process.env.NODE_ENV !== "production") {
    const swaggerUi = require("swagger-ui-express");
    const swaggerDocument = require("./swagger.json");
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
    logger.info("📚 Swagger docs available at /api-docs");
}

// --- 404 Handler ---
app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.path} not found`,
        code: "ROUTE_NOT_FOUND",
        timestamp: new Date().toISOString()
    });
});

// --- Global Error Handler ---
app.use(errorHandler);

// --- Export App ---
module.exports = app;