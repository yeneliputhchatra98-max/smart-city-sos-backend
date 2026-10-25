const path = require("path");
const fs = require("fs");
const { PrismaClient } = require("@prisma/client");
const { getLocationFromGPS } = require("./location.service");
const { getSettings } = require("./setting.service");
const logger = require("../utils/logger");
const {
    emitNewAlert,
    emitStatusUpdated,
    emitAlertDeleted,
    emitDispatchAgent,
    emitAgentStatusUpdate,
    emitAlertResolved,
    emitMissionDeclined,
    emitMissionAcknowledged,
    emitMissionRerouted,
    emitDispatchEscalation,
    emitAutoDispatchSuccess,
    emitAutoDispatchFailed,
} = require("../socket");

const prisma = new PrismaClient();

// In-memory registry for active mission timers: alertId -> { timerId, agentId, expiresAt, timeoutSeconds }
const activeMissionTimers = new Map();


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
    FLOOD: "FIRE",
    DISASTER: "FIRE",
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

        // ── Audit Log: Citizen Reported (Traceability Step 1) ──
        try {
            const locDesc = [alert.district, alert.province].filter(Boolean).join(", ") || "Phnom Penh";
            const stationDesc = assignment.assignedStationName || assignment.assignedOrganizationName || "Central Dispatch";
            const distDesc = assignment.distance ? ` (~${assignment.distance.toFixed(1)}km away)` : "";
            await prisma.auditLog.create({
                data: {
                    time: new Date().toLocaleTimeString("en-US", { hour12: false }),
                    event: `🚨 CITIZEN REPORTED: SOS #${alert.id} (${alert.type}) reported by ${alert.citizenName} (${alert.phone}) at ${locDesc}. Initial routing: Station: ${stationDesc}${distDesc}.`,
                    userId: user?.id || null,
                    userName: alert.citizenName || user?.fullName || "Citizen App",
                },
            });
        } catch (_) {}

        // Broadcast Realtime Event
        emitNewAlert(alert);

        // STAGE 2: Auto-Dispatch Engine (Check Settings)
        try {
            const settings = await getSettings();
            const isAutoDispatch = String(settings?.autoDispatch).toLowerCase() === "true";
            if (isAutoDispatch) {
                setImmediate(async () => {
                    try {
                        await evaluateAndAutoDispatch(alert.id);
                    } catch (err) {
                        logger.error(`evaluateAndAutoDispatch async error: ${err.message}`);
                    }
                });
            }
        } catch (settingErr) {
            logger.warn(`Auto-dispatch check warning: ${settingErr.message}`);
        }

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
const dispatchAgent = async (alertId, agentId, adminUser = null, dispatchReason = null) => {
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
                status: "ON_DUTY",
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
                status: "ASSIGNED",
                assignedAt: new Date(),
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

        // ── Audit Log: Dispatched (Traceability Step 2) ──
        try {
            const isAuto = adminUser?.username === "AUTO_DISPATCH" || adminUser?.fullName === "System Auto-Dispatch";
            const isFallback = adminUser?.username === "AUTO_FALLBACK" || adminUser?.fullName === "System Fallback Engine";
            const actorName = isAuto ? "System Auto-Dispatch Engine" : (isFallback ? "System Fallback Engine" : (adminUser?.fullName || adminUser?.username || "Admin Dispatcher"));
            const rationaleText = dispatchReason || (isAuto ? "Auto-matched nearest responder by type & distance" : (isFallback ? "Fallback auto-reroute after timeout" : "Manual dispatch by command operator"));

            await prisma.auditLog.create({
                data: {
                    time: new Date().toLocaleTimeString("en-US", { hour12: false }),
                    event: `⚡ DISPATCHED: SOS #${alertId} assigned to Agent ${updatedAgent.name} (${updatedAgent.type || 'Responder'}). Dispatched by: ${actorName}. Rationale: "${rationaleText}".`,
                    userId: adminUser?.id || null,
                    userName: actorName,
                },
            });
        } catch {
            // Non-blocking
        }

        // Start Mission Timeout Timer (Default 45 seconds or from settings)
        let timeoutSec = 45;
        try {
            const settings = await getSettings();
            if (settings?.sosTimeout) {
                const parsed = parseInt(settings.sosTimeout, 10);
                if (!isNaN(parsed) && parsed >= 10) timeoutSec = parsed;
            }
        } catch {}
        startMissionTimeout(alertId, agentId, timeoutSec);

        // Emit Socket events
        emitDispatchAgent({
            alert: updatedAlert,
            agent: updatedAgent,
            dispatchedAt: new Date().toISOString(),
            timeoutSeconds: timeoutSec,
        });
        emitStatusUpdated(updatedAlert);
        emitAgentStatusUpdate(updatedAgent);

        return {
            alert: updatedAlert,
            agent: updatedAgent,
            timeoutSeconds: timeoutSec,
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
                FLOOD: ["FIRE"],
                DISASTER: ["FIRE", "POLICE"],
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

/**
 * Get alerts assigned to a specific responder (agent)
 */
const getAssignedAlerts = async (agentId, options = {}) => {
    try {
        if (!agentId) throw new Error("Agent ID is required");
        const { status = "active", page = 1, limit = 20 } = options;
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
        const skip = (pageNum - 1) * limitNum;

        let statusCondition = undefined;
        if (status === "active") {
            statusCondition = { in: ["ASSIGNED", "EN_ROUTE", "ARRIVED"] };
        } else if (status === "history" || status === "completed") {
            statusCondition = { in: ["RESOLVED", "SPAM"] };
        } else if (status && status !== "all") {
            statusCondition = String(status).toUpperCase();
        }

        const where = {
            assignedAgentId: agentId,
            ...(statusCondition ? { status: statusCondition } : {}),
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
        throw new Error(`getAssignedAlerts error: ${error.message}`);
    }
};

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

const updateStatus = async (id, body, user = null) => {
    try {
        const { status, assignedAgentId, assignedAgentName } = body;
        const normalizedStatus = status ? status.toUpperCase() : undefined;

        const existingAlert = await prisma.sOSAlert.findUnique({
            where: { id },
            include: { assignedAgent: { include: { assignedVehicle: true } } },
        });
        if (!existingAlert) throw new Error("Alert not found");

        // IDOR & transition validation for updateStatus
        if (user && String(user.role).toUpperCase() === "AGENT") {
            if (existingAlert.assignedAgentId !== user.agentId) {
                const err = new Error("Forbidden: You can only update incidents assigned to you");
                err.statusCode = 403;
                throw err;
            }

            // Allowed transitions for responder:
            // ASSIGNED -> EN_ROUTE
            // EN_ROUTE -> ARRIVED
            // ARRIVED -> RESOLVED
            const currentStatus = existingAlert.status;
            const targetStatus = normalizedStatus;

            const allowedTransitions = {
                ASSIGNED: ["EN_ROUTE", "ARRIVED", "RESOLVED"],
                EN_ROUTE: ["ARRIVED", "RESOLVED"],
                ARRIVED: ["RESOLVED"],
            };

            if (targetStatus && targetStatus !== currentStatus) {
                const validNext = allowedTransitions[currentStatus] || [];
                if (!validNext.includes(targetStatus)) {
                    const err = new Error(`Invalid status transition from ${currentStatus} to ${targetStatus}. Allowed: ${validNext.join(", ") || "None"}`);
                    err.statusCode = 400;
                    throw err;
                }
            }
        }
  

        const updateData = {};
        if (normalizedStatus) {
            updateData.status = normalizedStatus;
            if (normalizedStatus === "RESOLVED") updateData.resolvedAt = new Date();
            if (normalizedStatus === "ARRIVED") updateData.arrivedAt = new Date();
            if (normalizedStatus === "EN_ROUTE" && !existingAlert.assignedAt) updateData.assignedAt = new Date();
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
            normalizedStatus === "PENDING" ||
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
            clearMissionTimeout(id);
        }

        
        if (existingAlert.assignedAgentId && normalizedStatus) {
            let nextAgentStatus = null;
            if (normalizedStatus === "EN_ROUTE") nextAgentStatus = "EN_ROUTE";
            else if (normalizedStatus === "ARRIVED") nextAgentStatus = "ON_SCENE";
            else if (normalizedStatus === "RESOLVED") nextAgentStatus = "AVAILABLE";

            if (nextAgentStatus) {
                await prisma.agent.update({
                    where: { id: existingAlert.assignedAgentId },
                    data: { status: nextAgentStatus, lastUpdated: new Date() },
                }).catch(() => {});
            }
        }
  
        const alert = await prisma.sOSAlert.update({
            where: { id },
            data: updateData,
            include: { assignedAgent: true, assignedOrganization: true, assignedStation: true },
        });

        // ── Audit Log: Status Change (Traceability) ──
        try {
            const actorName = user?.fullName || user?.username || "Operator Dispatcher";
            let eventText = `🔄 STATUS UPDATED: SOS #${id} status changed from ${existingAlert.status} to ${alert.status} by ${actorName}.`;
            if (alert.status === "RESOLVED") {
                eventText = `🏁 MISSION RESOLVED: SOS #${id} marked as RESOLVED by ${actorName}. Mission successfully completed.`;
            } else if (alert.status === "SPAM") {
                eventText = `🚫 MARKED AS SPAM: SOS #${id} marked as SPAM/FALSE ALARM by ${actorName}.`;
            }
            await prisma.auditLog.create({
                data: {
                    time: new Date().toLocaleTimeString("en-US", { hour12: false }),
                    event: eventText,
                    userId: user?.id || null,
                    userName: actorName,
                },
            });
        } catch (_) {}

        emitStatusUpdated(alert);
        if (alert.status === "RESOLVED") {
            clearMissionTimeout(id);
            emitAlertResolved(alert);
        }
        return alert;
    } catch (error) {
        if (error.statusCode) throw error;
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
        clearMissionTimeout(id);
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

/**
 * 14. declineMission (Fallback Mechanism)
 * Agent / Operator declines a mission. Reverts alert status to PENDING and clears assignedAgentId,
 * restores agent status to AVAILABLE, logs audit record, and alerts operators for re-dispatch.
 */
const declineMission = async (alertId, agentId = null, reason = "Unable to respond", user = null) => {
    try {
        const alert = await prisma.sOSAlert.findUnique({
            where: { id: alertId },
            include: { assignedOrganization: true, assignedStation: true },
        });
        if (!alert) throw new Error(`Alert not found: ${alertId}`);

        // Identify target agent
        let targetAgentId = agentId || alert.assignedAgentId;
        if (!targetAgentId && user?.id) {
            const agentProfile = await prisma.agent.findFirst({
                where: { userId: user.id },
            }).catch(() => null);
            targetAgentId = agentProfile?.id;
        }

        let updatedAgent = null;
        if (targetAgentId) {
            const agent = await prisma.agent.findUnique({
                where: { id: targetAgentId },
                include: { assignedVehicle: true, organization: true, station: true },
            }).catch(() => null);

            if (agent) {
                // Restore agent to AVAILABLE
                updatedAgent = await prisma.agent.update({
                    where: { id: agent.id },
                    data: {
                        status: "AVAILABLE",
                        lastUpdated: new Date(),
                    },
                    include: { organization: true, station: true, assignedVehicle: true },
                }).catch(() => null);

                // Free vehicle back to AVAILABLE
                if (agent.assignedVehicle?.id) {
                    await prisma.vehicle.update({
                        where: { id: agent.assignedVehicle.id },
                        data: { status: "AVAILABLE" },
                    }).catch(() => {});
                }

                if (updatedAgent) {
                    emitAgentStatusUpdate(updatedAgent);
                }
            }
        }

        // Revert Alert status to PENDING, remove assigned agent
        const updatedAlert = await prisma.sOSAlert.update({
            where: { id: alertId },
            data: {
                status: "PENDING",
                assignedAgentId: null,
                assignedAgentName: null,
            },
            include: {
                assignedOrganization: true,
                assignedStation: true,
            },
        });

        // Clear fallback timeout timer
        clearMissionTimeout(alertId);

        // Record Audit Log for Traceability
        const actorName = user?.fullName || updatedAgent?.name || "Agent Responder";
        try {
            await prisma.auditLog.create({
                data: {
                    time: new Date().toLocaleTimeString("en-US", { hour12: false }),
                    event: `⚠️ MISSION DECLINED: ${actorName} declined SOS #${alertId}. Reason: "${reason}". Status reverted to PENDING for re-dispatch.`,
                    userId: user?.id || null,
                    userName: actorName,
                },
            });
        } catch {
            // Non-blocking
        }

        // Broadcast realtime socket events
        emitStatusUpdated(updatedAlert);
        emitMissionDeclined({
            alert: updatedAlert,
            agent: updatedAgent || { name: actorName },
            reason,
            time: new Date().toISOString(),
        });

        // Check if Auto-Routing is enabled to immediately dispatch Candidate #2
        try {
            const settings = await getSettings();
            const isAutoRouting = String(settings?.autoRouting).toLowerCase() === "true";
            if (isAutoRouting) {
                const fallbackCandidates = await findCandidateAgents(alert, [targetAgentId]);
                if (fallbackCandidates.length > 0) {
                    const nextAgent = fallbackCandidates[0];
                    logger.info(`Auto-routing SOS #${alertId} to next candidate ${nextAgent.name} after decline`);
                    setImmediate(async () => {
                        try {
                            const reDispatched = await dispatchAgent(
                                alert.id,
                                nextAgent.id,
                                { fullName: "Auto-Routing Engine", username: "AUTO_ROUTING", id: null }
                            );
                            emitMissionRerouted({
                                alert: reDispatched.alert,
                                prevAgent: updatedAgent || { name: actorName, id: targetAgentId },
                                newAgent: reDispatched.agent,
                                reason: `DECLINED: ${reason}`,
                                time: new Date().toISOString(),
                            });
                        } catch (e) {
                            logger.warn(`Auto-routing fallback error: ${e.message}`);
                        }
                    });
                }
            }
        } catch (routeErr) {
            logger.warn(`Auto-routing check error: ${routeErr.message}`);
        }

        return {
            success: true,
            alert: updatedAlert,
            agent: updatedAgent,
            reason,
        };
    } catch (error) {
        throw new Error(`declineMission error: ${error.message}`);
    }
};

/**
 * 15. startMissionTimeout & clearMissionTimeout
 * Countdown timer for unacknowledged missions.
 */
const startMissionTimeout = (alertId, agentId, timeoutSeconds = 45) => {
    clearMissionTimeout(alertId);

    const expiresAt = Date.now() + timeoutSeconds * 1000;
    const timerId = setTimeout(async () => {
        try {
            await handleMissionTimeout(alertId, agentId);
        } catch (err) {
            logger.error(`Error in handleMissionTimeout for Alert ${alertId}: ${err.message}`);
        } finally {
            activeMissionTimers.delete(alertId);
        }
    }, timeoutSeconds * 1000);

    activeMissionTimers.set(alertId, {
        timerId,
        agentId,
        expiresAt,
        timeoutSeconds,
    });
};

const clearMissionTimeout = (alertId) => {
    if (activeMissionTimers.has(alertId)) {
        const item = activeMissionTimers.get(alertId);
        if (item.timerId) clearTimeout(item.timerId);
        activeMissionTimers.delete(alertId);
    }
};

/**
 * 16. findCandidateAgents
 * Find and rank available candidate agents by emergency type and GPS distance
 */
const findCandidateAgents = async (alert, excludeAgentIds = []) => {
    try {
        const alertLat = Number(alert.lat);
        const alertLng = Number(alert.lng);
        const hasValidCoords = !isNaN(alertLat) && !isNaN(alertLng);

        // Fetch available agents matching the emergency type
        const availableAgents = await getAvailableAgents({
            type: alert.type,
            status: "AVAILABLE",
        });

        const candidates = availableAgents.filter(
            (a) => !excludeAgentIds.includes(a.id)
        );

        // Rank by distance
        const ranked = candidates.map((agent) => {
            let lat = agent.lat;
            let lng = agent.lng;
            // Fallback to station coordinates
            if ((lat === null || lat === undefined || isNaN(Number(lat))) && agent.station) {
                lat = agent.station.lat;
                lng = agent.station.lng;
            }
            // Fallback to org coordinates
            if ((lat === null || lat === undefined || isNaN(Number(lat))) && agent.organization) {
                lat = agent.organization.gpsLat;
                lng = agent.organization.gpsLng;
            }

            let distanceKm = 999;
            const parsedLat = Number(lat);
            const parsedLng = Number(lng);
            if (hasValidCoords && !isNaN(parsedLat) && !isNaN(parsedLng)) {
                try {
                    distanceKm = calculateDistance(alertLat, alertLng, parsedLat, parsedLng);
                } catch {
                    distanceKm = 999;
                }
            }

            const eta = estimateETA(distanceKm, 40);

            return {
                ...agent,
                distanceKm,
                eta,
            };
        });

        // Sort ascending by distance
        ranked.sort((a, b) => a.distanceKm - b.distanceKm);

        return ranked;
    } catch (err) {
        logger.error(`findCandidateAgents error: ${err.message}`);
        return [];
    }
};

/**
 * 17. evaluateAndAutoDispatch
 * Automatically assign top matching candidate agent to a pending SOS alert
 */
const evaluateAndAutoDispatch = async (alertId) => {
    try {
        const alert = await prisma.sOSAlert.findUnique({
            where: { id: alertId },
            include: { assignedOrganization: true, assignedStation: true },
        });

        if (!alert || alert.status !== "PENDING") {
            return null;
        }

        const candidates = await findCandidateAgents(alert);
        if (candidates.length === 0) {
            logger.warn(`Auto-dispatch: No available candidate agents found for SOS Alert #${alertId}`);
            emitAutoDispatchFailed({
                alertId,
                type: alert.type,
                reason: "No available matching responders found",
            });
            return null;
        }

        const topCandidate = candidates[0];
        logger.info(
            `🤖 Auto-dispatch: Assigning Agent ${topCandidate.name} (${topCandidate.type}, ${topCandidate.distanceKm}km, ETA ~${topCandidate.eta}m) to Alert #${alertId}`
        );

        // Dispatch agent with system user context and explicit rationale
        const autoRationale = `AI Geo-dispatch: Auto-matched Rank #1 unit (${topCandidate.type}, ${topCandidate.distanceKm}km away, ETA ~${topCandidate.eta}m, Station: ${topCandidate.stationName || 'Nearest Command'})`;
        const result = await dispatchAgent(
            alert.id,
            topCandidate.id,
            { fullName: "System Auto-Dispatch Engine", username: "AUTO_DISPATCH", id: null },
            autoRationale
        );

        emitAutoDispatchSuccess({
            alert: result.alert,
            agent: result.agent,
            distanceKm: topCandidate.distanceKm,
            eta: topCandidate.eta,
            timeoutSeconds: 45,
        });

        return result;
    } catch (error) {
        logger.error(`evaluateAndAutoDispatch error for Alert ${alertId}: ${error.message}`);
        return null;
    }
};

/**
 * 18. handleMissionTimeout
 * Triggered when an assigned agent fails to respond within the countdown period
 */
const handleMissionTimeout = async (alertId, targetAgentId) => {
    const alert = await prisma.sOSAlert.findUnique({
        where: { id: alertId },
        include: { assignedAgent: true, assignedOrganization: true, assignedStation: true },
    });

    if (!alert) return;

    // If alert has already been resolved or reassigned, ignore
    if (alert.status === "RESOLVED" || alert.status === "SPAM") return;
    if (alert.assignedAgentId !== targetAgentId) return;

    const timedOutAgent = alert.assignedAgent;
    const agentName = timedOutAgent?.name || "Responder";

    logger.warn(`⏱️ Mission timeout: Agent ${agentName} did not respond to SOS #${alertId} in time.`);

    // 1. Free timed-out agent back to AVAILABLE
    if (targetAgentId) {
        await prisma.agent.update({
            where: { id: targetAgentId },
            data: { status: "AVAILABLE", lastUpdated: new Date() },
        }).catch(() => {});

        const updatedAgentRecord = await prisma.agent.findUnique({
            where: { id: targetAgentId },
            include: { organization: true, station: true, assignedVehicle: true },
        }).catch(() => null);

        if (updatedAgentRecord?.assignedVehicle?.id) {
            await prisma.vehicle.update({
                where: { id: updatedAgentRecord.assignedVehicle.id },
                data: { status: "AVAILABLE" },
            }).catch(() => {});
        }
        if (updatedAgentRecord) {
            emitAgentStatusUpdate(updatedAgentRecord);
        }
    }

    // 2. Log Audit Record
    try {
        await prisma.auditLog.create({
            data: {
                time: new Date().toLocaleTimeString("en-US", { hour12: false }),
                event: `⏱️ DISPATCH TIMEOUT: Agent ${agentName} failed to acknowledge SOS #${alertId} within time limit. Initiating fallback re-route.`,
                userId: null,
                userName: "System Fallback Engine",
            },
        });
    } catch {}

    // 3. Search for fallback candidate #2 (excluding timed out agent)
    const fallbackCandidates = await findCandidateAgents(alert, [targetAgentId]);

    if (fallbackCandidates.length > 0) {
        const nextAgent = fallbackCandidates[0];
        logger.info(`🔄 Fallback Re-route: Re-dispatching SOS #${alertId} to Agent ${nextAgent.name}`);

        const reDispatched = await dispatchAgent(
            alert.id,
            nextAgent.id,
            { fullName: "System Fallback Engine", username: "AUTO_FALLBACK", id: null }
        );

        // Audit log for re-route
        try {
            await prisma.auditLog.create({
                data: {
                    time: new Date().toLocaleTimeString("en-US", { hour12: false }),
                    event: `🔄 FALLBACK RE-ROUTE: SOS #${alertId} re-routed to Agent ${nextAgent.name} (Rank #2, ${nextAgent.distanceKm}km away) after Agent ${agentName} timed out.`,
                    userId: null,
                    userName: "System Fallback Engine",
                },
            });
        } catch {}

        emitMissionRerouted({
            alert: reDispatched.alert,
            prevAgent: timedOutAgent || { name: agentName, id: targetAgentId },
            newAgent: reDispatched.agent,
            reason: "TIMEOUT_NO_RESPONSE",
            time: new Date().toISOString(),
        });
    } else {
        // No other agent available: Revert alert to PENDING and escalate to Operators
        const revertedAlert = await prisma.sOSAlert.update({
            where: { id: alertId },
            data: {
                status: "PENDING",
                assignedAgentId: null,
                assignedAgentName: null,
            },
            include: { assignedOrganization: true, assignedStation: true },
        });

        try {
            await prisma.auditLog.create({
                data: {
                    time: new Date().toLocaleTimeString("en-US", { hour12: false }),
                    event: `🚨 ESCALATION: Agent ${agentName} timed out on SOS #${alertId} and NO fallback responders are available. Alert reverted to PENDING for urgent operator dispatch.`,
                    userId: null,
                    userName: "System Fallback Engine",
                },
            });
        } catch {}

        emitStatusUpdated(revertedAlert);
        emitDispatchEscalation({
            alert: revertedAlert,
            timedOutAgent: timedOutAgent || { name: agentName, id: targetAgentId },
            reason: "TIMEOUT_NO_REPLACEMENT_AVAILABLE",
            time: new Date().toISOString(),
        });
    }
};

/**
 * 19. acknowledgeMission (Agent Accept / Acknowledge Mission)
 * Agent confirms acceptance of the dispatched mission, clearing the timeout fallback timer.
 */
const acknowledgeMission = async (alertId, agentId = null, user = null) => {
    try {
        const alert = await prisma.sOSAlert.findUnique({
            where: { id: alertId },
            include: { assignedAgent: true, assignedOrganization: true, assignedStation: true },
        });
        if (!alert) throw new Error(`Alert not found: ${alertId}`);

        // Clear fallback timeout timer
        clearMissionTimeout(alertId);

        let targetAgentId = agentId || alert.assignedAgentId;
        if (!targetAgentId && user?.id) {
            const agentProfile = await prisma.agent.findFirst({
                where: { userId: user.id },
            }).catch(() => null);
            targetAgentId = agentProfile?.id;
        }

        const agent = targetAgentId ? await prisma.agent.findUnique({
            where: { id: targetAgentId },
            include: { organization: true, station: true, assignedVehicle: true },
        }) : alert.assignedAgent;

        const actorName = user?.fullName || agent?.name || "Responder";

        // Audit Log
        try {
            await prisma.auditLog.create({
                data: {
                    time: new Date().toLocaleTimeString("en-US", { hour12: false }),
                    event: `✅ MISSION ACKNOWLEDGED: ${actorName} accepted SOS #${alertId} and confirmed en-route.`,
                    userId: user?.id || null,
                    userName: actorName,
                },
            });
        } catch {}

        emitMissionAcknowledged({
            alert,
            agent,
            time: new Date().toISOString(),
        });

        return {
            success: true,
            alert,
            agent,
            acknowledgedAt: new Date().toISOString(),
        };
    } catch (error) {
        throw new Error(`acknowledgeMission error: ${error.message}`);
    }
};

/**
 * 20. getAlertTimeline
 * Complete Life-Cycle Audit Trail & Traceability Timeline for SOS Alert
 * Answers: Who dispatched, when, why, and what fallbacks occurred.
 */
const getAlertTimeline = async (alertId) => {
    try {
        const alert = await prisma.sOSAlert.findUnique({
            where: { id: alertId },
            include: {
                assignedAgent: {
                    include: {
                        station: true,
                        organization: true,
                        assignedVehicle: true,
                    },
                },
                assignedOrganization: true,
                assignedStation: true,
            },
        });

        if (!alert) {
            throw new Error(`Alert #${alertId} not found`);
        }

        // Fetch all audit logs referencing this alert ID
        const logs = await prisma.auditLog.findMany({
            where: {
                event: {
                    contains: alertId,
                },
            },
            include: {
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        role: true,
                        badgeId: true,
                    },
                },
            },
            orderBy: {
                createdAt: "asc",
            },
        });

        const timeline = [];

        const categorizeEvent = (eventStr = "") => {
            const str = eventStr.toUpperCase();
            if (str.includes("REPORTED") || str.includes("CREATED") || str.includes("CITIZEN REPORTED")) {
                return {
                    type: "REPORTED",
                    titleKh: "ពលរដ្ឋបានរាយការណ៍",
                    titleEn: "Citizen Reported",
                    icon: "alert-circle",
                    color: "red",
                    stepIndex: 1,
                };
            }
            if (str.includes("TIMEOUT")) {
                return {
                    type: "TIMEOUT",
                    titleKh: "ផុតកំណត់ ៤៥វិនាទី (Timeout)",
                    titleEn: "Dispatch Timeout",
                    icon: "clock",
                    color: "amber",
                    stepIndex: 2,
                };
            }
            if (str.includes("FALLBACK RE-ROUTE") || str.includes("REROUTED") || str.includes("RE-ROUTED")) {
                return {
                    type: "REROUTED",
                    titleKh: "ផ្ទេរបេសកកម្មស្វ័យប្រវត្តិ (Fallback Re-route)",
                    titleEn: "Fallback Re-route",
                    icon: "refresh-cw",
                    color: "purple",
                    stepIndex: 2,
                };
            }
            if (str.includes("ESCALATION")) {
                return {
                    type: "ESCALATED",
                    titleKh: "បញ្ជូនដំណឹងបន្ទាន់ទៅកាន់ Dispatcher",
                    titleEn: "Dispatch Escalation",
                    icon: "alert-triangle",
                    color: "red",
                    stepIndex: 2,
                };
            }
            if (str.includes("DECLINED")) {
                return {
                    type: "DECLINED",
                    titleKh: "ភ្នាក់ងារបានបដិសេធ (Declined)",
                    titleEn: "Mission Declined",
                    icon: "x-circle",
                    color: "amber",
                    stepIndex: 2,
                };
            }
            if (str.includes("AUTO-DISPATCH") || str.includes("AUTO-ASSIGN")) {
                return {
                    type: "AUTO_DISPATCH",
                    titleKh: "ប្រព័ន្ធចាត់តាំងស្វ័យប្រវត្តិ (AI Auto-Dispatch)",
                    titleEn: "System Auto-Dispatch",
                    icon: "zap",
                    color: "emerald",
                    stepIndex: 2,
                };
            }
            if (str.includes("DISPATCHED") || str.includes("DISPATCH")) {
                return {
                    type: "DISPATCHED",
                    titleKh: "ចាត់តាំងភ្នាក់ងារ (Dispatched)",
                    titleEn: "Agent Dispatched",
                    icon: "send",
                    color: "blue",
                    stepIndex: 2,
                };
            }
            if (str.includes("ACKNOWLEDGED") || str.includes("ACCEPTED")) {
                return {
                    type: "ACKNOWLEDGED",
                    titleKh: "ភ្នាក់ងារបានទទួលបេសកកម្ម",
                    titleEn: "Mission Acknowledged",
                    icon: "check-circle",
                    color: "emerald",
                    stepIndex: 3,
                };
            }
            if (str.includes("ON_SCENE") || str.includes("ON SCENE") || str.includes("ARRIVED")) {
                return {
                    type: "ON_SCENE",
                    titleKh: "បានទៅដល់កន្លែងកើតហេតុ (On Scene)",
                    titleEn: "Arrived On Scene",
                    icon: "map-pin",
                    color: "blue",
                    stepIndex: 4,
                };
            }
            if (str.includes("RESOLVED")) {
                return {
                    type: "RESOLVED",
                    titleKh: "បានដោះស្រាយចប់សព្វគ្រប់",
                    titleEn: "Mission Resolved",
                    icon: "check-circle-2",
                    color: "teal",
                    stepIndex: 5,
                };
            }
            if (str.includes("SPAM")) {
                return {
                    type: "SPAM",
                    titleKh: "សម្គាល់ជា Spam / ក្លែងក្លាយ",
                    titleEn: "Marked as Spam",
                    icon: "ban",
                    color: "gray",
                    stepIndex: 5,
                };
            }
            return {
                type: "GENERAL",
                titleKh: "បច្ចុប្បន្នភាពស្ថានភាព",
                titleEn: "Status Update",
                icon: "info",
                color: "blue",
                stepIndex: 3,
            };
        };

        logs.forEach((log) => {
            const cat = categorizeEvent(log.event);
            timeline.push({
                id: log.id,
                timestamp: log.createdAt,
                time: log.time,
                type: cat.type,
                titleKh: cat.titleKh,
                titleEn: cat.titleEn,
                icon: cat.icon,
                color: cat.color,
                stepIndex: cat.stepIndex,
                actor: {
                    name: log.userName || log.user?.fullName || "System",
                    role: (typeof log.user?.role === "object" ? log.user?.role?.name : log.user?.role) || "SYSTEM",
                    badgeId: log.user?.badgeId || null,
                },
                event: log.event,
            });
        });

        // If no audit logs exist (e.g. legacy alerts), synthesize baseline timeline:
        if (timeline.length === 0) {
            timeline.push({
                id: `legacy-create-${alert.id}`,
                timestamp: alert.createdAt,
                time: new Date(alert.createdAt).toLocaleTimeString("en-US", { hour12: false }),
                type: "REPORTED",
                titleKh: "ពលរដ្ឋបានរាយការណ៍",
                titleEn: "Citizen Reported",
                icon: "alert-circle",
                color: "red",
                stepIndex: 1,
                actor: { name: alert.citizenName, role: "CITIZEN", badgeId: null },
                event: `SOS reported by ${alert.citizenName} (${alert.phone}) at ${alert.district}, ${alert.province}.`,
            });

            if (alert.assignedAgentId) {
                timeline.push({
                    id: `legacy-dispatch-${alert.id}`,
                    timestamp: alert.updatedAt,
                    time: new Date(alert.updatedAt).toLocaleTimeString("en-US", { hour12: false }),
                    type: "DISPATCHED",
                    titleKh: "ចាត់តាំងភ្នាក់ងារ (Dispatched)",
                    titleEn: "Agent Dispatched",
                    icon: "send",
                    color: "blue",
                    stepIndex: 2,
                    actor: { name: "Dispatcher / System", role: "OPERATOR", badgeId: null },
                    event: `Dispatched to Agent ${alert.assignedAgentName || alert.assignedAgent?.name || "Responder"}.`,
                });
            }

            if (alert.status === "RESOLVED") {
                const resTime = alert.resolvedAt || alert.updatedAt;
                timeline.push({
                    id: `legacy-resolved-${alert.id}`,
                    timestamp: resTime,
                    time: new Date(resTime).toLocaleTimeString("en-US", { hour12: false }),
                    type: "RESOLVED",
                    titleKh: "បានដោះស្រាយចប់សព្វគ្រប់",
                    titleEn: "Mission Resolved",
                    icon: "check-circle-2",
                    color: "teal",
                    stepIndex: 5,
                    actor: { name: "Command Center", role: "OPERATOR", badgeId: null },
                    event: `Mission resolved and closed.`,
                });
            }
        }

        // Calculate Response & Performance Metrics
        const reportLog = timeline.find((t) => t.type === "REPORTED");
        const dispatchLog = timeline.find((t) => t.type === "DISPATCHED" || t.type === "AUTO_DISPATCH");
        const ackLog = timeline.find((t) => t.type === "ACKNOWLEDGED");
        const resolveLog = timeline.find((t) => t.type === "RESOLVED");

        const reportedAt = reportLog ? new Date(reportLog.timestamp) : new Date(alert.createdAt);
        const dispatchedAt = dispatchLog ? new Date(dispatchLog.timestamp) : null;
        const acknowledgedAt = ackLog ? new Date(ackLog.timestamp) : null;
        const resolvedAt = resolveLog ? new Date(resolveLog.timestamp) : (alert.resolvedAt ? new Date(alert.resolvedAt) : null);

        const dispatchDelaySeconds = (dispatchedAt && reportedAt)
            ? Math.max(0, Math.round((dispatchedAt.getTime() - reportedAt.getTime()) / 1000))
            : null;

        const acceptanceDelaySeconds = (acknowledgedAt && dispatchedAt)
            ? Math.max(0, Math.round((acknowledgedAt.getTime() - dispatchedAt.getTime()) / 1000))
            : null;

        const totalDurationSeconds = (resolvedAt && reportedAt)
            ? Math.max(0, Math.round((resolvedAt.getTime() - reportedAt.getTime()) / 1000))
            : null;

        let dispatchedBy = "N/A";
        let dispatchReason = "Standard emergency assignment";
        if (dispatchLog) {
            dispatchedBy = dispatchLog.actor?.name || "System";
            const match = dispatchLog.event.match(/Rationale:\s*"([^"]+)"/i) || dispatchLog.event.match(/Reason:\s*"([^"]+)"/i);
            if (match && match[1]) {
                dispatchReason = match[1];
            } else if (dispatchLog.type === "AUTO_DISPATCH") {
                dispatchReason = "Auto-assigned nearest matching unit by algorithm";
            }
        }

        const metrics = {
            reportedAt: reportedAt.toISOString(),
            dispatchedAt: dispatchedAt ? dispatchedAt.toISOString() : null,
            acknowledgedAt: acknowledgedAt ? acknowledgedAt.toISOString() : null,
            resolvedAt: resolvedAt ? resolvedAt.toISOString() : null,
            dispatchedBy,
            dispatchReason,
            dispatchDelaySeconds,
            acceptanceDelaySeconds,
            totalDurationSeconds,
            hasTimeoutOccurred: timeline.some((t) => t.type === "TIMEOUT"),
            hasFallbackRerouted: timeline.some((t) => t.type === "REROUTED"),
            hasDeclined: timeline.some((t) => t.type === "DECLINED"),
        };

        return {
            alert,
            timeline,
            metrics,
        };
    } catch (error) {
        throw new Error(`getAlertTimeline error: ${error.message}`);
    }
};

module.exports = {
    EMERGENCY_TO_ORG,
    calculateDistance,
    estimateETA,
    autoAssignOrganizationAndStation,
    createAlert,
    dispatchAgent,
    declineMission,
    acknowledgeMission,
    findCandidateAgents,
    evaluateAndAutoDispatch,
    startMissionTimeout,
    clearMissionTimeout,
    updateAgentStatus,
    getAvailableAgents,
    listAlerts,
    getAlert,
    getAlertTimeline,
    updateStatus,
    addMedia,
    deleteAlert,
    getAssignedAlerts,
};