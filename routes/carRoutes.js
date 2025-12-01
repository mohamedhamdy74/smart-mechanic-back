const express = require("express");
const router = express.Router();
const carController = require("../controllers/carController");
const { authenticate, authorize } = require("../middlewares/auth");
const { body } = require("express-validator");
const upload = require("../middlewares/upload");

router.get(
  "/",
  authenticate,
  authorize(["client", "admin"]),
  carController.getAllCars
);
router.get(
  "/:id",
  authenticate,
  authorize(["client", "admin"]),
  carController.getCarById
);
router.post(
  "/",
  authenticate,
  authorize("client"),
  upload.array('images', 10),
  [
    body("make").notEmpty(),
    body("model").notEmpty(),
    body("year").isInt(),
    body("vin").notEmpty(),
    body("licensePlate").notEmpty(),
  ],
  carController.createCar
);
router.put("/:id", authenticate, authorize("client"), upload.array('images', 10), carController.updateCar);
router.delete("/:id", authenticate, authorize("client"), carController.deleteCar);

module.exports = router;
