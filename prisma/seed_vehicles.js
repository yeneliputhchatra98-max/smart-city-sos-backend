const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Seeding emergency vehicles into database...');

    const orgs = await prisma.organization.findMany();
    const stations = await prisma.station.findMany();
    const agents = await prisma.agent.findMany();

    console.log(`Found ${orgs.length} orgs, ${stations.length} stations, ${agents.length} agents in DB.`);

    const policeOrg = orgs.find(o => o.type === 'POLICE') || orgs[0];
    const fireOrg = orgs.find(o => o.type === 'FIRE') || orgs[1] || orgs[0];
    const medOrg = orgs.find(o => o.type === 'MEDICAL') || orgs[2] || orgs[0];

    const policeStation = stations.find(s => s.type === 'POLICE') || stations[0];
    const fireStation = stations.find(s => s.type === 'FIRE') || stations[1] || stations[0];
    const medStation = stations.find(s => s.type === 'MEDICAL') || stations[2] || stations[0];

    const policeAgent = agents.find(a => a.type === 'POLICE') || agents[0];
    const fireAgent = agents.find(a => a.type === 'FIRE') || agents[1];
    const medAgent = agents.find(a => a.type === 'MEDICAL') || agents[2];

    const vehiclesToSeed = [
        {
            plateNumber: 'PP-01-9876',
            model: 'Isuzu Giga 10,000L Fire Tender',
            type: 'FIRE_TRUCK',
            status: 'AVAILABLE',
            fuelLevel: 92,
            mileage: 18450,
            lat: 11.5564,
            lng: 104.9282,
            organizationId: fireOrg ? fireOrg.id : null,
            stationId: fireStation ? fireStation.id : null,
            assignedAgentId: fireAgent ? fireAgent.id : null,
        },
        {
            plateNumber: 'AMB-119-04',
            model: 'Toyota HiAce Super Custom Mobile ICU',
            type: 'AMBULANCE',
            status: 'ON_DUTY',
            fuelLevel: 78,
            mileage: 34120,
            lat: 11.5760,
            lng: 104.9189,
            organizationId: medOrg ? medOrg.id : null,
            stationId: medStation ? medStation.id : null,
            assignedAgentId: medAgent ? medAgent.id : null,
        },
        {
            plateNumber: 'POL-2A-3341',
            model: 'Toyota Hilux 4x4 Heavy Duty Patrol',
            type: 'POLICE_CAR',
            status: 'AVAILABLE',
            fuelLevel: 85,
            mileage: 42300,
            lat: 11.5972,
            lng: 104.8839,
            organizationId: policeOrg ? policeOrg.id : null,
            stationId: policeStation ? policeStation.id : null,
            assignedAgentId: policeAgent ? policeAgent.id : null,
        },
        {
            plateNumber: 'AMB-119-09',
            model: 'Mercedes-Benz Sprinter Advanced Life Support',
            type: 'AMBULANCE',
            status: 'AVAILABLE',
            fuelLevel: 64,
            mileage: 29800,
            lat: 11.5621,
            lng: 104.9080,
            organizationId: medOrg ? medOrg.id : null,
            stationId: medStation ? medStation.id : null,
            assignedAgentId: null,
        },
        {
            plateNumber: 'MOTO-PP-8821',
            model: 'Honda CB500X Rapid Police Interceptor',
            type: 'MOTORBIKE',
            status: 'MAINTENANCE',
            fuelLevel: 30,
            mileage: 15400,
            lat: 11.5432,
            lng: 104.9150,
            organizationId: policeOrg ? policeOrg.id : null,
            stationId: policeStation ? policeStation.id : null,
            assignedAgentId: null,
        },
        {
            plateNumber: 'FT-PP-03',
            model: 'Hino 500 Water Cannon Ladder Truck',
            type: 'FIRE_TRUCK',
            status: 'ON_DUTY',
            fuelLevel: 88,
            mileage: 21600,
            lat: 11.5320,
            lng: 104.9350,
            organizationId: fireOrg ? fireOrg.id : null,
            stationId: fireStation ? fireStation.id : null,
            assignedAgentId: null,
        },
        {
            plateNumber: 'RB-TK-01',
            model: 'Yamaha 70HP Aluminum Flood Rescue Boat',
            type: 'RESCUE_BOAT',
            status: 'AVAILABLE',
            fuelLevel: 100,
            mileage: 4800,
            lat: 11.5688,
            lng: 104.8920,
            organizationId: fireOrg ? fireOrg.id : null,
            stationId: fireStation ? fireStation.id : null,
            assignedAgentId: null,
        },
        {
            plateNumber: 'CMD-EOC-01',
            model: 'MAN TGM Tactical Mobile EOC Command Unit',
            type: 'COMMAND_UNIT',
            status: 'AVAILABLE',
            fuelLevel: 95,
            mileage: 12200,
            lat: 11.5480,
            lng: 104.9200,
            organizationId: policeOrg ? policeOrg.id : null,
            stationId: policeStation ? policeStation.id : null,
            assignedAgentId: null,
        }
    ];

    for (const v of vehiclesToSeed) {
        const existing = await prisma.vehicle.findUnique({
            where: { plateNumber: v.plateNumber }
        });
        if (!existing) {
            await prisma.vehicle.create({
                data: v
            });
            console.log(`Created vehicle: ${v.plateNumber} (${v.type})`);
        } else {
            console.log(`Vehicle already exists: ${v.plateNumber}`);
        }
    }

    // Now recalculate vehicle counts for all organizations & stations
    console.log('Recalculating hierarchy active vehicle counts...');
    const allOrgs = await prisma.organization.findMany();
    for (const org of allOrgs) {
        const count = await prisma.vehicle.count({
            where: {
                organizationId: org.id,
                status: { in: ['AVAILABLE', 'ON_DUTY'] }
            }
        });
        await prisma.organization.update({
            where: { id: org.id },
            data: { activeVehiclesCount: count }
        });
        console.log(`Updated Org "${org.name}": activeVehiclesCount = ${count}`);
    }

    const allStations = await prisma.station.findMany();
    for (const st of allStations) {
        const count = await prisma.vehicle.count({
            where: {
                stationId: st.id,
                status: { in: ['AVAILABLE', 'ON_DUTY'] }
            }
        });
        await prisma.station.update({
            where: { id: st.id },
            data: { activeVehiclesCount: count }
        });
        console.log(`Updated Station "${st.name}": activeVehiclesCount = ${count}`);
    }

    console.log('Seeding completed successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
