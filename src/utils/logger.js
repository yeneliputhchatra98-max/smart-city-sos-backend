const winston = require("winston");
const path = require("path");
const fs = require("fs");

// Ensure logs directory exists
const logDir = path.join(__dirname, "../logs");
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        let log = `${timestamp} [${level.toUpperCase()}] ${message}`;
        if (Object.keys(meta).length > 0) {
            log += ` ${JSON.stringify(meta)}`;
        }
        if (stack) {
            log += `\n${stack}`;
        }
        return log;
    })
);

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || "info",
    format: logFormat,
    transports: [
        // Console transport (always active)
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        // File transport for errors
        new winston.transports.File({
            filename: path.join(logDir, "error.log"),
            level: "error",
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        // File transport for all logs
        new winston.transports.File({
            filename: path.join(logDir, "combined.log"),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        })
    ],
    exitOnError: false
});

// Create stream for morgan
logger.stream = {
    write: (message) => logger.info(message.trim())
};

module.exports = logger;