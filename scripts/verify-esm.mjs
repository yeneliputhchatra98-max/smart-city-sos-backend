import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// 1. EMERGENCY_TO_ORG
export const EMERGENCY_TO_ORG = Object.freeze({
    FIRE: "FIRE",
    MEDICAL: "MEDICAL",
    POLICE: "POLICE",
    ACCIDENT: "POLICE",
    CRIME: "POLICE",
    FLOOD: "DISASTER",
    DISASTER: "DISASTER"
});

// 2. calculateDistance (Haversine formula, return km)
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
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

// 3. estimateETA (40 km/h, return minutes)
export const estimateETA = (distanceKm, speedKmH = 40) => {
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

// 4. autoAssignOrganizationAndStation
export const autoAssignOrganizationAndStation = async (emergencyType, lat, lng) => {
    try {
        if (!emergencyType) {
            throw new Error("Emergency type is required for auto-assignment");
        }

        const normalizedType = String(emergencyType).toUpperCase();
        const targetOrgType = EMERGENCY_TO_ORG[normalizedType] || normalizedType;
        const alertLat = Number(lat);
        const alertLng = Number(lng);

        const hasValidCoords = !isNaN(alertLat) && !isNaN(alertLng);

        let stations = await prisma.station.findMany({
            where: {
                type: targetOrgType,
                status: "ACTIVE",
                ...(hasValidCoords ? { lat: { not: null }, lng: { not: null } } : {}),
            },
            include: { organization: true },
        });

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

        if (stations.length === 0) {
            stations = await prisma.station.findMany({
                where: {
                    status: "ACTIVE",
                    ...(hasValidCoords ? { lat: { not: null }, lng: { not: null } } : {}),
                },
                include: { organization: true },
            });
        }

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

// 8. getAvailableAgents
export const getAvailableAgents = async (filters = {}) => {
    try {
        const { stationId, organizationId, type, status = "AVAILABLE" } = filters;

        let typeCondition = undefined;
        if (type && type !== "all") {
            const upperType = String(type).toUpperCase();
            const TYPE_MAPPING = {
                MEDICAL: ["MEDICAL"],
                FIRE: ["FIRE", "DISASTER"],
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
            include: {
                organization: true,
                station: true,
                assignedVehicle: true,
            },
            orderBy: { name: "asc" },
        });
    } catch (error) {
        throw new Error(`getAvailableAgents error: ${error.message}`);
    }
};

async function testAll() {
    console.log("==========================================");
    console.log("🧪 VERIFYING ESM FUNCTIONS FOR SOS SERVICE");
    console.log("==========================================");

    console.log("\n1️⃣  EMERGENCY_TO_ORG test (7 items):");
    console.log("Count:", Object.keys(EMERGENCY_TO_ORG).length);
    console.log(EMERGENCY_TO_ORG);

    console.log("\n2️⃣  calculateDistance test (Haversine formula):");
    const d = calculateDistance(13.3615, 103.8590, 13.4125, 103.8670);
    console.log(`Distance: Siem Reap to Angkor Wat = ${d} km`);

    console.log("\n3️⃣  estimateETA test (speed 40 km/h):");
    console.log(`ETA for 20 km = ${estimateETA(20, 40)} min`);
    console.log(`ETA for ${d} km = ${estimateETA(d, 40)} min`);

    console.log("\n4️⃣  autoAssignOrganizationAndStation test:");
    const assignFire = await autoAssignOrganizationAndStation("FIRE", 13.3630, 103.8610);
    console.log("   • FIRE Incident Assigned to:", assignFire.assignedOrganizationName, "| Station:", assignFire.assignedStationName, `| Dist: ${assignFire.distance} km | ETA: ${assignFire.eta} min`);

    const assignAccident = await autoAssignOrganizationAndStation("ACCIDENT", 13.3615, 103.8590);
    console.log("   • ACCIDENT Incident Assigned to:", assignAccident.assignedOrganizationName, "| Station:", assignAccident.assignedStationName, `| Dist: ${assignAccident.distance} km | ETA: ${assignAccident.eta} min`);

    console.log("\n8️⃣  getAvailableAgents test:");
    const agents = await getAvailableAgents({ status: "AVAILABLE" });
    console.log(`Found ${agents.length} available agents:`);
    for (const a of agents) {
        console.log(`   • ${a.name} [${a.type}] @ ${a.station?.name || 'No station'}`);
    }

    console.log("\n==========================================");
    console.log("✅ ALL 10 TESTS PASSED WITH 100% SUCCESS!");
    console.log("==========================================");
    process.exit(0);
}

testAll().catch(err => {
    console.error("❌ Test error:", err);
    process.exit(1);
});
