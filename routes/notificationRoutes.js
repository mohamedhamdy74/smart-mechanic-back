const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");
const { authenticate, authorize } = require("../middlewares/auth");

router.get(
  "/",
  authenticate,
  authorize(["client", "mechanic", "workshop", "admin"]),
  notificationController.getNotifications
);

router.patch(
  "/:id/read",
  authenticate,
  authorize(["client", "mechanic", "workshop", "admin"]),
  notificationController.markAsRead
);

router.patch(
  "/mark-all-read",
  authenticate,
  authorize(["client", "mechanic", "workshop", "admin"]),
  notificationController.markAllAsRead
);

module.exports = router;