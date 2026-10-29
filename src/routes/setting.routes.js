const express = require('express');

const router = express.Router();

const {
  getSettings,
  updateSettings,
  revokeAllSessions,
  getBackups,
  createBackup,
  restoreBackup,
  downloadBackup,
  deleteBackup,
} = require('../controllers/setting.controller');
const { optionalAuth, verifyToken } = require('../middleware/auth.middleware');

// GET /api/settings
router.get('/', optionalAuth, getSettings);

// PUT /api/settings
router.put('/', optionalAuth, updateSettings);

// Emergency Revoke All Active Sessions
router.post('/revoke-all-sessions', optionalAuth, revokeAllSessions);

// Database Backups
router.get('/backups', optionalAuth, getBackups);
router.post('/backups', optionalAuth, createBackup);
router.post('/backups/:id/restore', optionalAuth, restoreBackup);
router.get('/backups/:id/download', optionalAuth, downloadBackup);
router.delete('/backups/:id', optionalAuth, deleteBackup);

module.exports = router;
