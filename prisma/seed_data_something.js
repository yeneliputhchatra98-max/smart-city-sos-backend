// prisma/seed.js
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Starting Database Seeding...\n");

    // ==========================================================
    // 1. ROLES — បង្កើតមុនគេ
    // ==========================================================

    console.log("👥 Creating roles...");

    const rolesData = [
        { name: "ADMIN", description: "System Administrator" },
        { name: "OPERATOR", description: "Emergency Operator" },
        { name: "AGENT", description: "Rescue Agent" },
        { name: "CITIZEN", description: "Regular Citizen" },
    ];

    const roles = {};

    for (const roleData of rolesData) {
        const role = await prisma.role.upsert({
            where: { name: roleData.name },
            update: { description: roleData.description },
            create: roleData,
        });
        roles[roleData.name] = role;
        console.log(`   ✅ Role: ${role.name} (id: ${role.id})`);
    }

    // ==========================================================
    // 2. ADMIN USER — upsert (កុំ error ពេលរត់ ២ ដង)
    // ==========================================================

    console.log("\n👤 Creating admin user...");

    const adminPassword = await bcrypt.hash("Admin12345", 10);

    const admin = await prisma.user.upsert({
        where: { email: "administration47@gmail.com" },
        update: {},
        create: {
            fullName: "ELIX BALDE",
            username: "admin",
            email: "administration47@gmail.com",
            password: adminPassword,
            phone: "068289514",
            roleId: roles.ADMIN.id,
            status: "ACTIVE",
            emailVerified: true,
        },
    });

    console.log(`   ✅ Admin: ${admin.email}`);

    // ==========================================================
    // 3. PROVINCE → DISTRICT → COMMUNE
    // ==========================================================

    console.log("\n🗺️  Creating locations...");

    // 3.1 Province: Siem Reap
    const province = await prisma.province.upsert({
        where: { name: "Siem Reap" },
        update: {},
        create: {
            name: "Siem Reap",
            nameKm: "សៀមរាប",
        },
    });
    console.log(`   ✅ Province: ${province.name}`);

    // 3.2 District: Siem Reap
    const district = await prisma.district.upsert({
        where: {
            name_provinceId: {
                name: "Siem Reap",
                provinceId: province.id,
            },
        },
        update: {},
        create: {
            name: "Siem Reap",
            nameKm: "សៀមរាប",
            provinceId: province.id,
        },
    });
    console.log(`   ✅ District: ${district.name}`);

    // 3.3 Communes
    const communeNames = [
        { name: "Srangae", nameKm: "ស្រង៉ែ" },
        { name: "Chong Khnies", nameKm: "ចុងឃ្នាស់" },
        { name: "Svay Dangkum", nameKm: "ស្វាយដង្គំ" },
    ];

    const communes = {};

    for (const c of communeNames) {
        const commune = await prisma.commune.upsert({
            where: {
                name_districtId: {
                    name: c.name,
                    districtId: district.id,
                },
            },
            update: {},
            create: {
                name: c.name,
                nameKm: c.nameKm,
                districtId: district.id,
            },
        });
        communes[c.name] = commune;
        console.log(`   ✅ Commune: ${commune.name}`);
    }

    // ==========================================================
    // 4. ORGANIZATIONS
    // ==========================================================

    console.log("\n🏢 Creating organizations...");

    const policeOrg = await prisma.organization.upsert({
        where: { id: "org-police-siemreap" },
        update: {},
        create: {
            id: "org-police-siemreap",
            name: "Siem Reap Provincial Police",
            type: "POLICE",
            hotline: "117",
            head: "Police Chief",
            address: "Siem Reap",
            accessLevel: "HIGH",
            gpsLat: 13.3615,
            gpsLng: 103.859,
        },
    });
    console.log(`   ✅ Org: ${policeOrg.name}`);

    const fireOrg = await prisma.organization.upsert({
        where: { id: "org-fire-siemreap" },
        update: {},
        create: {
            id: "org-fire-siemreap",
            name: "Siem Reap Fire Department",
            type: "FIRE",
            hotline: "118",
            head: "Fire Department Chief",
            address: "Siem Reap",
            accessLevel: "MEDIUM",
            gpsLat: 13.363,
            gpsLng: 103.861,
        },
    });
    console.log(`   ✅ Org: ${fireOrg.name}`);

    const medicalOrg = await prisma.organization.upsert({
        where: { id: "org-medical-siemreap" },
        update: {},
        create: {
            id: "org-medical-siemreap",
            name: "Siem Reap Health Department",
            type: "MEDICAL",
            hotline: "119",
            head: "Health Department Director",
            address: "Siem Reap",
            accessLevel: "HIGH",
            gpsLat: 13.3645,
            gpsLng: 103.857,
        },
    });
    console.log(`   ✅ Org: ${medicalOrg.name}`);

    // ==========================================================
    // 5. STATIONS
    // ==========================================================

    console.log("\n📍 Creating stations...");

    // 5.1 Police Station
    const policeStation = await prisma.station.upsert({
        where: { id: "station-police-siemreap" },
        update: {},
        create: {
            id: "station-police-siemreap",
            name: "Police Station Siem Reap",
            type: "POLICE",
            provinceId: province.id,
            districtId: district.id,
            communeId: communes["Srangae"].id,
            address: "Siem Reap",
            hotline: "117",
            lat: 13.3615,
            lng: 103.859,
            capacity: 50,
            organizationId: policeOrg.id,
        },
    });
    console.log(`   ✅ Station: ${policeStation.name}`);

    // 5.2 Fire Station
    const fireStation = await prisma.station.upsert({
        where: { id: "station-fire-siemreap" },
        update: {},
        create: {
            id: "station-fire-siemreap",
            name: "Fire Station Siem Reap",
            type: "FIRE",
            provinceId: province.id,
            districtId: district.id,
            communeId: communes["Srangae"].id,
            address: "Siem Reap",
            hotline: "118",
            lat: 13.363,
            lng: 103.861,
            capacity: 30,
            organizationId: fireOrg.id,
        },
    });
    console.log(`   ✅ Station: ${fireStation.name}`);

    // 5.3 Medical Station
    const medicalStation = await prisma.station.upsert({
        where: { id: "station-medical-siemreap" },
        update: {},
        create: {
            id: "station-medical-siemreap",
            name: "Hospital Emergency Unit",
            type: "MEDICAL",
            provinceId: province.id,
            districtId: district.id,
            communeId: communes["Chong Khnies"].id,
            address: "Siem Reap",
            hotline: "119",
            lat: 13.3645,
            lng: 103.857,
            capacity: 60,
            organizationId: medicalOrg.id,
        },
    });
    console.log(`   ✅ Station: ${medicalStation.name}`);

    // ==========================================================
    // 6. AGENTS — ភ្ជាប់ជាមួយ Station
    // ==========================================================

    console.log("\n🚑 Creating agents...");

    const agentsData = [
        {
            id: "agent-fire-1",
            name: "សំណាង លី",
            role: "Fire Officer",
            type: "FIRE",
            phone: "012111222",
            status: "AVAILABLE",
            organizationId: fireOrg.id,
            stationId: fireStation.id,
            lat: 13.363,
            lng: 103.861,
        },
        {
            id: "agent-medical-1",
            name: "ចិន្តា វន",
            role: "Medical Officer",
            type: "MEDICAL",
            phone: "077333444",
            status: "AVAILABLE",
            organizationId: medicalOrg.id,
            stationId: medicalStation.id,
            lat: 13.3645,
            lng: 103.857,
        },
        {
            id: "agent-police-1",
            name: "ពិសិដ្ឋ កែវ",
            role: "Police Officer",
            type: "POLICE",
            phone: "010555666",
            status: "AVAILABLE",
            organizationId: policeOrg.id,
            stationId: policeStation.id,
            lat: 13.3615,
            lng: 103.859,
        },
    ];

    for (const agentData of agentsData) {
        const agent = await prisma.agent.upsert({
            where: { id: agentData.id },
            update: {},
            create: agentData,
        });
        console.log(`   ✅ Agent: ${agent.name} (${agent.type})`);
    }

    // ==========================================================
    // 7. AUDIT LOGS
    // ==========================================================

    console.log("\n📝 Creating audit logs...");

    const auditLogs = [
        {
            time: "09:42",
            event: "Backup database",
            userId: admin.id,
            userName: "ELIX BALDE",
        },
        {
            time: "09:15",
            event: "Agent dispatched",
            userId: admin.id,
            userName: "ELIX BALDE",
        },
    ];

    for (const log of auditLogs) {
        await prisma.auditLog.create({ data: log });
    }
    console.log(`   ✅ Audit logs: ${auditLogs.length}`);

    // ==========================================================
    // DONE
    // ==========================================================

    console.log("\n🎉 Seed Completed Successfully!\n");
    console.log("📊 Summary:");
    console.log(`   • Roles: ${rolesData.length}`);
    console.log(`   • Users: 1 (admin)`);
    console.log(`   • Provinces: 1`);
    console.log(`   • Districts: 1`);
    console.log(`   • Communes: ${communeNames.length}`);
    console.log(`   • Organizations: 3`);
    console.log(`   • Stations: 3`);
    console.log(`   • Agents: ${agentsData.length}`);
    console.log(`   • Audit Logs: ${auditLogs.length}\n`);
}

main()
    .catch((error) => {
        console.error("❌ Seed Error:", error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });