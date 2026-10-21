const express = require('express');

const router = express.Router();

const {
  getSettings,
  updateSettings,
  getBackups,
  createBackup,
  restoreBackup,
  downloadBackup,
  deleteBackup,
} = require('../controllers/setting.controller');
const { optionalAuth } = require('../middleware/auth.middleware');

// GET /api/settings
router.get('/', optionalAuth, getSettings);

// PUT /api/settings
router.put('/', optionalAuth, updateSettings);

// Database Backups
router.get('/backups', optionalAuth, getBackups);
router.post('/backups', optionalAuth, createBackup);
router.post('/backups/:id/restore', optionalAuth, restoreBackup);
router.get('/backups/:id/download', optionalAuth, downloadBackup);
router.delete('/backups/:id', optionalAuth, deleteBackup);

module.exports = router;