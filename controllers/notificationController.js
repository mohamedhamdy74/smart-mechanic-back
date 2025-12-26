const Notification = require("../models/Notification");

exports.getNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    // Filter notifications based on user role
    let query = { recipientId: req.user.id };

    if (req.user.role === 'workshop') {
      // Workshops only get notifications about their products - FIXED: no booking notifications
      query.type = 'product_order';
    } else if (req.user.role === 'mechanic') {
      // Mechanics get booking-related and message notifications
      query.type = { $in: ['booking_request', 'booking_accepted', 'booking_completed', 'order_status_update', 'new_message'] };
    } else if (req.user.role === 'client') {
      // Clients get order, booking, and message notifications
      query.type = { $in: ['order_status_update', 'booking_status_update', 'new_message'] };
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Notification.countDocuments(query);

    res.json({
      notifications,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    next(err);
  }
};

exports.markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    if (notification.recipientId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    notification.read = true;
    await notification.save();

    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    next(err);
  }
};

exports.markAllAsRead = async (req, res, next) => {
  try {
    // Filter notifications based on user role for security
    let query = { recipientId: req.user.id };

    if (req.user.role === 'workshop') {
      // Workshops only get notifications about their products - FIXED: no booking notifications
      query.type = 'product_order';
    } else if (req.user.role === 'mechanic') {
      query.type = { $in: ['booking_request', 'booking_accepted', 'booking_completed', 'new_message'] };
    } else if (req.user.role === 'client') {
      query.type = { $in: ['order_status_update', 'booking_status_update', 'new_message'] };
    }

    await Notification.updateMany(query, { read: true });

    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
};

exports.getUnreadCount = async (req, res, next) => {
  try {
    let query = { recipientId: req.user.id, read: false };

    if (req.user.role === 'workshop') {
      query.type = 'product_order';
    } else if (req.user.role === 'mechanic') {
      query.type = { $in: ['booking_request', 'booking_accepted', 'booking_completed', 'new_message'] };
    } else if (req.user.role === 'client') {
      query.type = { $in: ['order_status_update', 'booking_status_update', 'new_message'] };
    }

    const count = await Notification.countDocuments(query);
    res.json({ count });
  } catch (err) {
    next(err);
  }
};