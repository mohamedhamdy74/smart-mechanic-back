const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middlewares/auth");
const userController = require("../controllers/userController");
const orderController = require("../controllers/orderController");
const bookingController = require("../controllers/bookingController");
const adminReviewsController = require("../controllers/adminReviewsController");

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorize("admin"));

// System stats
router.get("/stats", async (req, res) => {
  try {
    // Get user stats
    const User = require("../models/User");
    const totalUsers = await User.countDocuments();
    const clients = await User.countDocuments({ role: "client" });
    const mechanics = await User.countDocuments({ role: "mechanic" });
    const workshops = await User.countDocuments({ role: "workshop" });

    // Get order stats
    const Order = require("../models/Order");
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: "pending" });
    const completedOrders = await Order.countDocuments({ status: "completed" });

    // Get booking stats
    const Booking = require("../models/Booking");
    const totalBookings = await Booking.countDocuments();
    const pendingBookings = await Booking.countDocuments({ status: "pending" });
    const completedBookings = await Booking.countDocuments({
      status: "completed",
    });

    // Calculate revenue (from completed orders and bookings)
    const completedOrderRevenue = await Order.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);

    const completedBookingRevenue = await Booking.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, total: { $sum: "$totalCost" } } },
    ]);

    const orderRevenue = completedOrderRevenue[0]?.total || 0;
    const bookingRevenue = completedBookingRevenue[0]?.total || 0;
    const totalRevenue = orderRevenue + bookingRevenue;

    res.json({
      users: {
        total: totalUsers,
        clients,
        mechanics,
        workshops,
      },
      orders: {
        total: totalOrders,
        pending: pendingOrders,
        completed: completedOrders,
      },
      bookings: {
        total: totalBookings,
        pending: pendingBookings,
        completed: completedBookings,
      },
      revenue: {
        total: totalRevenue,
        fromOrders: orderRevenue,
        fromBookings: bookingRevenue,
      },
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    res.status(500).json({ message: "Error fetching statistics" });
  }
});

// Orders management
router.get("/orders", orderController.getAllOrders);
router.patch("/orders/:id/status", orderController.updateOrder);

// Appointments/Bookings management
router.get("/appointments", bookingController.getAllBookings);
router.patch("/appointments/:id/status", bookingController.updateBookingStatus);

// Reviews management
router.get("/reviews", adminReviewsController.listReviews);
router.get("/reviews/:id", adminReviewsController.getReviewDetails);
router.patch("/reviews/:id/hide", adminReviewsController.toggleHideReview);
router.delete("/reviews/:id", adminReviewsController.softDeleteReview);

// Pending changes management
// router.get("/pending-changes", userController.getPendingMechanicUpdates);
// router.post("/pending-changes/:id/approve", userController.approveMechanicUpdates);
router.post("/pending-changes/:id/reject", async (req, res) => {
  try {
    const User = require("../models/User");
    const mechanic = await User.findById(req.params.id);
    if (!mechanic)
      return res.status(404).json({ message: "Mechanic not found" });

    mechanic.pendingUpdates = undefined; // Clear pending updates
    await mechanic.save();

    res.json({ message: "تم رفض التعديلات بنجاح" });
  } catch (error) {
    res.status(500).json({ message: "Error rejecting changes" });
  }
});

// Users management
router.get("/users", async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    const User = require("../models/User");

    const query = {};
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const users = await User.find(query)
      .select("-password")
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    // Get additional stats for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const Order = require("../models/Order");
        const Booking = require("../models/Booking");

        const ordersCount = await Order.countDocuments({
          customerId: user._id,
        });
        const bookingsCount = await Booking.countDocuments({
          customerId: user._id,
        });

        return {
          ...user.toObject(),
          ordersCount,
          bookingsCount,
        };
      })
    );

    res.json({
      users: usersWithStats,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Error fetching users" });
  }
});

router.patch("/users/:id/status", async (req, res) => {
  try {
    const User = require("../models/User");
    const { isActive } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User status updated successfully", user });
  } catch (error) {
    console.error("Error updating user status:", error);
    res.status(500).json({ message: "Error updating user status" });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    const User = require("../models/User");

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Error deleting user" });
  }
});

