const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { authenticate, authorize } = require("../middlewares/auth");
const { body } = require("express-validator");

// Admin only
router.get("/", authenticate, userController.getAllUsers);

// Profile endpoints - MUST come before /:id routes
router.get("/profile", authenticate, userController.getCurrentUser);
router.patch("/profile", authenticate, userController.updateUser);

// Update mechanic availability
router.patch("/availability", authenticate, userController.updateAvailability);

// Notifications routes - MUST come before /:id routes
router.get("/notifications", authenticate, userController.getNotifications);
router.patch("/notifications/:id/read", authenticate, userController.markNotificationAsRead);
router.patch("/notifications/mark-all-read", authenticate, userController.markAllNotificationsAsRead);

// Public route for viewing mechanics (no authentication required)
router.get("/mechanics/public", userController.getPublicMechanics);

// Get available mechanics near location
router.get("/mechanics/available", authenticate, userController.getAvailableMechanics);

// Admin routes for mechanic profile approval - MUST come before /:id routes
router.get("/admin/pending-updates", authenticate, authorize("admin"), userController.getPendingMechanicUpdates);

// Public route for viewing mechanic profiles (no authentication required for mechanics)
router.get("/:id", (req, res, next) => {
  // Check if this is a request for a mechanic profile
  const User = require("../models/User");
  User.findById(req.params.id).select('role').lean()
    .then(user => {
      if (user && user.role === 'mechanic') {
        // Allow public access for mechanic profiles
        return userController.getUserById(req, res, next);
      } else {
        // Require authentication for other user profiles
        return authenticate(req, res, () => userController.getUserById(req, res, next));
      }
    })
    .catch(err => next(err));
});
router.put("/:id", authenticate, userController.updateUser);
router.delete(
  "/:id",
  authenticate,
  authorize("admin"),
  userController.deleteUser
);

// Upload profile avatar
router.post("/:id/avatar", authenticate, require("../middlewares/upload").single('avatar'), userController.uploadAvatar);

// Get mechanic reviews
router.get("/:id/reviews", authenticate, userController.getMechanicReviews);

// Get mechanic location
router.get("/:id/location", authenticate, userController.getMechanicLocation);

// Update mechanic location
router.post("/:id/location", authenticate, authorize("mechanic"), userController.updateMechanicLocation);

// Approve mechanic updates
router.patch("/:id/approve-updates", authenticate, authorize("admin"), userController.approveMechanicUpdates);

module.exports = router;
