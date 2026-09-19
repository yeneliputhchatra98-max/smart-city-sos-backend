const express = require('express');

const router = express.Router();

const {
  getSettings,
  updateSettings,
} = require('../controllers/setting.controller');

// GET /api/settings
router.get('/', getSettings);

// PUT /api/settings
router.put('/', updateSettings);

module.exports = router;