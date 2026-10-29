const settingService = require('../services/setting.service');
const backupService = require('../services/backup.service');

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

// POST /api/settings/revoke-all-sessions
exports.revokeAllSessions = async (req, res) => {
  try {
    const currentSessionId = req.user?.sessionId || null;
    const currentUserId = req.user?.id || null;

    const count = await settingService.revokeAllSessions(
      currentSessionId,
      currentUserId
    );

    // Write audit log
    try {
      const { writeAuditLog } = require('../services/audit.service');
      await writeAuditLog({
        event: `Emergency Revoke: Terminated ${count} active user session(s)`,
        userName: req.user?.fullName || req.user?.email || 'Administrator',
        userId: currentUserId,
        ipAddress: req.ip || null,
      });
    } catch (_) {}

    return res.status(200).json({
      success: true,
      data: { revokedCount: count },
      message: `Successfully terminated ${count} active user session(s).`,
    });
  } catch (error) {
    console.error('Revoke all sessions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to revoke active sessions',
    });
  }
};

// GET /api/settings/backups
exports.getBackups = async (req, res) => {
  try {
    const backups = await backupService.getBackups();

    return res.status(200).json({
      success: true,
      data: backups,
    });
  } catch (error) {
    console.error('Get backups error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve database backups',
    });
  }
};

// POST /api/settings/backups
exports.createBackup = async (req, res) => {
  try {
    const backup = await backupService.createBackup(req.user);

    return res.status(201).json({
      success: true,
      data: backup,
      message: 'Database backup completed successfully',
    });
  } catch (error) {
    console.error('Create backup error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create database backup',
    });
  }
};

// POST /api/settings/backups/:id/restore
exports.restoreBackup = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await backupService.restoreBackup(id, req.user);

    return res.status(200).json({
      success: true,
      data: result,
      message: 'System snapshot restored successfully',
    });
  } catch (error) {
    console.error('Restore backup error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to restore database snapshot',
    });
  }
};

// GET /api/settings/backups/:id/download
exports.downloadBackup = async (req, res) => {
  try {
    const { id } = req.params;
    const { filePath, filename } = backupService.getBackupFilePath(id);

    return res.download(filePath, filename);
  } catch (error) {
    console.error('Download backup error:', error);
    return res.status(404).json({
      success: false,
      message: error.message || 'Backup file not found',
    });
  }
};

// DELETE /api/settings/backups/:id
exports.deleteBackup = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await backupService.deleteBackup(id);

    return res.status(200).json({
      success: true,
      data: result,
      message: 'Backup deleted successfully',
    });
  } catch (error) {
    console.error('Delete backup error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete backup file',
    });
  }
};
