const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DEFAULT_SETTINGS = {
  systemName: 'Smart City SOS Emergency System',
  maintenanceMode: 'false',
  autoDispatch: 'true',
  sosResponseSlaMins: '5',
  sessionTimeoutMins: '30',
  maxFailedLogins: '5',
  mfaRequiredForAdmin: 'true',
  smsNotifications: 'true',
  telegramAlerts: 'true',
  soundAlerts: 'true',
  dataRetentionDays: '365',
  defaultLanguage: 'km',
};

exports.getSettings = async (req, res) => {
  try {
    const settingsList = await prisma.systemSetting.findMany();
    const result = { ...DEFAULT_SETTINGS };

    settingsList.forEach(item => {
      result[item.key] = item.value;
    });

    res.json({ success: true, data: result });
  } catch (err) {
    res.json({ success: true, data: DEFAULT_SETTINGS });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const updates = req.body;
    if (updates && typeof updates === 'object') {
      for (const [key, value] of Object.entries(updates)) {
        const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
        await prisma.systemSetting.upsert({
          where: { key },
          update: { value: valStr },
          create: { key, value: valStr },
        });
      }
    }
    const settingsList = await prisma.systemSetting.findMany();
    const result = { ...DEFAULT_SETTINGS };
    settingsList.forEach(item => {
      result[item.key] = item.value;
    });
    res.json({ success: true, data: result, message: 'Settings updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
