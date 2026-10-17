const path = require("path");
const fs = require("fs");
const { PrismaClient } = require("@prisma/client");
const { getLocationFromGPS } = require("./location.service");
const {
    emitNewAlert,
    emitStatusUpdated,
    emitAlertDeleted,
    emitDispatchAgent,
    emitAgentStatusUpdate,
    emitAlertResolved,
} = require("../socket");

const prisma = new PrismaClient();

/**
 * 1. EMERGENCY_TO_ORG
 * Mapping of 7 EmergencyTypes to their corresponding OrganizationTypes
 *
 * 1. FIRE      -> FIRE (ពន្លត់អគ្គិភ័យ)
 * 2. MEDICAL   -> MEDICAL (សង្គ្រោះបន្ទាន់ / មន្ទីរពេទ្យ)
 * 3. POLICE    -> POLICE (នគរបាលជាតិ)
 * 4. ACCIDENT  -> POLICE (គ្រោះថ្នាក់ចរាចរណ៍ -> នគរបាល)
 * 5. CRIME     -> POLICE (បទល្មើស / ឧក្រិដ្ឋកម្ម -> នគរបាល)
 * 6. FLOOD     -> DISASTER (គ្រោះទឹកជំនន់ -> គ្រប់គ្រងគ្រោះមហន្តរាយ)
 * 7. DISASTER  -> DISASTER (គ្រោះមហន្តរាយធម្មជាតិ)
 *
 * @type {Readonly<Record<string, string>>}
 */
const EMERGENCY_TO_ORG = Object.freeze({
    FIRE: "FIRE",
    MEDICAL: "MEDICAL",
    POLICE: "POLICE",
    ACCIDENT: "POLICE",
    CRIME: "POLICE",
    FLOOD: "DISASTER",
    DISASTER: "DISASTER",
});

/**
 * Helper to transform uploaded file to public URL path
 *
 * @param {Object} file - Multer uploaded file object
 * @returns {string} Public accessible URL path
 */
const fileToUrl = (file) => {
    const folder = file.mimetype?.startsWith("video/") ? "videos" : "images";
    return `/uploads/${folder}/${file.filename}`;
};

/**
 * 2. calculateDistance
 * Calculate great-circle distance between two GPS coordinates using Haversine formula
 *
 * @param {number} lat1 - Latitude of starting point
 * @param {number} lon1 - Longitude of starting point
 * @param {number} lat2 - Latitude of destination point
 * @param {number} lon2 - Longitude of destination point
 * @returns {number} Distance in kilometers (km), rounded to 2 decimal places
 * @throws {Error} If coordinates are missing or invalid
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    try {
        if (
            lat1 === undefined || lat1 === null ||
            lon1 === undefined || lon1 === null ||
            lat2 === undefined || lat2 === null ||
            lon2 === undefined || lon2 === null
        ) {
            throw new Error("All coordinate parameters (lat1, lon1, lat2, lon2) are required");
        }

        const p1Lat = Number(lat1);
        const p1Lon = Number(lon1);
        const p2Lat = Number(lat2);
        const p2Lon = Number(lon2);

        if (isNaN(p1Lat) || isNaN(p1Lon) || isNaN(p2Lat) || isNaN(p2Lon)) {
            throw new Error("Coordinates must be valid numbers");
        }

        const toRad = (deg) => (deg * Math.PI) / 180;
        const R = 6371; // Earth's mean radius in km

        const dLat = toRad(p2Lat - p1Lat);
        const dLon = toRad(p2Lon - p1Lon);

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(p1Lat)) *
            Math.cos(toRad(p2Lat)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        return Math.round(distance * 100) / 100;
    } catch (error) {
        throw new Error(`calculateDistance error: ${error.message}`);
    }
};

/**
 * 3. estimateETA
 * Estimate arrival time in minutes based on distance and vehicle speed (default: 40 km/h)
 *
 * @param {number} distanceKm - Distance in kilometers
 * @param {number} [speedKmH=40] - Speed in km/h (default: 40 km/h)
 * @returns {number} Estimated Time of Arrival in minutes
 * @throws {Error} If distance or speed is invalid
 */
