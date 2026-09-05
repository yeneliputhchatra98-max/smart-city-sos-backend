require("dotenv").config();

const app = require("./app");
const logger = require("./utils/logger");
const { createServer } = require("http");
const prisma = require("./config/prisma");
const { initSocket } = require("./socket");

// --- Configuration ---
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";
const HOST = process.env.HOST || "0.0.0.0";


// --- Graceful Shutdown ---
const gracefulShutdown = async (server, signal) => {
    try {
        logger.info(`Received ${signal}, starting graceful shutdown...`);

        server.close(async () => {
            logger.info("HTTP server closed");

            try {
                await prisma.$disconnect();
                logger.info("Database connections closed");
            } catch (error) {
                logger.error(
                    `Database shutdown error: ${error.message}`
                );
            }

            process.exit(0);
        });


        // Force shutdown timeout
        setTimeout(() => {
            logger.error("Forced shutdown after timeout");
            process.exit(1);
        }, 10000);


    } catch (error) {
        logger.error(
            `Shutdown error: ${error.message}`
        );
        process.exit(1);
    }
};


// --- Create HTTP Server ---
const server = createServer(app);


// --- Initialize Socket.io ---
initSocket(server);


// --- Start Server ---
const startServer = async () => {

    try {

        // ===============================
        // Initialize Prisma Database
        // ===============================
        logger.info("Initializing database connection...");

        await prisma.$connect();

        logger.info(
            "Database connected successfully"
        );


        // ===============================
        // Start Listening
        // ===============================
        server.listen(PORT, HOST, () => {

            logger.info(
                `🚀 Server running on http://${HOST}:${PORT}`
            );

            logger.info(
                `📦 Environment: ${NODE_ENV}`
            );


            logger.info(
                `🕐 Started at: ${new Date().toISOString()}`
            );


            // Development Banner
            if (NODE_ENV === "development") {

                const boxWidth = 60;

                const topBorder =
                    "╔" + "═".repeat(boxWidth) + "╗";

                const bottomBorder =
                    "╚" + "═".repeat(boxWidth) + "╝";

                const emptyLine =
                    "║" + " ".repeat(boxWidth) + "║";


                const formatLine = (
                    emoji,
                    label,
                    value
                ) => {

                    const text =
                        `${label}: ${value}`;

                    const innerText =
                        `   ${emoji}  ${text}`;

                    const paddingNeeded =
                        boxWidth -
                        (7 + text.length);


                    return (
                        `║${innerText}` +
                        `${" ".repeat(
                            Math.max(0, paddingNeeded)
                        )}║`
                    );
                };


                const titleText =
                    "   🚀  Ratha[Black-Dragon] Server Active";


                const titlePadding =
                    boxWidth -
                    (
                        3 +
                        2 +
                        2 +
                        "Ratha[Black-Dragon] Server Active"
                            .length
                    );


                const titleLine =
                    `║${titleText}` +
                    `${" ".repeat(
                        Math.max(0, titlePadding)
                    )}║`;


                console.log(`

${topBorder}
${emptyLine}
${titleLine}
${emptyLine}
${formatLine(
                    "📡",
                    "Port",
                    PORT
                )}
${formatLine(
                    "🌍",
                    "Environment",
                    NODE_ENV
                )}
${formatLine(
                    "🕐",
                    "Started",
                    new Date().toLocaleString()
                )}
${emptyLine}
${formatLine(
                    "📚",
                    "API",
                    `http://localhost:${PORT}/api`
                )}
${formatLine(
                    "📖",
                    "Docs",
                    `http://localhost:${PORT}/api-docs`
                )}
${emptyLine}
${bottomBorder}

                `);
            }

        });



        // ===============================
        // Server Error Handler
        // ===============================
        server.on(
            "error",
            (error) => {

                if (
                    error.code === "EADDRINUSE"
                ) {

                    logger.error(
                        `Port ${PORT} is already in use`
                    );

                } else {

                    logger.error(
                        `Server error: ${error.message}`
                    );

                }

                process.exit(1);
            }
        );



        // ===============================
        // Shutdown Handlers
        // ===============================

        process.on(
            "SIGTERM",
            () =>
                gracefulShutdown(
                    server,
                    "SIGTERM"
                )
        );


        process.on(
            "SIGINT",
            () =>
                gracefulShutdown(
                    server,
                    "SIGINT"
                )
        );


        process.on(
            "SIGQUIT",
            () =>
                gracefulShutdown(
                    server,
                    "SIGQUIT"
                )
        );



        // ===============================
        // Error Handling
        // ===============================

        process.on(
            "uncaughtException",
            (error) => {

                logger.error(
                    `Uncaught Exception: ${error.message}`
                );

                gracefulShutdown(
                    server,
                    "uncaughtException"
                );
            }
        );


        process.on(
            "unhandledRejection",
            (reason) => {

                logger.error(
                    `Unhandled Rejection: ${reason}`
                );

                gracefulShutdown(
                    server,
                    "unhandledRejection"
                );
            }
        );


    } catch (error) {

        logger.error(
            `Failed to start server: ${error.message}`
        );

        process.exit(1);
    }
};


// Start Server
startServer();


module.exports = server;