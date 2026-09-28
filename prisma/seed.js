const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// ==========================================
// PROVINCES
// ==========================================

const provinces = [
    {
        name: "Banteay Meanchey",
        nameKm: "បន្ទាយមានជ័យ",
    },
    {
        name: "Battambang",
        nameKm: "បាត់ដំបង",
    },
    {
        name: "Kampong Cham",
        nameKm: "កំពង់ចាម",
    },
    {
        name: "Kampong Chhnang",
        nameKm: "កំពង់ឆ្នាំង",
    },
    {
        name: "Kampong Speu",
        nameKm: "កំពង់ស្ពឺ",
    },
    {
        name: "Kampong Thom",
        nameKm: "កំពង់ធំ",
    },
    {
        name: "Kampot",
        nameKm: "កំពត",
    },
    {
        name: "Kandal",
        nameKm: "កណ្ដាល",
    },
    {
        name: "Kep",
        nameKm: "កែប",
    },
    {
        name: "Koh Kong",
        nameKm: "កោះកុង",
    },
    {
        name: "Kratie",
        nameKm: "ក្រចេះ",
    },
    {
        name: "Mondulkiri",
        nameKm: "មណ្ឌលគិរី",
    },
    {
        name: "Oddar Meanchey",
        nameKm: "ឧត្តរមានជ័យ",
    },
    {
        name: "Pailin",
        nameKm: "ប៉ៃលិន",
    },
    {
        name: "Phnom Penh",
        nameKm: "ភ្នំពេញ",
    },
    {
        name: "Preah Sihanouk",
        nameKm: "ព្រះសីហនុ",
    },
    {
        name: "Preah Vihear",
        nameKm: "ព្រះវិហារ",
    },
    {
        name: "Pursat",
        nameKm: "ពោធិ៍សាត់",
    },
    {
        name: "Prey Veng",
        nameKm: "ព្រៃវែង",
    },
    {
        name: "Ratanakiri",
        nameKm: "រតនគិរី",
    },
    {
        name: "Siem Reap",
        nameKm: "សៀមរាប",
    },
    {
        name: "Stung Treng",
        nameKm: "ស្ទឹងត្រែង",
    },
    {
        name: "Svay Rieng",
        nameKm: "ស្វាយរៀង",
    },
    {
        name: "Takeo",
        nameKm: "តាកែវ",
    },
    {
        name: "Tboung Khmum",
        nameKm: "ត្បូងឃ្មុំ",
    },
];

// ==========================================
// SIEM REAP DISTRICTS / MUNICIPALITIES
// ==========================================

const siemReapDistricts = [
    {
        name: "Angkor Chum",
        nameKm: "អង្គរជុំ",
    },
    {
        name: "Angkor Thum",
        nameKm: "អង្គរធំ",
    },
    {
        name: "Banteay Srei",
        nameKm: "បន្ទាយស្រី",
    },
    {
        name: "Chi Kraeng",
        nameKm: "ជីក្រែង",
    },
    {
        name: "Kralanh",
        nameKm: "ក្រឡាញ់",
    },
    {
        name: "Puok",
        nameKm: "ពួក",
    },
    {
        name: "Prasat Bakong",
        nameKm: "ប្រាសាទបាគង",
    },
    {
        name: "Siem Reap",
        nameKm: "សៀមរាប",
    },
    {
        name: "Soutr Nikom",
        nameKm: "សូទ្រនិគម",
    },
    {
        name: "Srei Snam",
        nameKm: "ស្រីស្នំ",
    },
    {
        name: "Svay Leu",
        nameKm: "ស្វាយលើ",
    },
    {
        name: "Varin",
        nameKm: "វ៉ារិន",
    },
    {
        name: "Run Ta Aek Techo Sen",
        nameKm: "រុនតាឯកតេជោសែន",
    },
];

// ==========================================
// SIEM REAP COMMUNES / SANGKATS
// ==========================================