const estimateETA = (distanceKm, speedKmH = 40) => {
    try {
        const dist = Number(distanceKm);
        const speed = Number(speedKmH);

        if (isNaN(dist) || dist <= 0) return 0;
        if (isNaN(speed) || speed <= 0) {
            throw new Error("Speed must be a positive number greater than 0");
        }

        const timeInHours = dist / speed;
        const timeInMinutes = timeInHours * 60;

        return Math.max(1, Math.round(timeInMinutes));
    } catch (error) {
        throw new Error(`estimateETA error: ${error.message}`);
    }
};

/**
 * 4. autoAssignOrganizationAndStation
 * Find the closest organization and station based on incident emergency type and coordinates
 *
 * @param {string} emergencyType - Emergency incident type (FIRE, MEDICAL, POLICE, etc.)
 * @param {number} lat - Latitude of the emergency location
 * @param {number} lng - Longitude of the emergency location
 * @returns {Promise<{
 *   assignedOrganizationId: string|null,
 *   assignedOrganizationName: string|null,
 *   assignedStationId: string|null,
 *   assignedStationName: string|null,
 *   distance: number|null,
 *   eta: number|null,
 *   station: Object|null,
 *   organization: Object|null
 * }>}
 * @throws {Error} If query fails
 */
const autoAssignOrganizationAndStation = async (emergencyType, lat, lng) => {
    try {
        if (!emergencyType) {
            throw new Error("Emergency type is required for auto-assignment");
        }

        const normalizedType = String(emergencyType).toUpperCase();
        const targetOrgType = EMERGENCY_TO_ORG[normalizedType] || normalizedType;
        const alertLat = Number(lat);
        const alertLng = Number(lng);

        const hasValidCoords = !isNaN(alertLat) && !isNaN(alertLng);

        // ១. ស្វែងរក Station សកម្មតាមប្រភេទ OrganizationType
        let stations = await prisma.station.findMany({
            where: {
                type: targetOrgType,
                status: "ACTIVE",
                ...(hasValidCoords ? { lat: { not: null }, lng: { not: null } } : {}),
            },
            include: { organization: true },
        });

        // ២. Fallback បើពុំទាន់មាន Station ផ្ទាល់ (ឧ. DISASTER/FLOOD -> FIRE rescue, ACCIDENT -> POLICE)
        if (stations.length === 0) {
            let fallbackType = null;
            if (targetOrgType === "DISASTER" || targetOrgType === "FLOOD") {
                fallbackType = "FIRE";
            } else if (targetOrgType === "ACCIDENT" || targetOrgType === "CRIME") {
                fallbackType = "POLICE";
            }

            if (fallbackType) {
                stations = await prisma.station.findMany({
                    where: {
                        type: fallbackType,
                        status: "ACTIVE",
                        ...(hasValidCoords ? { lat: { not: null }, lng: { not: null } } : {}),
                    },
                    include: { organization: true },
                });
            }
        }

        // ៣. Fallback រក Station សកម្មណាដែលនៅជិតបំផុត
        if (stations.length === 0) {
            stations = await prisma.station.findMany({
                where: {
                    status: "ACTIVE",
                    ...(hasValidCoords ? { lat: { not: null }, lng: { not: null } } : {}),
                },
                include: { organization: true },
            });
        }

        // ៤. គណនារក Station ជិតបំផុតដោយប្រើ Haversine Formula
        if (stations.length > 0 && hasValidCoords) {
            let nearestStation = null;
            let minDistance = Infinity;

            for (const station of stations) {
                if (station.lat !== null && station.lng !== null) {
                    const dist = calculateDistance(alertLat, alertLng, station.lat, station.lng);
                    if (dist < minDistance) {
                        minDistance = dist;
                        nearestStation = station;
                    }
                }
            }

            if (nearestStation) {
                const eta = estimateETA(minDistance, 40);
                const org = nearestStation.organization || (nearestStation.organizationId ? await prisma.organization.findUnique({
                    where: { id: nearestStation.organizationId }
                }) : null);

                return {
                    assignedOrganizationId: org?.id || nearestStation.organizationId || null,
                    assignedOrganizationName: org?.name || null,
                    assignedStationId: nearestStation.id,
                    assignedStationName: nearestStation.name,
                    distance: minDistance,
                    eta,
                    station: nearestStation,
                    organization: org,
                };
            }
        }

        // ៥. Fallback តាម Organization GPS ប្រសិនបើ Station គ្មានកូអរដោនេ
        if (hasValidCoords) {
            const orgs = await prisma.organization.findMany({
                where: {
                    status: "ACTIVE",
                    gpsLat: { not: null },
                    gpsLng: { not: null },
                },
            });

            if (orgs.length > 0) {
                let nearestOrg = null;
                let minDistance = Infinity;

                for (const org of orgs) {
                    const dist = calculateDistance(alertLat, alertLng, org.gpsLat, org.gpsLng);
                    if (dist < minDistance) {
                        minDistance = dist;
                        nearestOrg = org;
                    }
                }

                if (nearestOrg) {
                    return {
                        assignedOrganizationId: nearestOrg.id,
                        assignedOrganizationName: nearestOrg.name,
                        assignedStationId: null,
                        assignedStationName: null,
                        distance: minDistance,
                        eta: estimateETA(minDistance, 40),
                        station: null,
                        organization: nearestOrg,
                    };
                }
            }
        }

        // ៦. Default Fallback
        if (stations.length > 0) {
            const defaultStation = stations[0];
            return {
                assignedOrganizationId: defaultStation.organizationId || defaultStation.organization?.id || null,
                assignedOrganizationName: defaultStation.organization?.name || null,
                assignedStationId: defaultStation.id,
                assignedStationName: defaultStation.name,
                distance: null,
                eta: null,
                station: defaultStation,
                organization: defaultStation.organization || null,
            };
        }

        return {
            assignedOrganizationId: null,
            assignedOrganizationName: null,
            assignedStationId: null,
            assignedStationName: null,
            distance: null,
            eta: null,
            station: null,
            organization: null,
        };
    } catch (error) {
        throw new Error(`autoAssignOrganizationAndStation error: ${error.message}`);
    }
};

