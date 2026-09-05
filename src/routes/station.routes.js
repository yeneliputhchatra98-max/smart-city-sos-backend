const express = require("express");
const router = express.Router();

const stationController = require("../controllers/station.controller");

const { validateRequest } = require("../middleware/validator");

const {
  createStationSchema,
  updateStationSchema,
  updateStationStatusSchema,
} = require("../validators/station.validator");


router.get(
  "/",
  stationController.getAllStations
);

router.get(
  "/:id",
  stationController.getStationById
);

router.post(
  "/",
  validateRequest(createStationSchema),
  stationController.createStation
);

router.put(
  "/:id",
  validateRequest(updateStationSchema),
  stationController.updateStation
);

router.delete(
  "/:id",
  stationController.deleteStation
);

router.patch(
  "/:id/status",
  validateRequest(updateStationStatusSchema),
  stationController.updateStationStatus
);


module.exports = router;