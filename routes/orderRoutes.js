const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const { authenticate, authorize } = require("../middlewares/auth");
const { body } = require("express-validator");

router.get(
  "/",
  authenticate,
  authorize(["client", "admin", "workshop"]),
  orderController.getAllOrders
);
router.get(
  "/:id",
  authenticate,
  authorize(["client", "admin"]),
  orderController.getOrderById
);
router.get(
  "/user/:userId",
  authenticate,
  authorize(["client", "admin"]),
  orderController.getUserOrders
);
router.post(
  "/",
  authenticate,
  authorize("client"),
  [
    body("products").isArray({ min: 1 }),
    body("workshopId").isMongoId(),
    body("customerInfo.name").notEmpty(),
    body("customerInfo.phone").notEmpty(),
    body("customerInfo.address").notEmpty(),
    body("paymentMethod").isIn(["visa", "vodafone", "fawry"])
  ],
  orderController.createOrder
);
router.put(
  "/:id",
  authenticate,
  authorize(["client", "admin", "workshop"]),
  orderController.updateOrder
);
router.put(
  "/:id/confirm-receipt",
  authenticate,
  authorize("client"),
  orderController.confirmReceipt
);
router.delete(
  "/:id",
  authenticate,
  authorize(["client", "admin", "workshop"]),
  orderController.deleteOrder
);

// Workshop statistics endpoint
router.get(
  "/workshop/stats",
  authenticate,
  authorize("workshop"),
  orderController.getWorkshopStats
);

module.exports = router;