/**
 * 5. createAlert
 * Create a new SOS Alert with auto-assignment of Organization & Station
 *
 * @param {Object} body - Alert data payload
 * @param {Array<Object>} [files=[]] - Files uploaded via multer
 * @param {Object} [user=null] - Authenticated user object (from token)
 * @returns {Promise<Object>} Created SOS Alert database record
 */
const createAlert = async (body, files = [], user = null) => {
    try {
        const {
            type,
            lat,
            lng,
            reportText,
            citizenName: inputCitizenName,
            phone: inputPhone,
            district: inputDistrict,
            province: inputProvince,
        } = body;

        if (!type) throw new Error("Emergency type is required");
        if (lat === undefined || lng === undefined) throw new Error("GPS coordinates (lat, lng) are required");

        const parsedLat = parseFloat(lat);
        const parsedLng = parseFloat(lng);
        if (isNaN(parsedLat) || isNaN(parsedLng)) throw new Error("Coordinates (lat, lng) must be valid numbers");

        // Citizen Details
        let citizenName = inputCitizenName;
        let phone = inputPhone;
        if (user && user.id) {
            const userData = await prisma.user.findUnique({ where: { id: user.id } });
            if (userData) {
                citizenName = citizenName || userData.fullName;
                phone = phone || userData.phone;
            }
        }
        citizenName = citizenName || "Citizen";
        phone = phone || "012000000";

        // District & Province from GPS
        let district = inputDistrict;
        let province = inputProvince;
        if (!district || !province) {
            try {
                const location = await getLocationFromGPS(parsedLat, parsedLng);
                district = district || location.district || "Siem Reap";
                province = province || location.province || "Siem Reap";
            } catch {
                district = district || "Siem Reap";
                province = province || "Siem Reap";
            }
        }

        // Media URLs
        const fileUrls = Array.isArray(files) ? files.map(fileToUrl) : [];
        const existingMedia = Array.isArray(body.mediaUrls) ? body.mediaUrls : [];
        const mediaUrls = [...existingMedia, ...fileUrls];

        // STAGE 1: Auto-assign Organization & Station
        const assignment = await autoAssignOrganizationAndStation(type, parsedLat, parsedLng);

        // Create Alert
        const alert = await prisma.sOSAlert.create({
            data: {
                citizenName,
                phone,
                type: type.toUpperCase(),
                district,
                province,
                lat: parsedLat,
                lng: parsedLng,
                reportText: reportText || "SOS Alert reported.",
                hasMedia: mediaUrls.length > 0,
                mediaUrls: mediaUrls.length > 0 ? mediaUrls : null,
                status: "PENDING",

                assignedOrganizationId: assignment.assignedOrganizationId,
                assignedOrganizationName: assignment.assignedOrganizationName,
                assignedStationId: assignment.assignedStationId,
                assignedStationName: assignment.assignedStationName,
            },
            include: {
                assignedOrganization: true,
                assignedStation: true,
                assignedAgent: true,
            },
        });

        // Broadcast Realtime Event
        emitNewAlert(alert);

        return {
            ...alert,
            estimatedDistanceKm: assignment.distance,
            estimatedEtaMinutes: assignment.eta,
        };
    } catch (error) {
        throw new Error(`createAlert error: ${error.message}`);
    }
};

