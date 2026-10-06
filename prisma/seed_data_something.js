const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();


async function main() {

    console.log("🌱 Starting Database Seeding...");


    // ==========================
    // Roles
    // ==========================

    const adminRole = await prisma.role.findUnique({
    where: {
        name: "ADMIN"
    }
});

const operatorRole = await prisma.role.findUnique({
    where: {
        name: "OPERATOR"
    }
});

const agentRole = await prisma.role.findUnique({
    where: {
        name: "AGENT"
    }
});

const citizenRole = await prisma.role.findUnique({
    where: {
        name: "CITIZEN"
    }
});


if (!adminRole || !operatorRole || !agentRole || !citizenRole) {
    throw new Error("Roles missing");
}


    // ==========================
    // Admin User
    // ==========================

    const password = await bcrypt.hash(
        "Admin12345",
        10
    );


    const admin = await prisma.user.create({

        data: {

            fullName: "ELIX BALDE",

            username: "admin",

            email: "administration47@gmail.com",

            password,

            phone: "068289514",

            roleId: adminRole.id,

            status: "ACTIVE"
        }

    });


    console.log("✅ Admin:", admin.email);





    // ==========================
    // Organizations
    // ==========================


    const policeOrg = await prisma.organization.create({

        data: {

            name: "Siem Reap Provincial Police",

            type: "POLICE",

            hotline: "117",

            head: "Police Chief",

            address: "Siem Reap",

            accessLevel: "HIGH",

            gpsLat: 13.3615,

            gpsLng: 103.8590

        }

    });



    const fireOrg = await prisma.organization.create({

        data: {

            name: "Siem Reap Fire Department",

            type: "FIRE",

            hotline: "118",

            head: "Fire Department Chief",

            address: "Siem Reap",

            accessLevel: "MEDIUM",

            gpsLat: 13.3630,

            gpsLng: 103.8610

        }

    });



    const medicalOrg = await prisma.organization.create({

        data: {

            name: "Siem Reap Health Department",

            type: "MEDICAL",

            hotline: "119",

            head: "Health Department Director",

            address: "Siem Reap",

            accessLevel: "HIGH",

            gpsLat: 13.3645,

            gpsLng: 103.8570

        }

    });


    console.log("🏢 Organizations created");





    // ==========================
    // Agents
    // ==========================


    const agents = [

        {
            name: "សំណាង លី",

            role: "Fire Officer",

            type: "FIRE",

            phone: "012111222",

            status: "AVAILABLE",

            organizationId: fireOrg.id,

            lat: 13.3630,

            lng: 103.8610
        },


        {
            name: "ចិន្តា វន",

            role: "Medical Officer",

            type: "MEDICAL",

            phone: "077333444",

            status: "AVAILABLE",

            organizationId: medicalOrg.id,

            lat: 13.3645,

            lng: 103.8570
        },


        {
            name: "ពិសិដ្ឋ កែវ",

            role: "Police Officer",

            type: "POLICE",

            phone: "010555666",

            status: "AVAILABLE",

            organizationId: policeOrg.id,

            lat: 13.3615,

            lng: 103.8590
        }

    ];



    for (const agent of agents) {

        await prisma.agent.create({

            data: agent

        });

    }


    console.log("🚑 Agents created");





    // ==========================
    // Stations
    // ==========================


    await prisma.station.createMany({

        data: [

            {

                name: "Police Station Siem Reap",

                type: "POLICE",

                province: "Siem Reap",

                district: "Siem Reap",

                address: "Siem Reap",

                hotline: "117",

                organizationId: policeOrg.id

            },


            {

                name: "Fire Station Siem Reap",

                type: "FIRE",

                province: "Siem Reap",

                district: "Siem Reap",

                address: "Siem Reap",

                hotline: "118",

                organizationId: fireOrg.id

            },


            {

                name: "Hospital Emergency Unit",

                type: "MEDICAL",

                province: "Siem Reap",

                district: "Siem Reap",

                address: "Siem Reap",

                hotline: "119",

                organizationId: medicalOrg.id

            }

        ]

    });


    console.log("📍 Stations created");





    // ==========================
    // Audit Logs
    // ==========================

    await prisma.auditLog.createMany({

        data: [

            {

                time: "09:42",

                event: "Backup database",

                userName: "System Admin"

            },


            {

                time: "09:15",

                event: "Agent dispatched",

                userName: "Operator"

            }

        ]

    });


    console.log("📝 Audit logs created");


    console.log("🎉 Seed Completed");

}





main()

.catch((error) => {

    console.error("❌ Seed Error:", error);

    process.exit(1);

})

.finally(async () => {

    await prisma.$disconnect();

});