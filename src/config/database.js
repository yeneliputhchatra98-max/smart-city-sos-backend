const prisma = require("./prisma");
const logger = require("../utils/logger");

const initDatabase = async () => {
    try {
        await prisma.$connect();
        logger.info("Prisma connected to database successfully.");
        return prisma;
    } catch (error) {
        logger.error("Failed to connect to database:", error);
        throw error;
    }
};

module.exports = { initDatabase, prisma };