/**
 * 6. dispatchAgent
 * Admin dispatches an agent to an SOS alert, updates status to EN_ROUTE
 *
 * @param {string} alertId - SOS alert ID
 * @param {string} agentId - Dispatched agent ID
 * @param {Object} [adminUser=null] - Dispatching admin/operator user object
 * @returns {Promise<{alert: Object, agent: Object}>} Updated alert and agent objects
 */
const dispatchAgent = async (alertId, agentId, adminUser = null) => {
    try {
        if (!alertId || !agentId) {
            throw new Error("Both alertId and agentId are required for dispatch");
        }

        // Verify Alert & Agent
        const alert = await prisma.sOSAlert.findUnique({
            where: { id: alertId },
            include: { assignedOrganization: true, assignedStation: true },
        });
        if (!alert) throw new Error(`Alert not found: ${alertId}`);

        const agent = await prisma.agent.findUnique({
            where: { id: agentId },
            include: { organization: true, station: true, assignedVehicle: true },
        });
        if (!agent) throw new Error(`Agent not found: ${agentId}`);

        // If alert was already assigned to a different agent, release that previous agent
        if (alert.assignedAgentId && alert.assignedAgentId !== agentId) {
            await prisma.agent.update({
                where: { id: alert.assignedAgentId },
                data: { status: "AVAILABLE", lastUpdated: new Date() },
            }).catch(() => {});

            const prevAgent = await prisma.agent.findUnique({
                where: { id: alert.assignedAgentId },
                include: { assignedVehicle: true, organization: true, station: true },
            }).catch(() => null);
            if (prevAgent?.assignedVehicle?.id) {
                await prisma.vehicle.update({
                    where: { id: prevAgent.assignedVehicle.id },
                    data: { status: "AVAILABLE" },
                }).catch(() => {});
            }
            if (prevAgent) {
                emitAgentStatusUpdate(prevAgent);
            }
        }

        // Update Agent status -> EN_ROUTE
        const updatedAgent = await prisma.agent.update({
            where: { id: agentId },
            data: {
                status: "EN_ROUTE",
                lastUpdated: new Date(),
            },
            include: { organization: true, station: true, assignedVehicle: true },
        });

        // Update assigned Vehicle to DISPATCHED
        if (agent.assignedVehicle?.id) {
            await prisma.vehicle.update({
                where: { id: agent.assignedVehicle.id },
                data: { status: "DISPATCHED" },
            }).catch(() => {});
        }

        // Update SOS alert -> EN_ROUTE
        const updatedAlert = await prisma.sOSAlert.update({
            where: { id: alertId },
            data: {
                status: "EN_ROUTE",
                assignedAgentId: updatedAgent.id,
                assignedAgentName: updatedAgent.name,
                assignedOrganizationId: alert.assignedOrganizationId || updatedAgent.organizationId,
                assignedOrganizationName: alert.assignedOrganizationName || updatedAgent.organization?.name,
                assignedStationId: alert.assignedStationId || updatedAgent.stationId,
                assignedStationName: alert.assignedStationName || updatedAgent.station?.name,
            },
            include: {
                assignedAgent: true,
                assignedOrganization: true,
                assignedStation: true,
            },
        });

        // Audit Log
        try {
            await prisma.auditLog.create({
                data: {
                    time: new Date().toLocaleTimeString("en-US", { hour12: false }),
                    event: `Agent ${updatedAgent.name} dispatched to SOS #${alertId}`,
                    userId: adminUser?.id || null,
                    userName: adminUser?.fullName || adminUser?.username || "Admin Dispatcher",
                },
            });
        } catch {
            // Non-blocking
        }

        // Emit Socket events
        emitDispatchAgent({
            alert: updatedAlert,
            agent: updatedAgent,
            dispatchedAt: new Date().toISOString(),
        });
        emitStatusUpdated(updatedAlert);
        emitAgentStatusUpdate(updatedAgent);

        return {
            alert: updatedAlert,
            agent: updatedAgent,
        };
    } catch (error) {
        throw new Error(`dispatchAgent error: ${error.message}`);
    }
};

