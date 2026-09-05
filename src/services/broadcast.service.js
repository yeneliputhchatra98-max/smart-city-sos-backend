const { PrismaClient } = require("@prisma/client");
const { emitBroadcastAlert } = require("../socket");

const prisma = new PrismaClient();


// ==========================
// Get All Broadcasts
// ==========================
exports.getAllBroadcasts = async () => {

    return await prisma.broadcast.findMany({
        orderBy: {
            createdAt: "desc"
        }
    });

};


// ==========================
// Get Broadcast By ID
// ==========================
exports.getBroadcastById = async (id) => {

    return await prisma.broadcast.findUnique({
        where: {
            id: Number(id)
        }
    });

};


// ==========================
// Create Broadcast
// ==========================
exports.createBroadcast = async (data, user) => {

    const {
        title,
        message,
        level,
        type,
        targetAudience,
        targetProvinces,
        expiresAt
    } = data;

    const broadcast = await prisma.broadcast.create({

        data: {

            title,

            message,

            level: (level || "WARNING").toUpperCase(),

            type: (type || "SECURITY").toUpperCase(),

            targetAudience:
                (targetAudience || "ALL_CITIZENS").toUpperCase(),

            targetProvinces:
                Array.isArray(targetProvinces)
                    ? targetProvinces
                    : ["All Cambodia"],

            sentByName: user.fullName,

            sentByUserId: user.id,

            status: "ACTIVE",

            expiresAt: expiresAt
                ? new Date(expiresAt)
                : null

        }

    });

    emitBroadcastAlert(broadcast);

    return broadcast;

};


// ==========================
// Update Broadcast
// ==========================
exports.updateBroadcast = async (id, data) => {

    return await prisma.broadcast.update({

        where: {
            id: Number(id)
        },

        data

    });

};


// ==========================
// Update Status
// ==========================
exports.updateBroadcastStatus = async (id, status) => {

    return await prisma.broadcast.update({

        where: {
            id: Number(id)
        },

        data: {
            status: status.toUpperCase()
        }

    });

};


// ==========================
// Delete Broadcast
// ==========================
exports.deleteBroadcast = async (id) => {

    return await prisma.broadcast.delete({

        where: {
            id: Number(id)
        }

    });

};