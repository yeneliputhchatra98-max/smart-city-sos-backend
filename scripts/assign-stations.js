// scripts/assign-stations.js
// ============================================================
// Assign stationId ឱ្យ agents ដែលគ្មាន
// Run: node scripts/assign-stations.js
// ============================================================

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ─── Colors ───
const c = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
};

// ============================================================
// Main
// ============================================================
async function assignStations() {
    console.log(`\n${c.bright}${c.cyan}🚀 ASSIGN STATION TO AGENTS${c.reset}\n`);

    try {
        // ─── ១. ទាញ agents ដែលគ្មាន stationId ───
        console.log(`${c.cyan}ℹ️  Finding agents without stationId...${c.reset}`);
        
        const agentsWithoutStation = await prisma.agent.findMany({
            where: { 
                stationId: null,
                organizationId: { not: null },
            },
            include: {
                organization: {
                    select: { id: true, name: true },
                },
            },
            orderBy: { createdAt: 'asc' },
        });

        console.log(`${c.green}✅ Found ${agentsWithoutStation.length} agents${c.reset}\n`);

        if (agentsWithoutStation.length === 0) {
            console.log(`${c.green}🎉 All agents already have stationId!${c.reset}\n`);
            return;
        }

        // ─── ២. ទាញ stations ទាំងអស់ ───
        console.log(`${c.cyan}ℹ️  Loading stations...${c.reset}`);
        
        const allStations = await prisma.station.findMany({
            include: {
                organization: {
                    select: { id: true, name: true },
                },
            },
        });

        console.log(`${c.green}✅ Found ${allStations.length} stations${c.reset}\n`);

        if (allStations.length === 0) {
            console.log(`${c.red}❌ No stations found! Create stations first.${c.reset}\n`);
            return;
        }

        // ─── ៣. Group stations តាម org ───
        const stationsByOrg = new Map();
        for (const station of allStations) {
            if (!station.organizationId) continue;
            
            if (!stationsByOrg.has(station.organizationId)) {
                stationsByOrg.set(station.organizationId, []);
            }
            stationsByOrg.get(station.organizationId).push(station);
        }

        // ─── ៤. Assign ───
        console.log(`${c.cyan}ℹ️  Assigning stations...${c.reset}\n`);

        let assigned = 0;
        let skipped = 0;

        for (const agent of agentsWithoutStation) {
            const orgStations = stationsByOrg.get(agent.organizationId) || [];

            if (orgStations.length === 0) {
                console.log(
                    `${c.yellow}⚠️  ${agent.name} — No station in "${agent.organization?.name}"${c.reset}`
                );
                skipped++;
                continue;
            }

            const station = orgStations[0];

            try {
                await prisma.agent.update({
                    where: { id: agent.id },
                    data: { stationId: station.id },
                });

                console.log(
                    `${c.green}✅ ${agent.name} → ${station.name}${c.reset}`
                );
                assigned++;
            } catch (error) {
                console.log(`${c.red}❌ ${agent.name}: ${error.message}${c.reset}`);
                skipped++;
            }
        }

        // ─── ៥. Summary ───
        console.log(`\n${c.bright}${c.cyan}📊 SUMMARY${c.reset}\n`);
        console.log(`${c.green}   ✅ Assigned: ${assigned}${c.reset}`);
        console.log(`${c.yellow}   ⚠️  Skipped:  ${skipped}${c.reset}`);
        console.log(`${c.cyan}   📊 Total:    ${agentsWithoutStation.length}${c.reset}\n`);

        // ─── ៦. Verify ───
        const remaining = await prisma.agent.count({
            where: { stationId: null },
        });

        if (remaining === 0) {
            console.log(`${c.green}🎉 All agents now have stationId!${c.reset}\n`);
        } else {
            console.log(`${c.yellow}⚠️  ${remaining} agents still without stationId${c.reset}\n`);
        }

    } catch (error) {
        console.log(`${c.red}❌ Fatal error: ${error.message}${c.reset}\n`);
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

// ============================================================
// Run
// ============================================================
assignStations()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });