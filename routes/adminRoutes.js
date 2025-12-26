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
      { $group: { _id: null, total: { $sum: "$actualCost" } } },
    ]);

    const platformEarnings = await Booking.aggregate([
      { $match: { status: "completed", "invoice.platformFee": { $exists: true } } },
      { $group: { _id: null, total: { $sum: "$invoice.platformFee" } } },
    ]);

    const orderRevenue = completedOrderRevenue[0]?.total || 0;
    const bookingRevenue = completedBookingRevenue[0]?.total || 0;
    const platformProfits = platformEarnings[0]?.total || 0;
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
        platformProfits: platformProfits,
      },
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    res.status(500).json({ message: "Error fetching statistics" });
  }
});

// Recent Activities
router.get("/activities", async (req, res) => {
  try {
    const User = require("../models/User");
    const Order = require("../models/Order");
    const Booking = require("../models/Booking");
    const Product = require("../models/Product");

    // Fetch recent users
    const recentUsers = await User.find()
      .select("name createdAt role")
      .sort({ createdAt: -1 })
      .limit(10);

    // Fetch recent orders
    const recentOrders = await Order.find()
      .populate("userId", "name")
      .sort({ createdAt: -1 })
      .limit(10);

    // Fetch recent bookings
    const recentBookings = await Booking.find()
      .populate("customerId", "name")
      .populate("mechanicId", "name")
      .sort({ createdAt: -1 })
      .limit(10);

    // Extract recent reviews from bookings
    const bookingsWithReviews = await Booking.find({ "reviews.0": { $exists: true } })
      .populate("customerId", "name")
      .sort({ createdAt: -1 })
      .limit(10);

    const recentReviews = bookingsWithReviews.flatMap(booking =>
      booking.reviews.map(review => ({
        type: 'review',
        action: 'تقييم جديد',
        user: booking.customerId?.name || 'عميل',
        detail: `تقييم ${review.rating} نجوم`,
        createdAt: review.createdAt || booking.updatedAt,
      }))
    );

    // Fetch recent products
    const recentProducts = await Product.find()
      .populate("userId", "name")
      .sort({ createdAt: -1 })
      .limit(5);

    // Normalize activities
    const activities = [
      ...recentUsers.map(u => ({
        type: 'user',
        action: 'مستخدم جديد',
        user: u.name,
        detail: u.role === 'client' ? 'عميل جديد' : u.role === 'mechanic' ? 'ميكانيكي جديد' : 'مركز خدمة جديد',
        createdAt: u.createdAt
      })),
      ...recentOrders.map(o => ({
        type: 'order',
        action: 'طلب جديد',
        user: o.userId?.name || 'عميل',
        detail: `طلب بمبلغ ${o.totalAmount} ج.م`,
        createdAt: o.createdAt
      })),
      ...recentBookings.map(b => ({
        type: 'booking',
        action: 'موعد محجوز',
        user: b.customerId?.name || 'عميل',
        detail: `حجز مع ${b.mechanicId?.name || 'ميكانيكي'}`,
        createdAt: b.createdAt
      })),
      ...recentReviews,
      ...recentProducts.map(p => ({
        type: 'product',
        action: 'منتج جديد',
        user: p.userId?.name || 'متجر',
        detail: p.name,
        createdAt: p.createdAt
      }))
    ];

    // Sort all activities by date
    activities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ activities: activities.slice(0, 20) });
  } catch (error) {
    console.error("Error fetching recent activities:", error);
    res.status(500).json({ message: "Error fetching activities" });
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

// Pending registrations for mechanics/workshops
router.get("/pending-registrations", userController.getPendingRegistrations);
router.post("/pending-registrations/:id/approve", userController.approveRegistration);

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
          userId: shop._id,
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
        const workshop = await User.findById(product.userId).select("name");
        return {
          ...product.toObject(),
          workshopName: workshop?.name || "غير محدد",
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

    const prevStartDate = new Date(startDate);
    prevStartDate.setDate(prevStartDate.getDate() - days);

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

    // Calculate detailed Performance Metrics
    const totalBookings = await Booking.countDocuments({ createdAt: { $gte: startDate } });
    const completedBookings = await Booking.countDocuments({ status: "completed", createdAt: { $gte: startDate } });
    const successRate = totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0;

    const avgMechanicStats = await User.aggregate([
      { $match: { role: "mechanic" } },
      { $group: { _id: null, avgResponse: { $avg: "$responseTime" }, avgRating: { $avg: "$rating" } } }
    ]);

    // Growth calculation
    const currentPeriodOrders = await Order.countDocuments({ createdAt: { $gte: startDate } });
    const prevPeriodOrders = await Order.countDocuments({
      createdAt: { $gte: prevStartDate, $lt: startDate }
    });
    const monthlyGrowth = prevPeriodOrders > 0
      ? ((currentPeriodOrders - prevPeriodOrders) / prevPeriodOrders) * 100
      : (currentPeriodOrders > 0 ? 100 : 0);

    // Revenue in current period
    const currentRevenue = await Order.aggregate([
      { $match: { createdAt: { $gte: startDate }, status: "completed" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]);

    res.json({
      sales: salesData,
      bookings: bookingsData,
      userGrowth,
      ratings: ratingAnalytics,
      performance: {
        successRate: Number(successRate.toFixed(1)),
        avgResponseTime: Number((avgMechanicStats[0]?.avgResponse || 0).toFixed(1)),
        avgRating: Number((avgMechanicStats[0]?.avgRating || 0).toFixed(1)),
        monthlyGrowth: Number(monthlyGrowth.toFixed(1)),
        totalRevenue: currentRevenue[0]?.total || 0
      }
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({ message: "Error fetching analytics" });
  }
});

module.exports = router;