const siemReapCommunes = [
    {
        district: "Angkor Chum",
        communes: [
            {
                name: "Char Chhuk",
                nameKm: "ចារឈូក",
            },
            {
                name: "Doun Peng",
                nameKm: "ដូនពេញ",
            },
            {
                name: "Kouk Doung",
                nameKm: "គោកដូង",
            },
            {
                name: "Koul",
                nameKm: "គោក",
            },
            {
                name: "Nokor Pheas",
                nameKm: "នគរភាស",
            },
            {
                name: "Srae Khvav",
                nameKm: "ស្រែខ្វាវ",
            },
            {
                name: "Ta Saom",
                nameKm: "តាសោម",
            },
        ],
    },

    {
        district: "Angkor Thum",
        communes: [
            { name: "Chob Ta Trav", nameKm: "ជប់តាត្រវ" },
            { name: "Leang Dai", nameKm: "លាងដៃ" },
            { name: "Peak Snaeng", nameKm: "ពាក់ស្នែង" },
            { name: "Svay Chek", nameKm: "ស្វាយចេក" },
        ],
    },

    {
        district: "Banteay Srei",
        communes: [
            { name: "Khnar Sanday", nameKm: "ខ្នារសណ្ដាយ" },
            { name: "Khun Ream", nameKm: "ឃុនរាម" },
            { name: "Preah Dak", nameKm: "ព្រះដាក់" },
            { name: "Rumchek", nameKm: "រំចេក" },
            { name: "Tbaeng", nameKm: "ត្បែង" },
        ],
    },

    {
        district: "Chi Kraeng",
        communes: [
            { name: "Anlong Samnar", nameKm: "អន្លង់សំណរ" },
            { name: "Chi Kraeng", nameKm: "ជីក្រែង" },
            { name: "Kampong Kdei", nameKm: "កំពង់ក្តី" },
            { name: "Khvav", nameKm: "ខ្វាវ" },
            { name: "Kouk Thlok Kraom", nameKm: "គោកធ្លកក្រោម" },
            { name: "Kouk Thlok Leu", nameKm: "គោកធ្លកលើ" },
            { name: "Lveaeng Ruessei", nameKm: "ល្វែងឫស្សី" },
            { name: "Pongro Kraom", nameKm: "ពង្រោមក្រោម" },
            { name: "Pongro Leu", nameKm: "ពង្រោមលើ" },
            { name: "Ruessei Lok", nameKm: "ឫស្សីឡក" },
            { name: "Sangvaeuy", nameKm: "សង្វើយ" },
            { name: "Spean Thnot", nameKm: "ស្ពានថ្នល់" },
        ],
    },

    {
        district: "Kralanh",
        communes: [
            { name: "Chanleas Dai", nameKm: "ចន្លាសដៃ" },
            { name: "Kampong Thkov", nameKm: "កំពង់ថ្កូវ" },
            { name: "Kralanh", nameKm: "ក្រឡាញ់" },
            { name: "Krouch Kor", nameKm: "ក្រូចកុរ" },
            { name: "Roung Kou", nameKm: "រោងគោ" },
            { name: "Sambuor", nameKm: "សំបួរ" },
            { name: "Saen Sokh", nameKm: "សែនសុខ" },
            { name: "Snuol", nameKm: "ស្នួល" },
            { name: "Sranal", nameKm: "ស្រណាល" },
            { name: "Ta An", nameKm: "តាអាន" },
        ],
    },

    {
        district: "Puok",
        communes: [
            { name: "Sasar Sdam", nameKm: "សសរស្ដម្ភ" },
            { name: "Doun Kaev", nameKm: "ដូនកែវ" },
            { name: "Kdei Run", nameKm: "ក្ដីរុន" },
            { name: "Kaev Poar", nameKm: "កែវព័រ" },
            { name: "Khnat", nameKm: "ខ្នាត" },
            { name: "Lvea", nameKm: "ល្វា" },
            { name: "Mukh Paen", nameKm: "មុខពែន" },
            { name: "Pou Treay", nameKm: "ពួកត្រៃ" },
            { name: "Puok", nameKm: "ពួក" },
            { name: "Prey Chruk", nameKm: "ព្រៃជ្រុក" },
            { name: "Reul", nameKm: "រួល" },
            { name: "Samraong Yea", nameKm: "សំរោងយា" },
            { name: "Trei Nhoar", nameKm: "ត្រីញ័រ" },
            { name: "Yeang", nameKm: "យាង" },
        ],
    },

    {
        district: "Prasat Bakong",
        communes: [
            { name: "Bakong", nameKm: "បាគង" },
            { name: "Kampong Phluk", nameKm: "កំពង់ភ្លុក" },
            { name: "Kantreang", nameKm: "កន្ទ្រាំង" },
            { name: "Kandaek", nameKm: "កណ្ដែក" },
            { name: "Mean Chey", nameKm: "មានជ័យ" },
            { name: "Roluos", nameKm: "រលួស" },
            { name: "Trapeang Thum", nameKm: "ត្រពាំងធំ" },
            { name: "Ampil", nameKm: "អំពិល" },
        ],
    },

    {
        district: "Siem Reap",
        communes: [
            { name: "Sla Kram", nameKm: "ស្លក្រាម" },
            { name: "Svay Dankum", nameKm: "ស្វាយដង្គំ" },
            { name: "Kok Chak", nameKm: "គោកចក" },
            { name: "Sala Kamreuk", nameKm: "សាលាកំរើក" },
            { name: "Nokor Thum", nameKm: "នគរធំ" },
            { name: "Chreav", nameKm: "ជ្រាវ" },
            { name: "Chong Khnies", nameKm: "ជ្រោយខ្នារ" },
            { name: "Sambuor", nameKm: "សំបួរ" },
            { name: "Siem Reap", nameKm: "សៀមរាប" },
            { name: "Srangae", nameKm: "ស្រង៉ែ" },
            { name: "Krabei Riel", nameKm: "ក្របីរៀល" },
            { name: "Tuek Vil", nameKm: "ទឹកវិល" },
        ],
    },

    {
        district: "Soutr Nikom",
        communes: [
            { name: "Chan Sa", nameKm: "ចាន់សា" },
            { name: "Dam Daek", nameKm: "ដំដែក" },
            { name: "Dan Run", nameKm: "ដាន់រុន" },
            { name: "Kampong Khleang", nameKm: "កំពង់ឃ្លាំង" },
            { name: "Kien Sangkae", nameKm: "គៀនសង្កែ" },
            { name: "Khchas", nameKm: "ខ្ជាស់" },
            { name: "Khnar Pou", nameKm: "ខ្នារពោធិ៍" },
            { name: "Popel", nameKm: "ពពេល" },
            { name: "Samraong", nameKm: "សំរោង" },
            { name: "Ta Yaek", nameKm: "តាយ៉ែក" },
        ],
    },

    {
        district: "Srei Snam",
        communes: [
            { name: "Chrouy Neang Nguon", nameKm: "ជ្រោយនាងងួន" },
            { name: "Klang Hay", nameKm: "ខ្លាំងហាយ" },
            { name: "Tram Sasar", nameKm: "ត្រពាំងសសរ" },
            { name: "Moung", nameKm: "ម៉ោង" },
            { name: "Prei", nameKm: "ព្រៃ" },
            { name: "Slaeng Spean", nameKm: "ស្លែងស្ពាន" },
        ],
    },

    {
        district: "Svay Leu",
        communes: [
            { name: "Boeng Mealea", nameKm: "បឹងមាលា" },
            { name: "Kantuot", nameKm: "កន្ទួត" },
            { name: "Khnang Phnum", nameKm: "ខ្នងភ្នំ" },
            { name: "Svay Leu", nameKm: "ស្វាយលើ" },
            { name: "Ta Siem", nameKm: "តាសៀម" },
        ],
    },

    {
        district: "Varin",
        communes: [
            { name: "Prasat", nameKm: "ប្រាសាទ" },
            { name: "Lvea Krang", nameKm: "ល្វាក្រាំង" },
            { name: "Srae Nouy", nameKm: "ស្រែណូយ" },
            { name: "Svay Sa", nameKm: "ស្វាយសា" },
            { name: "Varin", nameKm: "វ៉ារិន" },
        ],
    },

    {
        district: "Run Ta Aek Techo Sen",
        communes: [
            { name: "Run Ta Aek", nameKm: "រុនតាឯក" },
            { name: "Ballangk", nameKm: "បល្ល័ង្ក" },
        ],
    },
];