/**
 * 7. updateAgentStatus
 * Update agent status and optional GPS latitude/longitude coordinates
 *
 * @param {string} agentId - Unique ID of the agent
 * @param {string} [status] - New agent status (AVAILABLE, ON_DUTY, OFFLINE, EN_ROUTE, ON_SCENE, RESOLVING)
 * @param {Object} [coords={}] - Optional GPS coordinates { lat, lng }
 * @returns {Promise<Object>} Updated agent record
 */
const updateAgentStatus = async (agentId, status, coords = {}) => {
    try {
        if (!agentId) throw new Error("agentId is required");

        const validStatuses = [
            "AVAILABLE",
            "ON_DUTY",
            "OFFLINE",
            "EN_ROUTE",
            "ON_SCENE",
            "RESOLVING",
        ];

        const updateData = { lastUpdated: new Date() };

        if (status) {
            const normalizedStatus = String(status).toUpperCase();
            if (!validStatuses.includes(normalizedStatus)) {
                throw new Error(`Invalid agent status: ${status}. Allowed: ${validStatuses.join(", ")}`);
            }
            updateData.status = normalizedStatus;
        }

        if (coords.lat !== undefined && coords.lat !== null) {
            const lat = parseFloat(coords.lat);
            if (!isNaN(lat)) updateData.lat = lat;
        }

        if (coords.lng !== undefined && coords.lng !== null) {
            const lng = parseFloat(coords.lng);
            if (!isNaN(lng)) updateData.lng = lng;
        }

        const updatedAgent = await prisma.agent.update({
            where: { id: agentId },
            data: updateData,
            include: { organization: true, station: true, assignedVehicle: true },
        });

        emitAgentStatusUpdate(updatedAgent);

        return updatedAgent;
    } catch (error) {
        throw new Error(`updateAgentStatus error: ${error.message}`);
    }
};

/**
 * 8. getAvailableAgents
 * Retrieve available agents with optional filters (station, organization, type)
 *
 * @param {Object} [filters={}] - Filter criteria
 * @param {string} [filters.stationId] - Filter by station ID
 * @param {string} [filters.organizationId] - Filter by organization ID
 * @param {string} [filters.type] - Filter by OrganizationType (POLICE, FIRE, MEDICAL, etc.)
 * @param {string} [filters.status='AVAILABLE'] - Filter by agent status (default: 'AVAILABLE')
 * @returns {Promise<Array<Object>>} List of matching agents
 */
