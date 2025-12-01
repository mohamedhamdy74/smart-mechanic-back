const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const jwt = require("jsonwebtoken");
const userController = require("../controllers/userController");

// Register a new user
router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("الاسم مطلوب"),
    body("email")
      .trim()
      .isEmail()
      .withMessage("البريد الإلكتروني غير صحيح")
      .normalizeEmail(),
    body("password")
      .isLength({ min: 6 })
      .withMessage("كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
    body("role")
      .notEmpty()
      .withMessage("نوع المستخدم مطلوب")
      .isIn(["client", "mechanic", "workshop"])
      .withMessage("نوع المستخدم غير صحيح"),
    body("phone")
      .optional()
      .matches(/^(\+20|0)?[0-9]{10,11}$/)
      .withMessage("رقم الهاتف غير صحيح (يجب أن يبدأ بـ +20 أو 0 ويحتوي على 10-11 رقم)"),
    body("location")
      .notEmpty()
      .withMessage("العنوان مطلوب"),
  ],
  userController.register
);

// User login
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Please enter a valid email"),
    body("password").exists().withMessage("Password is required"),
  ],
  userController.login
);

// Verify token endpoint
router.get("/verify", require("../middlewares/auth").authenticate, async (req, res) => {
  try {
    // Get full user data from database to ensure it's current
    const User = require("../models/User");
    const user = await User.findById(req.user.id).select('-password');

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    res.json({
      valid: true,
      user: {
        _id: user._id,
        id: user._id, // Keep both for compatibility
        email: user.email,
        role: user.role,
        name: user.name,
        phone: user.phone,
        location: user.location,
        carBrand: user.carBrand,
        carModel: user.carModel,
        carYear: user.carYear,
        plateNumber: user.plateNumber,
        mileage: user.mileage,
        skills: user.skills,
        experienceYears: user.experienceYears,
        rating: user.rating,
        specialty: user.specialty,
        workshopName: user.workshopName,
        availabilityStatus: user.availabilityStatus,
        totalBookings: user.totalBookings,
        completedBookings: user.completedBookings
      }
    });
  } catch (error) {
    console.error('Error in token verification:', error);
    return res.status(500).json({ message: "Internal server error during verification" });
  }
});

// Get current user endpoint for persistent login
router.get("/me", require("../middlewares/auth").authenticate, userController.getCurrentUser);

// Refresh token endpoint
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ message: "Refresh token required" });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);

    // Generate new access token
    const accessToken = jwt.sign(
      { id: decoded.id, email: decoded.email, role: decoded.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      accessToken,
      message: "Token refreshed successfully"
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    return res.status(401).json({ message: "Invalid refresh token" });
  }
});

module.exports = router;
