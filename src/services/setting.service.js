const { PrismaClient } = require('@prisma/client');
const { invalidateMaintenanceCache } = require('../middleware/maintenance.middleware');

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

  // Security & Backup
  mfaRequiredForAdmin: 'true',
  mfaScope: 'ADMIN_ONLY',
  sessionTimeoutMins: '30',
  sessionWarning: 'true',
  singleSessionOnly: 'false',
  maxFailedLogins: '5',
  lockoutDuration: '15',
  passwordRotation: '90',
  passwordComplexity: 'true',
  auditLoggingEnabled: 'true',
  ipRestriction: 'false',
  automatedBackups: 'true',
  backupTime: '02:00 AM',
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

  invalidateMaintenanceCache();

  return await getSettings();
};

const revokeAllSessions = async (currentSessionId = null, revokedByUserId = null) => {
  const whereClause = {
    revokedAt: null,
  };
  if (currentSessionId) {
    whereClause.id = { not: currentSessionId };
  }

  const result = await prisma.session.updateMany({
    where: whereClause,
    data: {
      revokedAt: new Date(),
    },
  });

  // Also invalidate legacy refresh tokens for non-current sessions
  await prisma.refreshToken.updateMany({
    where: { revokedAt: null },
    data: { revokedAt: new Date() },
  }).catch(() => {});

  return result.count;
};

module.exports = {
  DEFAULT_SETTINGS,
  getSettings,
  updateSettings,
  revokeAllSessions,
};