const getAvailableAgents = async (filters = {}) => {
    try {
        const { stationId, organizationId, type, status = "AVAILABLE" } = filters;

        let typeCondition = undefined;
        if (type && type !== "all") {
            const upperType = String(type).toUpperCase();
            // Map emergency incident type to appropriate Organization/Agent type
            const TYPE_MAPPING = {
                MEDICAL: ["MEDICAL"],
                FIRE: ["FIRE"],
                POLICE: ["POLICE"],
                ACCIDENT: ["POLICE", "MEDICAL"],
                CRIME: ["POLICE"],
                FLOOD: ["DISASTER", "FIRE"],
                DISASTER: ["DISASTER", "FIRE"],
            };
            const mappedTypes = TYPE_MAPPING[upperType] || [upperType];
            if (mappedTypes.length === 1) {
                typeCondition = mappedTypes[0];
            } else {
                typeCondition = { in: mappedTypes };
            }
        }

        const where = {
            ...(status && status !== "all" ? { status: String(status).toUpperCase() } : {}),
            ...(stationId && stationId !== "all" ? { stationId } : {}),
            ...(organizationId && organizationId !== "all" ? { organizationId } : {}),
            ...(typeCondition ? { type: typeCondition } : {}),
        };

        return await prisma.agent.findMany({
            where,
            include: { organization: true, station: true, assignedVehicle: true },
            orderBy: { name: "asc" },
        });
    } catch (error) {
        throw new Error(`getAvailableAgents error: ${error.message}`);
    }
};

// ─── Existing SOS Handlers (Maintained for full system compatibility) ──────────
const listAlerts = async (page = 1, limit = 10, filters = {}) => {
    try {
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));
        const skip = (pageNum - 1) * limitNum;
        const { search, type, status, stationId, agentId } = filters;

        const where = {
            ...(type && type !== "all" ? { type: String(type).toUpperCase() } : {}),
            ...(status && status !== "all" ? { status: String(status).toUpperCase() } : {}),
            ...(stationId && stationId !== "all" ? { assignedStationId: stationId } : {}),
            ...(agentId && agentId !== "all" ? { assignedAgentId: agentId } : {}),
            ...(search ? {
                OR: [
                    { citizenName: { contains: search } },
                    { phone: { contains: search } },
                    { reportText: { contains: search } },
                    { district: { contains: search } },
                    { province: { contains: search } },
                ],
            } : {}),
        };

        const [alerts, total] = await Promise.all([
            prisma.sOSAlert.findMany({
                where,
                include: { assignedAgent: true, assignedOrganization: true, assignedStation: true },
                orderBy: { createdAt: "desc" },
                skip,
                take: limitNum,
            }),
            prisma.sOSAlert.count({ where }),
        ]);

        return {
            alerts,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum),
            },
        };
    } catch (error) {
        throw new Error(`listAlerts error: ${error.message}`);
    }
};

const getAlert = async (id) => {
    try {
        const alert = await prisma.sOSAlert.findUnique({
            where: { id },
            include: { assignedAgent: true, assignedOrganization: true, assignedStation: true },
        });
        if (!alert) throw new Error("Alert not found");
        return alert;
    } catch (error) {
        throw new Error(`getAlert error: ${error.message}`);
    }
};