// Mechanics management
router.get("/mechanics", async (req, res) => {
  try {
    const { page = 1, limit = 20, search, specialty } = req.query;
    const User = require("../models/User");
    const Booking = require("../models/Booking");

    const query = { role: "mechanic" };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    if (specialty) {
      query.specialties = { $in: [specialty] };
    }

    const mechanics = await User.find(query)
      .select("-password")
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    // Get additional stats for each mechanic
    const mechanicsWithStats = await Promise.all(
      mechanics.map(async (mechanic) => {
        const totalBookings = await Booking.countDocuments({
          mechanicId: mechanic._id,
        });
        const completedBookings = await Booking.countDocuments({
          mechanicId: mechanic._id,
          status: "completed",
        });

        // Calculate average rating from reviews
        const BookingModel = require("../models/Booking");
        const reviews = await BookingModel.aggregate([
          {
            $match: {
              mechanicId: mechanic._id,
              "reviews.0": { $exists: true },
            },
          },
          { $unwind: "$reviews" },
          { $match: { "reviews.hidden": { $ne: true } } },
          { $group: { _id: null, avgRating: { $avg: "$reviews.rating" } } },
        ]);

        return {
          ...mechanic.toObject(),
          totalBookings,
          completedBookings,
          averageRating: reviews[0]?.avgRating || 0,
        };
      })
    );

    res.json({
      mechanics: mechanicsWithStats,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching mechanics:", error);
    res.status(500).json({ message: "Error fetching mechanics" });
  }
});

// Shops/Centers management
router.get("/shops", async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const User = require("../models/User");
    const Product = require("../models/Product");
    const Order = require("../models/Order");

    const query = { role: "workshop" };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const shops = await User.find(query)
      .select("-password")
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    // Get additional stats for each shop
    const shopsWithStats = await Promise.all(
      shops.map(async (shop) => {
        const productsCount = await Product.countDocuments({
          workshopId: shop._id,
        });
        const totalRevenue = await Order.aggregate([
          { $match: { workshopId: shop._id, status: "completed" } },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]);

        return {
          ...shop.toObject(),
          productsCount,
          totalRevenue: totalRevenue[0]?.total || 0,
        };
      })
    );

    res.json({
      shops: shopsWithStats,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching shops:", error);
    res.status(500).json({ message: "Error fetching shops" });
  }
});

// Products management
router.get("/products", async (req, res) => {
  try {
    const { page = 1, limit = 20, search, category } = req.query;
    const Product = require("../models/Product");
    const User = require("../models/User");

    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }
    if (category) {
      query.category = category;
    }

    const products = await Product.find(query)
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await Product.countDocuments(query);

    // Get workshop info for each product
    const productsWithShops = await Promise.all(
      products.map(async (product) => {
        const workshop = await User.findById(product.workshopId).select("name");
        return {
          ...product.toObject(),
          workshopName: workshop?.name || "Unknown Workshop",
        };
      })
    );

    res.json({
      products: productsWithShops,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Error fetching products" });
  }
});

// Notifications management
router.get("/notifications", async (req, res) => {
  try {
    const { page = 1, limit = 20, type, isRead } = req.query;
    const Notification = require("../models/Notification");

    const query = {};
    if (type) query.type = type;
    if (isRead !== undefined) query.isRead = isRead === "true";

    const notifications = await Notification.find(query)
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await Notification.countDocuments(query);

    res.json({
      notifications,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ message: "Error fetching notifications" });
  }
});

router.patch("/notifications/:id/read", async (req, res) => {
  try {
    const Notification = require("../models/Notification");
    const { isRead } = req.body;

    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json({
      message: "Notification status updated successfully",
      notification,
    });
  } catch (error) {
    console.error("Error updating notification:", error);
    res.status(500).json({ message: "Error updating notification" });
  }
});

// Analytics endpoints
router.get("/analytics", async (req, res) => {
  try {
    const { period = "30d" } = req.query;
    const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const Order = require("../models/Order");
    const Booking = require("../models/Booking");
    const User = require("../models/User");

    // Sales analytics
    const salesData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: "completed",
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          revenue: { $sum: "$totalAmount" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Bookings analytics
    const bookingsData = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          bookings: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // User growth
    const userGrowth = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          newUsers: { $sum: 1 },
          clients: {
            $sum: { $cond: [{ $eq: ["$role", "client"] }, 1, 0] },
          },
          mechanics: {
            $sum: { $cond: [{ $eq: ["$role", "mechanic"] }, 1, 0] },
          },
          workshops: {
            $sum: { $cond: [{ $eq: ["$role", "workshop"] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Rating analytics
    const ratingAnalytics = await Booking.aggregate([
      {
        $match: {
          "reviews.0": { $exists: true },
          "reviews.hidden": { $ne: true },
        },
      },
      { $unwind: "$reviews" },
      {
        $group: {
          _id: "$reviews.rating",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      sales: salesData,
      bookings: bookingsData,
      userGrowth,
      ratings: ratingAnalytics,
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({ message: "Error fetching analytics" });
  }
});

module.exports = router;
