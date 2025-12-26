const User = require("../models/User");
const { validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { getEmbedding } = require("../utils/embedding-utils");

exports.getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, role } = req.query;
    let query = {};

    // If role filter is provided, filter by role
    if (role) {
      query.role = role;
    }

    // If user is not admin, only allow them to see mechanics
    if (req.user && req.user.role !== 'admin') {
      query.role = 'mechanic';
    }

    // Use lean() for better performance and sort by creation date
    const users = await User.find(query)
      .select('-password') // Exclude password field
      .sort({ createdAt: -1 }) // Sort by newest first
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    const count = await User.countDocuments(query);

    // Return the users array directly for backward compatibility
    res.json({
      users,
      total: count,
      page: Number(page),
      pages: Math.ceil(count / limit),
    });
  } catch (err) {
    next(err);
  }
};

// Public endpoint for viewing mechanics (no authentication required)
exports.getPublicMechanics = async (req, res, next) => {
  try {
    const { page = 1, limit = 12 } = req.query;
    const query = { role: "mechanic" };

    // ✅ شغل استعلامين find و countDocuments في نفس الوقت لتقليل التأخير
    // ✅ استخدم lean() لتحسين الأداء وتقليل الذاكرة
    const [mechanics, count] = await Promise.all([
      User.find({ ...query, isApproved: true })
        .select("-password -pendingUpdates")
        .sort({ rating: -1, completedBookings: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      User.countDocuments({ ...query, isApproved: true }),
    ]);

    // ✅ تحويل البيانات للعرض مع منطق التقييم كما هو
    const transformedMechanics = mechanics.map((mechanic) => {
      const rating = mechanic.rating ?? 4.5;
      const completedBookings = mechanic.completedBookings ?? 0;
      const experienceYears = mechanic.experienceYears ?? 0;
      const skills = mechanic.skills?.length ? mechanic.skills : ["صيانة عامة"];

      let userLevel = "ميكانيكي جديد";
      if (completedBookings >= 10 && rating >= 4.5 && experienceYears >= 2) {
        userLevel = "ميكانيكي محترف";
      } else if (completedBookings >= 5 && rating >= 4.5) {
        userLevel = "ميكانيكي مميز";
      } else if (completedBookings >= 3 && experienceYears >= 2) {
        userLevel = "ميكانيكي متمرس";
      }

      return {
        id: mechanic._id,
        name: mechanic.name,
        specialization: skills.join("، "),
        experience:
          experienceYears > 0 ? `${experienceYears} سنوات` : "خبرة متنوعة",
        rating,
        reviews: completedBookings,
        level: userLevel,
        phone: mechanic.phone || "غير محدد",
        email: mechanic.email,
        location: mechanic.location || "أسوان",
        services: skills,
        image: mechanic.profileImage ? `http://localhost:5000/${mechanic.profileImage}` : null,
        profileImage: mechanic.profileImage,
        latitude: mechanic.latitude,
        longitude: mechanic.longitude,
        lastLocationUpdate: mechanic.lastLocationUpdate,
      };
    });

    res.json({
      mechanics: transformedMechanics,
      total: count,
      page: Number(page),
      pages: Math.ceil(count / limit),
    });
  } catch (err) {
    next(err);
  }
};

// Get all mechanic skills with counts (public endpoint)
exports.getMechanicSkills = async (req, res, next) => {
  try {
    // Aggregate skills from all mechanics
    const skillsAggregation = await User.aggregate([
      { $match: { role: "mechanic" } },
      { $unwind: { path: "$skills", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ["$skills", "صيانة عامة"] },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Map icons for common services
    const iconMap = {
      "ميكانيكي عام": "Wrench",
      "صيانة عامة": "Wrench",
      "إصلاح المحركات": "Settings",
      "إصلاح الكهرباء": "Battery",
      "كهرباء السيارات": "Battery",
      "إصلاح الفرامل": "Shield",
      "فرامل": "Shield",
      "تغيير الزيوت": "Droplet",
      "تغيير الزيت": "Droplet",
      "إصلاح الإطارات": "Gauge",
      "فحص شامل": "TrendingUp",
      "صيانة دورية": "Settings",
      "إصلاح الهيكل": "Car",
      "طلاء السيارات": "Car",
      "إصلاح ناقل الحركة": "Zap",
      "تكييف": "Wind",
      "نظام التبريد": "Thermometer",
    };

    const skills = skillsAggregation.map(skill => ({
      title: skill._id,
      count: skill.count,
      icon: iconMap[skill._id] || "Wrench"
    }));

    res.json({
      skills,
      total: skills.length
    });
  } catch (err) {
    next(err);
  }
};

exports.getUserById = async (req, res, next) => {
  try {
    console.log('getUserById called for id:', req.params.id, 'user:', req.user?.id, 'role:', req.user?.role);
    // Use lean() and select only needed fields for better performance
    const user = await User.findById(req.params.id)
      .select('-password -pendingUpdates')
      .lean();

    if (!user) return res.status(404).json({ message: "User not found" });

    // Allow access if:
    // 1. User is viewing their own profile (authenticated)
    // 2. User is admin (authenticated)
    // 3. User is client viewing a mechanic profile (authenticated)
    // 4. Anyone viewing a mechanic profile (public access for mechanics)
    const isAuthenticated = !!req.user;
    const isOwnProfile = isAuthenticated && req.params.id === req.user.id;
    const isAdmin = isAuthenticated && req.user.role === "admin";
    const isClientViewingMechanic = isAuthenticated && req.user.role === "client" && user.role === "mechanic";
    const isPublicMechanicAccess = !isAuthenticated && user.role === "mechanic";

    if (!isOwnProfile && !isAdmin && !isClientViewingMechanic && !isPublicMechanicAccess) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Calculate user level based on completed bookings and rating - optimized
    let userLevel = "";
    let levelColor = "";

    const completedBookings = user.completedBookings || 0;

    if (user.role === "client") {
      if (completedBookings >= 10) {
        userLevel = "عميل ذهبي";
        levelColor = "gold";
      } else if (completedBookings >= 5) {
        userLevel = "عميل مميز";
        levelColor = "silver";
      } else if (completedBookings > 0) {
        userLevel = "عميل نشط";
        levelColor = "bronze";
      } else {
        userLevel = "عميل جديد";
        levelColor = "new";
      }
    } else if (user.role === "mechanic") {
      const rating = user.rating || 0;
      const experienceYears = user.experienceYears || 0;

      if (completedBookings >= 10 && rating >= 4.5 && experienceYears >= 2) {
        userLevel = "ميكانيكي محترف";
        levelColor = "expert";
      } else if (completedBookings >= 5 && rating >= 4.5) {
        userLevel = "ميكانيكي مميز";
        levelColor = "premium";
      } else if (completedBookings >= 3 && experienceYears >= 2) {
        userLevel = "ميكانيكي متمرس";
        levelColor = "experienced";
      } else {
        userLevel = "ميكانيكي جديد";
        levelColor = "new";
      }
    }

    // Return user data with calculated level
    const userData = { ...user, level: userLevel, levelColor: levelColor };

    res.json(userData);
  } catch (err) {
    next(err);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    let user;
    if (req.params.id) {
      // Update by ID (existing logic)
      user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (req.params.id !== req.user.id && req.user.role !== "admin")
        return res.status(403).json({ message: "Forbidden" });
    } else {
      // Profile update (new logic)
      user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ message: "User not found" });
    }

    // For mechanics, if admin approval is required, save to pending updates
    if (user.role === 'mechanic' && req.user.role !== 'admin') {
      // Save updates to pending approval
      user.pendingUpdates = {
        ...req.body,
        requestedAt: new Date()
      };
      await user.save();

      const userData = user.toObject();
      delete userData.password;
      res.json({
        ...userData,
        message: "تم إرسال طلب التحديث للمراجعة من قبل المدير"
      });
    } else {
      // Direct update for clients, workshops, or admin updates
      console.log('Previous user data:', user.toObject());
      console.log('Updating with body:', req.body);

      // Explicitly update fields to ensure mongoose tracks changes
      Object.keys(req.body).forEach(key => {
        user[key] = req.body[key];
      });

      // Mark fields as modified if needed (though direct assignment usually works)
      if (req.body.location) user.markModified('location');

      await user.save();
      console.log('Updated user data:', user.toObject());

      const userData = user.toObject();
      delete userData.password;
      res.json(userData);
    }
  } catch (err) {
    next(err);
  }
};

// Update mechanic availability status
exports.updateAvailability = async (req, res, next) => {
  try {
    const { availabilityStatus } = req.body;

    if (!['available', 'unavailable'].includes(availabilityStatus)) {
      return res.status(400).json({ message: "Invalid availability status" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.role !== 'mechanic') {
      return res.status(403).json({ message: "Only mechanics can update availability" });
    }

    user.availabilityStatus = availabilityStatus;
    await user.save();

    const userData = user.toObject();
    delete userData.password;
    res.json(userData);
  } catch (err) {
    next(err);
  }
};

// Register a new user
exports.register = async (req, res, next) => {
  try {
    // DEBUG: Log the incoming request body
    console.log('[DEBUG] Register request body:', JSON.stringify(req.body, null, 2));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // DEBUG: Log the validation errors
      console.log('[DEBUG] Validation errors:', JSON.stringify(errors.array(), null, 2));
      return res.status(400).json({
        success: false,
        errors: errors.array(),
        message: "بيانات التسجيل غير صحيحة",
      });
    }

    const {
      name,
      email,
      password,
      role,
      phone,
      location,
      skills,
      experienceYears,
      workshopName,
      workshopAddress,
      carBrand,
      carModel,
      carYear,
      plateNumber,
      lastMaintenance,
      dealership,
      specialty,
    } = req.body;

    // Validate role
    const validRoles = ['client', 'mechanic', 'workshop'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "نوع المستخدم غير صحيح",
      });
    }

    // Admin role is not allowed in registration - only one admin account exists
    if (role === 'admin') {
      return res.status(400).json({
        success: false,
        message: "لا يمكن التسجيل كمدير. حساب المدير موجود بالفعل.",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: {
          message:
            "عذراً، هذا البريد الإلكتروني مسجل بالفعل. الرجاء استخدام بريد إلكتروني آخر.",
          code: "EMAIL_EXISTS",
        },
      });
    }

    // Create new user - include additional fields if provided
    const user = new User({
      name,
      email,
      password,
      role: role || "client", // Default role is 'client' if not specified
      phone: phone ? (phone.startsWith('+20') ? phone : `+20${phone}`) : undefined, // Ensure phone starts with +20 if provided
      location,
      // Mechanic fields
      skills: skills || (specialty ? [specialty] : undefined),
      experienceYears: experienceYears || undefined,
      specialty: specialty || undefined,
      // Workshop fields
      workshopName: workshopName || undefined,
      workshopAddress: workshopAddress || undefined,
      // Client fields
      carBrand: carBrand || undefined,
      carModel: carModel || undefined,
      carYear: carYear || undefined,
      plateNumber: plateNumber || undefined,
      lastMaintenance: lastMaintenance || undefined,
      dealership: dealership || undefined,
      isApproved: role === 'client' ? true : false, // Clients are auto-approved, others need admin
    });

    // Generate embedding for mechanic immediately
    if (role === 'mechanic') {
      try {
        const profileText = [
          name,
          specialty,
          skills?.join(' '),
          experienceYears ? `${experienceYears} years experience` : ''
        ].filter(Boolean).join(' ');

        if (profileText) {
          console.log(`[DEBUG] Generating initial embedding for mechanic: ${name}`);
          user.mechanicProfileEmbedding = await getEmbedding(profileText);
        }
      } catch (embedError) {
        console.error(`[WARN] Failed to generate initial embedding for ${name}:`, embedError.message);
        // Non-blocking error
      }
    }

    // Save user to database
    await user.save();

    // Generate JWT tokens
    const accessToken = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const refreshToken = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Return user data and tokens (excluding password)
    const userData = user.toObject();
    delete userData.password;

    res.status(201).json({
      message: "User registered successfully",
      user: userData,
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
};

// User login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate JWT tokens
    const accessToken = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const refreshToken = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Return user data and tokens (excluding password)
    const userData = user.toObject();
    delete userData.password;

    res.json({
      message: "Login successful",
      user: userData,
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "User deleted" });
  } catch (err) {
    next(err);
  }
};

// Get pending registrations (mechanics and workshops)
exports.getPendingRegistrations = async (req, res, next) => {
  try {
    const users = await User.find({
      role: { $in: ['mechanic', 'workshop'] },
      isApproved: false
    }).select('name email role phone location createdAt workshopName');

    res.json({
      users,
      total: users.length
    });
  } catch (err) {
    next(err);
  }
};

// Approve registration (admin only)
exports.approveRegistration = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.isApproved = true;
    await user.save();

    const userData = user.toObject();
    delete userData.password;

    res.json({
      message: "تمت الموافقة على الحساب بنجاح",
      user: userData
    });
  } catch (err) {
    next(err);
  }
};

// Get pending mechanic updates (admin only)
exports.getPendingMechanicUpdates = async (req, res, next) => {
  try {
    const mechanics = await User.find({
      role: 'mechanic',
      pendingUpdates: { $exists: true, $ne: null }
    }).select('name email pendingUpdates createdAt');

    res.json({
      mechanics,
      total: mechanics.length
    });
  } catch (err) {
    next(err);
  }
};

// Approve mechanic profile updates (admin only)
exports.approveMechanicUpdates = async (req, res, next) => {
  try {
    const mechanic = await User.findById(req.params.id);
    if (!mechanic) return res.status(404).json({ message: "Mechanic not found" });

    if (!mechanic.pendingUpdates) {
      return res.status(400).json({ message: "No pending updates found" });
    }

    // Apply the pending updates
    Object.assign(mechanic, mechanic.pendingUpdates);
    mechanic.pendingUpdates = undefined; // Clear pending updates

    await mechanic.save();

    const userData = mechanic.toObject();
    delete userData.password;

    res.json({
      message: "تمت الموافقة على تحديثات البروفايل بنجاح",
      mechanic: userData
    });
  } catch (err) {
    next(err);
  }
};

// Verify token endpoint
exports.verifyToken = async (req, res, next) => {
  try {
    // If we reach here, the token is already verified by the authenticate middleware
    // Just return the user data
    const userData = req.user.toObject();
    delete userData.password;
    res.json({
      valid: true,
      user: userData
    });
  } catch (err) {
    next(err);
  }
};

// Get current user endpoint for persistent login
exports.getCurrentUser = async (req, res) => {
  try {
    // Use lean() and select only needed fields for better performance
    const user = await User.findById(req.user.id)
      .select("-password -pendingUpdates")
      .lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Calculate user level for current user
    let userLevel = "";
    let levelColor = "";
    const completedBookings = user.completedBookings || 0;

    if (user.role === "client") {
      if (completedBookings >= 10) {
        userLevel = "عميل ذهبي";
        levelColor = "gold";
      } else if (completedBookings >= 5) {
        userLevel = "عميل مميز";
        levelColor = "silver";
      } else if (completedBookings > 0) {
        userLevel = "عميل نشط";
        levelColor = "bronze";
      } else {
        userLevel = "عميل جديد";
        levelColor = "new";
      }
    } else if (user.role === "mechanic") {
      const rating = user.rating || 0;
      const experienceYears = user.experienceYears || 0;

      if (completedBookings >= 10 && rating >= 4.5 && experienceYears >= 2) {
        userLevel = "ميكانيكي محترف";
        levelColor = "expert";
      } else if (completedBookings >= 5 && rating >= 4.5) {
        userLevel = "ميكانيكي مميز";
        levelColor = "premium";
      } else if (completedBookings >= 3 && experienceYears >= 2) {
        userLevel = "ميكانيكي متمرس";
        levelColor = "experienced";
      } else {
        userLevel = "ميكانيكي جديد";
        levelColor = "new";
      }
    }

    const userData = { ...user, level: userLevel, levelColor: levelColor };
    res.status(200).json(userData);
  } catch (err) {
    console.error('Error in getCurrentUser:', err);
    res.status(500).json({ message: "Server Error" });
  }
};

// Upload profile avatar
exports.uploadAvatar = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Check if user can update this profile
    if (req.params.id !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Save avatar path to user profile - use profileImage field
    // Normalize path to use forward slashes for URL
    const avatarPath = req.file.path.replace(/\\/g, '/');
    user.profileImage = avatarPath;
    await user.save();

    const userData = user.toObject();
    delete userData.password;
    res.json({
      message: "Avatar uploaded successfully",
      user: userData,
      avatarUrl: `http://localhost:5000/${avatarPath}`
    });
  } catch (err) {
    next(err);
  }
};