const updateStatus = async (id, body) => {
    try {
        const { status, assignedAgentId, assignedAgentName } = body;
        const normalizedStatus = status ? status.toUpperCase() : undefined;

        const existingAlert = await prisma.sOSAlert.findUnique({
            where: { id },
            include: { assignedAgent: { include: { assignedVehicle: true } } },
        });
        if (!existingAlert) throw new Error("Alert not found");

        const updateData = {};
        if (normalizedStatus) {
            updateData.status = normalizedStatus;
            updateData.resolvedAt = normalizedStatus === "RESOLVED" ? new Date() : null;
        }
        if (assignedAgentId !== undefined) {
            updateData.assignedAgentId = assignedAgentId || null;
        }
        if (assignedAgentName !== undefined) {
            updateData.assignedAgentName = assignedAgentName || null;
        }

        // When alert is RESOLVED, SPAM, or reopened to PENDING without an agent:
        // Free the currently assigned agent so they are AVAILABLE for future alerts!
        const isFreeingAgent =
            normalizedStatus === "RESOLVED" ||
            normalizedStatus === "SPAM" ||
            (normalizedStatus === "PENDING" && !assignedAgentId) ||
            (assignedAgentId === null && existingAlert.assignedAgentId);

        if (isFreeingAgent && existingAlert.assignedAgentId) {
            const agentIdToFree = existingAlert.assignedAgentId;
            await prisma.agent.update({
                where: { id: agentIdToFree },
                data: { status: "AVAILABLE", lastUpdated: new Date() },
            }).catch(() => {});

            if (existingAlert.assignedAgent?.assignedVehicle?.id) {
                await prisma.vehicle.update({
                    where: { id: existingAlert.assignedAgent.assignedVehicle.id },
                    data: { status: "AVAILABLE" },
                }).catch(() => {});
            }

            const freedAgent = await prisma.agent.findUnique({
                where: { id: agentIdToFree },
                include: { organization: true, station: true, assignedVehicle: true },
            }).catch(() => null);
            if (freedAgent) {
                emitAgentStatusUpdate(freedAgent);
            }
        }

        const alert = await prisma.sOSAlert.update({
            where: { id },
            data: updateData,
            include: { assignedAgent: true, assignedOrganization: true, assignedStation: true },
        });
        emitStatusUpdated(alert);
        if (alert.status === "RESOLVED") {
            emitAlertResolved(alert);
        }
        return alert;
    } catch (error) {
        throw new Error(`updateStatus error: ${error.message}`);
    }
};

const addMedia = async (id, files = []) => {
    try {
        const alert = await prisma.sOSAlert.findUnique({ where: { id } });
        if (!alert) throw new Error("Alert not found");
        const oldMedia = alert.mediaUrls || [];
        const newMedia = files.map(fileToUrl);
        const updatedMedia = [...oldMedia, ...newMedia];

        const updatedAlert = await prisma.sOSAlert.update({
            where: { id },
            data: { mediaUrls: updatedMedia, hasMedia: true },
            include: { assignedAgent: true, assignedOrganization: true, assignedStation: true },
        });
        emitStatusUpdated(updatedAlert);
        return updatedAlert;
    } catch (error) {
        throw new Error(`addMedia error: ${error.message}`);
    }
};

const deleteAlert = async (id) => {
    try {
        const alert = await prisma.sOSAlert.findUnique({
            where: { id },
            include: { assignedAgent: { include: { assignedVehicle: true } } },
        });
        if (!alert) throw new Error("Alert not found");

        if (alert.assignedAgentId) {
            await prisma.agent.update({
                where: { id: alert.assignedAgentId },
                data: { status: "AVAILABLE", lastUpdated: new Date() },
            }).catch(() => {});

            if (alert.assignedAgent?.assignedVehicle?.id) {
                await prisma.vehicle.update({
                    where: { id: alert.assignedAgent.assignedVehicle.id },
                    data: { status: "AVAILABLE" },
                }).catch(() => {});
            }

            const freed = await prisma.agent.findUnique({
                where: { id: alert.assignedAgentId },
                include: { organization: true, station: true, assignedVehicle: true },
            }).catch(() => null);
            if (freed) emitAgentStatusUpdate(freed);
        }

        if (Array.isArray(alert.mediaUrls)) {
            alert.mediaUrls.forEach((url) => {
                const filePath = path.join(__dirname, "../../", url);
                if (fs.existsSync(filePath)) {
                    try { fs.unlinkSync(filePath); } catch {}
                }
            });
        }
        await prisma.sOSAlert.delete({ where: { id } });
        emitAlertDeleted(id);
        return true;
    } catch (error) {
        throw new Error(`deleteAlert error: ${error.message}`);
    }
};

module.exports = {
    EMERGENCY_TO_ORG,
    calculateDistance,
    estimateETA,
    autoAssignOrganizationAndStation,
    createAlert,
    dispatchAgent,
    updateAgentStatus,
    getAvailableAgents,
    listAlerts,
    getAlert,
    updateStatus,
    addMedia,
    deleteAlert,
};