// ==========================================
// SEED PROVINCES
// ==========================================

const seedProvinces = async () => {
    console.log("🌱 Seeding provinces...");

    for (const province of provinces) {
        await prisma.province.upsert({
            where: {
                name: province.name,
            },

            update: {
                nameKm: province.nameKm,
            },

            create: {
                name: province.name,
                nameKm: province.nameKm,
            },
        });
    }

    console.log(`✅ ${provinces.length} provinces seeded`);
};

// ==========================================
// SEED SIEM REAP DISTRICTS
// ==========================================

const seedSiemReapDistricts = async () => {
    console.log("🌱 Seeding Siem Reap districts...");

    const province = await prisma.province.findUnique({
        where: {
            name: "Siem Reap",
        },
    });

    if (!province) {
        throw new Error("❌ Siem Reap province not found");
    }

    for (const district of siemReapDistricts) {
        await prisma.district.upsert({
            where: {
                name_provinceId: {
                    name: district.name,
                    provinceId: province.id,
                },
            },

            update: {
                nameKm: district.nameKm,
            },

            create: {
                name: district.name,
                nameKm: district.nameKm,
                provinceId: province.id,
            },
        });

        console.log(`✅ ${district.name} → ${district.nameKm}`);
    }

    console.log("🎉 Siem Reap districts seeded!");
};

