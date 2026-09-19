const settingService = require('../services/setting.service');

// GET /api/settings
exports.getSettings = async (req, res) => {
  try {
    const settings = await settingService.getSettings();

    return res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Get settings error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to load system settings',
    });
  }
};

// PUT /api/settings
exports.updateSettings = async (req, res) => {
  try {
    const updates = req.body;

    const updatedByUserId = req.user?.id || null;

    const settings = await settingService.updateSettings(
      updates,
      updatedByUserId
    );

    return res.status(200).json({
      success: true,
      data: settings,
      message: 'Settings updated successfully',
    });
  } catch (error) {
    console.error('Update settings error:', error);

    if (error.message === 'Invalid settings data') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update system settings',
    });
  }
};