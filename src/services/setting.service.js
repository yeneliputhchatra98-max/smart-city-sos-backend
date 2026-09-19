const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DEFAULT_SETTINGS = {
  // General
  systemName: 'Smart City SOS Emergency System',
  systemDescription: 'Smart City Emergency Response System',
  maintenanceMode: 'false',

  // SOS Settings
  sosTimeout: '30',
  autoRouting: 'true',
  autoDispatch: 'true',

  // Notification Settings
  enableNotification: 'true',
  smsNotification: 'true',
  emergencyAlert: 'true',

  // Emergency Settings
  emergencyNumber: '119',
  responseTime: '15',
  defaultPriority: 'HIGH',
};

const getSettings = async () => {
  const settingsList = await prisma.systemSetting.findMany({
    orderBy: {
      key: 'asc',
    },
  });

  const result = { ...DEFAULT_SETTINGS };

  settingsList.forEach((item) => {
    result[item.key] = item.value;
  });

  return result;
};

const updateSettings = async (updates, updatedByUserId = null) => {
  if (
    !updates ||
    typeof updates !== 'object' ||
    Array.isArray(updates)
  ) {
    throw new Error('Invalid settings data');
  }

  for (const [key, value] of Object.entries(updates)) {
    const valStr =
      value !== null && typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);

    await prisma.systemSetting.upsert({
      where: {
        key,
      },
      update: {
        value: valStr,
        updatedByUserId,
      },
      create: {
        key,
        value: valStr,
        updatedByUserId,
      },
    });
  }

  return await getSettings();
};

module.exports = {
  DEFAULT_SETTINGS,
  getSettings,
  updateSettings,
};