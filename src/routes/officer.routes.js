const express = require('express');
const router = express.Router();
const officerController = require('../controllers/officer.controller');

router.get('/', officerController.getAllOfficers);
router.get('/:id', officerController.getOfficerById);
router.post('/', officerController.createOfficer);
router.put('/:id', officerController.updateOfficer);
router.delete('/:id', officerController.deleteOfficer);

module.exports = router;
