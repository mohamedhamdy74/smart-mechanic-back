const express = require("express");
const router = express.Router();
const bookingController = require("../controllers/bookingController");
const { authenticate, authorize } = require("../middlewares/auth");
const { body } = require("express-validator");

// All booking routes require authentication
router.use(authenticate);

// Create booking request (customers only)
router.post(
  "/",
  authorize("client"),
  [
    body("mechanicId").notEmpty().withMessage("Mechanic ID is required"),
    body("serviceType").notEmpty().withMessage("Service type is required"),
    body("description").notEmpty().withMessage("Description is required"),
    body("appointmentDate").isISO8601().withMessage("Valid appointment date is required"),
    body("appointmentTime").notEmpty().withMessage("Appointment time is required"),
    body("carInfo").notEmpty().withMessage("Car information is required"),
    body("licensePlate").notEmpty().withMessage("License plate is required"),
    body("location").notEmpty().withMessage("Location is required"),
  ],
  bookingController.createBooking
);

// Get user's bookings (customers and mechanics)
router.get("/", bookingController.getUserBookings);

// Get specific booking
router.get("/:id", bookingController.getBookingById);

// Update booking status (accept/reject/complete)
router.patch(
  "/:id/status",
  [
    body("status").isIn(["pending", "accepted", "rejected", "completed", "cancelled"])
      .withMessage("Invalid status"),
  ],
  bookingController.updateBookingStatus
);

// Complete service and generate invoice (mechanics only)
router.post(
  "/:id/complete",
  authorize("mechanic"),
  [
    body("workDescription").notEmpty().withMessage("Work description is required"),
    body("cost").isFloat({ min: 0 }).withMessage("Valid cost is required"),
    body("laborCost").isFloat({ min: 0 }).withMessage("Valid labor cost is required"),
  ],
  bookingController.completeService
);

// Add review (customers only)
router.post(
  "/:id/review",
  authorize("client"),
  [
    body("rating").isInt({ min: 1, max: 5 }).withMessage("Rating must be between 1 and 5"),
    body("comment").optional().isLength({ max: 1000 }).withMessage("Comment too long"),
  ],
  bookingController.addReview
);

// Add feedback/review (customers only) - alternative endpoint
router.post(
  "/:id/feedback",
  authorize("client"),
  [
    body("rating").isInt({ min: 1, max: 5 }).withMessage("Rating must be between 1 and 5"),
    body("comment").optional().isLength({ max: 1000 }).withMessage("Comment too long"),
  ],
  bookingController.addReview
);

// Process payment (customers only)
router.post(
  "/:id/payment",
  authorize("client"),
  [
    body("paymentMethod").isIn(["visa", "vodafone_cash", "fawry"]).withMessage("Invalid payment method"),
  ],
  bookingController.processPayment
);

// Delete booking (only pending bookings)
router.delete("/:id", bookingController.deleteBooking);

// Generate PDF invoice
router.get("/:id/invoice-pdf", bookingController.generateInvoicePDF);

// Admin routes
router.get("/admin/all", authorize("admin"), bookingController.getAllBookings);

module.exports = router;