// Get mechanic reviews
exports.getMechanicReviews = async (req, res, next) => {
  try {
    const mechanicId = req.params.id;
    const { page = 1, limit = 10 } = req.query;

    // Find all completed bookings for this mechanic that have reviews
    const Booking = require("../models/Booking");
    const bookings = await Booking.find({
      mechanicId: mechanicId,
      status: 'completed',
      'reviews.0': { $exists: true }
    })
      .populate('customerId', 'name')
      .populate('reviews.clientId', 'name')
      .select('reviews serviceType carInfo createdAt')
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    // Extract reviews from bookings
    const reviews = [];
    bookings.forEach(booking => {
      booking.reviews.forEach(review => {
        reviews.push({
          id: review._id,
          rating: review.rating,
          comment: review.comment,
          createdAt: review.createdAt,
          serviceType: booking.serviceType,
          carInfo: booking.carInfo,
          customerName: booking.customerId.name
        });
      });
    });

    const total = reviews.length;

    res.json({
      reviews,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('Error fetching mechanic reviews:', err);
    next(err);
  }
};











// Get user notifications
exports.getNotifications = async (req, res, next) => {
  try {
    const Notification = require("../models/Notification");

    // Filter notifications based on user role
    let query = { recipientId: req.user.id };

    if (req.user.role === 'workshop') {
      // Workshops only get notifications about their products - FIXED: no booking notifications
      query.type = 'product_order';
    } else if (req.user.role === 'mechanic') {
      // Mechanics get booking-related notifications
      query.type = { $in: ['booking_request', 'booking_accepted', 'booking_completed'] };
    } else if (req.user.role === 'client') {
      // Clients get order and booking notifications
      query.type = { $in: ['order_status_update', 'booking_status_update'] };
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(50);

    // Disable caching for notifications to ensure real-time updates
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.json(notifications);
  } catch (err) {
    // Fallback to mock notifications if Notification model doesn't exist
    const mockNotifications = [
      {
        _id: '1',
        type: 'booking_accepted',
        title: 'تم قبول طلب الحجز',
        message: 'تم قبول طلب الصيانة الدورية الخاص بك',
        read: false,
        createdAt: new Date().toISOString()
      },
      {
        _id: '2',
        type: 'service_completed',
        title: 'تم إكمال الخدمة',
        message: 'تم إكمال خدمة الصيانة بنجاح',
        read: true,
        createdAt: new Date(Date.now() - 86400000).toISOString() // 1 day ago
      }
    ];

    res.json(mockNotifications);
  }
};

// Mark notification as read
exports.markNotificationAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    // In a real implementation, you would update the notification in the database
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    next(err);
  }
};

// Mark all notifications as read
exports.markAllNotificationsAsRead = async (req, res, next) => {
  try {
    // In a real implementation, you would update all notifications for the user
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
};
