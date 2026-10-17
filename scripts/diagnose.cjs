const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

async function runDiagnostics() {
    console.log('=== BACKEND COMPREHENSIVE DIAGNOSTICS ===\n');
    let errorsFound = 0;

    // 1. Prisma DB connection & Models
    console.log('1. Checking Prisma & Database connection...');
    const prisma = new PrismaClient();
    try {
        await prisma.$connect();
        console.log('  ✅ Prisma connected to database successfully.');

        // Test querying models
        const [alertCount, agentCount, stationCount, orgCount] = await Promise.all([
            prisma.sOSAlert.count(),
            prisma.agent.count(),
            prisma.station.count(),
            prisma.organization.count(),
        ]);
        console.log(`  ✅ Database models accessible: ${alertCount} alerts, ${agentCount} agents, ${stationCount} stations, ${orgCount} orgs.`);
    } catch (e) {
        console.error('  ❌ Database error:', e.message);
        errorsFound++;
    } finally {
        await prisma.$disconnect();
    }

    // 2. Checking controllers
    console.log('\n2. Checking all Controllers for syntax/import errors...');
    const controllersDir = path.join(__dirname, '../src/controllers');
    const controllerFiles = fs.readdirSync(controllersDir).filter(f => f.endsWith('.js'));
    for (const file of controllerFiles) {
        try {
            require(path.join(controllersDir, file));
            console.log(`  ✅ Controller [${file}] loaded OK.`);
        } catch (e) {
            console.error(`  ❌ Controller [${file}] ERROR:`, e.message);
            errorsFound++;
        }
    }

    // 3. Checking routes
    console.log('\n3. Checking all Routes...');
    const routesDir = path.join(__dirname, '../src/routes');
    const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));
    for (const file of routeFiles) {
        try {
            require(path.join(routesDir, file));
            console.log(`  ✅ Route [${file}] loaded OK.`);
        } catch (e) {
            console.error(`  ❌ Route [${file}] ERROR:`, e.message);
            errorsFound++;
        }
    }

    // 4. Checking services
    console.log('\n4. Checking all Services...');
    const servicesDir = path.join(__dirname, '../src/services');
    const serviceFiles = fs.readdirSync(servicesDir).filter(f => f.endsWith('.js'));
    for (const file of serviceFiles) {
        try {
            require(path.join(servicesDir, file));
            console.log(`  ✅ Service [${file}] loaded OK.`);
        } catch (e) {
            console.error(`  ❌ Service [${file}] ERROR:`, e.message);
            errorsFound++;
        }
    }

    // 5. Checking socket modules
    console.log('\n5. Checking Socket modules...');
    try {
        require('../src/socket');
        console.log('  ✅ Socket module [src/socket.js] loaded OK.');
    } catch (e) {
        console.error('  ❌ Socket [src/socket.js] ERROR:', e.message);
        errorsFound++;
    }
    try {
        require('../src/socket/index.js');
        console.log('  ✅ Socket module [src/socket/index.js] loaded OK.');
    } catch (e) {
        console.error('  ❌ Socket [src/socket/index.js] ERROR:', e.message);
        errorsFound++;
    }

    // 6. Checking App & Server setup
    console.log('\n6. Checking Express App instantiation...');
    try {
        require('../src/app');
        console.log('  ✅ Express App [src/app.js] loaded OK.');
    } catch (e) {
        console.error('  ❌ Express App [src/app.js] ERROR:', e.message);
        errorsFound++;
    }

    console.log(`\n=== BACKEND DIAGNOSTICS COMPLETE: ${errorsFound} errors found ===`);
    process.exit(errorsFound > 0 ? 1 : 0);
}

runDiagnostics();
