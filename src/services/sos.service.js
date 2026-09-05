const path = require("path");
const fs = require("fs");
const {
    getLocationFromGPS
} = require("./location.service");
const { PrismaClient } = require("@prisma/client");

const {
    emitNewAlert,
    emitStatusUpdated,
    emitAlertDeleted
} = require("../socket");

const prisma = new PrismaClient();

const fileToUrl = (file) => {
    const folder = file.mimetype.startsWith("video/")
        ? "videos"
        : "images";

    return `/uploads/${folder}/${file.filename}`;
};

// =======================
// Get All Alerts
// =======================
const listAlerts = async (page = 1, limit = 10) => {

    const skip = (page - 1) * limit;

    const [alerts, total] = await Promise.all([

        prisma.sOSAlert.findMany({
            include: {
                assignedAgent: true
            },
            orderBy: {
                createdAt: "desc"
            },
            skip,
            take: limit
        }),

        prisma.sOSAlert.count()

    ]);

    return {
        alerts,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    };
};

// =======================
// Get One Alert
// =======================
const getAlert = async (id) => {

    const alert = await prisma.sOSAlert.findUnique({
        where: { id },
        include: {
            assignedAgent: true
        }
    });

    if (!alert) {
        throw new Error("Alert not found");
    }

    return alert;
};

// =======================
// Create Alert
// =======================
const createAlert = async (body, files = [], user) => {

    const {
        type,
        lat,
        lng,
        reportText
    } = body;


    // 1. Find citizen information from database
    const userData = await prisma.user.findUnique({
        where: {
            id: user.id
        }
    });


    if (!userData) {
        throw new Error("User not found");
    }


    // 2. Auto get district + province from GPS
    const location = await getLocationFromGPS(
        parseFloat(lat),
        parseFloat(lng)
    );


    // 3. Upload media
    const mediaUrls = files.map(fileToUrl);


    // 4. Create SOS Alert
    const alert = await prisma.sOSAlert.create({

        data: {

            // from User table
            citizenName: userData.fullName,
            phone: userData.phone,


            // SOS information
            type: type.toUpperCase(),


            // auto location
            district: location.district,
            province: location.province,


            // GPS
            lat: parseFloat(lat),
            lng: parseFloat(lng),


            // description
            reportText: reportText || "SOS Alert reported.",


            // media
            hasMedia: mediaUrls.length > 0,
            mediaUrls,


            // default
            status: "PENDING"
        }
    });


    // 5. Send realtime notification
    emitNewAlert(alert);


    return alert;
};


module.exports = {
    createAlert
};
// =======================
// Update Status
// =======================
const updateStatus = async (id, body) => {

    const {
        status,
        assignedAgentId,
        assignedAgentName
    } = body;

    const alert = await prisma.sOSAlert.update({

        where: { id },

        data: {
            status,

            assignedAgentId,
            assignedAgentName,

            resolvedAt:
                status === "RESOLVED"
                    ? new Date()
                    : null
        },

        include: {
            assignedAgent: true
        }

    });

    emitStatusUpdated(alert);

    return alert;
};

// =======================
// Add Media
// =======================
const addMedia = async (id, files = []) => {

    const alert = await prisma.sOSAlert.findUnique({
        where: { id }
    });

    if (!alert) {
        throw new Error("Alert not found");
    }

    const oldMedia = alert.mediaUrls || [];

    const newMedia = files.map(fileToUrl);

    const updatedMedia = [
        ...oldMedia,
        ...newMedia
    ];

    const updatedAlert = await prisma.sOSAlert.update({

        where: { id },

        data: {
            mediaUrls: updatedMedia,
            hasMedia: true
        }

    });

    emitStatusUpdated(updatedAlert);

    return updatedAlert;
};

// =======================
// Delete Alert
// =======================
const deleteAlert = async (id) => {

    const alert = await prisma.sOSAlert.findUnique({
        where: { id }
    });

    if (!alert) {
        throw new Error("Alert not found");
    }

    if (alert.mediaUrls) {

        alert.mediaUrls.forEach((url) => {

            const filePath = path.join(
                __dirname,
                "../../",
                url
            );

            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

        });
    }

    await prisma.sOSAlert.delete({
        where: { id }
    });

    emitAlertDeleted(id);

    return true;
};

module.exports = {
    listAlerts,
    getAlert,
    createAlert,
    updateStatus,
    addMedia,
    deleteAlert
};