// ==========================================
// SEED SIEM REAP COMMUNES
// ==========================================

// ==========================================
// SEED SIEM REAP COMMUNES
// ==========================================

const seedSiemReapCommunes = async () => {
  console.log("🌱 Seeding Siem Reap communes...");

  const province = await prisma.province.findUnique({
    where: {
      name: "Siem Reap",
    },
  });

  if (!province) {
    throw new Error("❌ Siem Reap province not found");
  }

  for (const item of siemReapCommunes) {
    const district = await prisma.district.findUnique({
      where: {
        name_provinceId: {
          name: item.district,
          provinceId: province.id,
        },
      },
    });

    if (!district) {
      console.log(`⚠️ District not found: ${item.district}`);
      continue;
    }

    for (const commune of item.communes) {
      await prisma.commune.upsert({
        where: {
          name_districtId: {
            name: commune.name,
            districtId: district.id,
          },
        },

        update: {
          nameKm: commune.nameKm,
        },

        create: {
          name: commune.name,
          nameKm: commune.nameKm,
          districtId: district.id,
        },
      });
    }

    console.log(
      `✅ ${item.district}: ${item.communes.length} communes`
    );
  }

  console.log("🎉 Siem Reap communes seeding completed!");
};

// ==========================================
// MAIN
// ==========================================

const main = async () => {
    console.log("==========================================");
    console.log("🌱 SMART CITY SOS DATABASE SEED");
    console.log("==========================================");

    // 1️⃣ Province
    await seedProvinces();

    // 2️⃣ District
    await seedSiemReapDistricts();

    // 3️⃣ Commune / Sangkat
    await seedSiemReapCommunes();

    console.log("==========================================");
    console.log("🎉 ALL LOCATION DATA SEEDED!");
    console.log("==========================================");
};

// ==========================================
// RUN
// ==========================================

main()
    .catch((error) => {
        console.error("❌ Seed failed:", error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });