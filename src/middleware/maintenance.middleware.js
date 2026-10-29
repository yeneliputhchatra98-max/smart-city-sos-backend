const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

let cachedMaintenance = null;
let lastChecked = 0;
const CACHE_TTL_MS = 3000;

function invalidateMaintenanceCache() {
  cachedMaintenance = null;
  lastChecked = 0;
}

async function isMaintenanceModeActive() {
  const now = Date.now();
  if (cachedMaintenance !== null && now - lastChecked < CACHE_TTL_MS) {
    return cachedMaintenance;
  }

  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'maintenanceMode' },
    });
    cachedMaintenance = setting ? String(setting.value).toLowerCase() === 'true' : false;
    lastChecked = now;
    return cachedMaintenance;
  } catch (error) {
    console.error('Failed to check maintenance mode status:', error.message);
    return false;
  }
}

/**
 * Middleware to enforce system maintenance mode.
 * Blocks non-administrative inbound submissions (citizen SOS alerts, citizen reports)
 * while allowing authorized dispatchers (ADMIN, OPERATOR) through.
 */
const checkMaintenanceMode = async (req, res, next) => {
  const isMaintenance = await isMaintenanceModeActive();
  if (!isMaintenance) {
    return next();
  }

  // Allow ADMIN and OPERATOR to proceed even during maintenance
  const userRole = req.user?.role ? String(req.user.role).toUpperCase() : null;
  if (userRole === 'ADMIN' || userRole === 'OPERATOR') {
    return next();
  }

  return res.status(503).json({
    success: false,
    code: 'MAINTENANCE_MODE_ACTIVE',
    message: 'ប្រព័ន្ធ Smart City SOS កំពុងស្ថិតក្នុងរបៀបថែទាំបច្ចេកទេស (Maintenance Mode)។ ការផ្ញើរបាយការណ៍ថ្មីពីពលរដ្ឋត្រូវបានផ្អាកជាបណ្ដោះអាសន្ន។ សូមទាក់ទងមកកាន់លេខ 119 ដោយផ្ទាល់។',
    maintenance: true,
  });
};

module.exports = {
  isMaintenanceModeActive,
  checkMaintenanceMode,
  invalidateMaintenanceCache,
};
