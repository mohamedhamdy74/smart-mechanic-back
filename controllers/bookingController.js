const Booking = require("../models/Booking");
const User = require("../models/User");
const { validationResult } = require("express-validator");

// Create a new booking request
exports.createBooking = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      mechanicId,
      serviceType,
      description,
      appointmentDate,
      appointmentTime,
      carInfo,
      licensePlate,
      location,
      estimatedCost,
    } = req.body;

    // Verify mechanic exists and is a mechanic
    const mechanic = await User.findById(mechanicId);
    if (!mechanic || mechanic.role !== 'mechanic') {
      return res.status(404).json({ message: "Mechanic not found" });
    }

    const booking = new Booking({
      customerId: req.user.id,
      mechanicId,
      serviceType,
      description,
      appointmentDate,
      appointmentTime,
      carInfo,
      licensePlate,
      location,
      estimatedCost,
    });

    await booking.save();

    // Fetch customer name for notification
    const customer = await User.findById(req.user.id).select('name');
    const customerName = customer ? customer.name : 'عميل';

    // Create notification for mechanic
    const Notification = require("../models/Notification");
    const mechanicNotification = new Notification({
      recipientId: mechanicId,
      type: 'booking_request',
      title: 'طلب حجز جديد',
      message: `لديك طلب حجز جديد من ${customerName} لخدمة ${serviceType}`,
      data: {
        bookingId: booking._id,
        customerId: req.user.id,
        serviceType: serviceType
      }
    });
    await mechanicNotification.save();
    console.log('Created booking notification for mechanic:', mechanicId);

    // Emit real-time notification to mechanic
    if (global.emitNotificationToUser) {
      global.emitNotificationToUser(mechanicId, {
        _id: mechanicNotification._id,
        type: mechanicNotification.type,
        title: mechanicNotification.title,
        message: mechanicNotification.message,
        data: mechanicNotification.data,
        createdAt: mechanicNotification.createdAt
      });
    }

    // Populate mechanic data
    await booking.populate('mechanicId', 'name email phone location');
    await booking.populate('customerId', 'name email phone');

    res.status(201).json({
      message: "Booking request created successfully",
      booking,
    });
  } catch (err) {
    next(err);
  }
};

// Get all bookings for current user (customer or mechanic)
exports.getUserBookings = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    let query = {};

    if (req.user.role === 'client') {
      query.customerId = req.user.id;
    } else if (req.user.role === 'mechanic') {
      query.mechanicId = req.user.id;
    }

    console.log(`[DEBUG] Fetching bookings for user: ${req.user.id} (Role: ${req.user.role})`);
    console.log('[DEBUG] Query:', JSON.stringify(query));

    if (status) {
      query.status = status;
    }

    const bookings = await Booking.find(query)
      .populate('customerId', 'name email phone location')
      .populate('mechanicId', 'name email phone location specialty rating')
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const count = await Booking.countDocuments(query);
    console.log(`[DEBUG] Found ${count} bookings for user ${req.user.id}`);

    res.json({
      bookings,
      total: count,
      page: Number(page),
      pages: Math.ceil(count / limit),
    });
  } catch (err) {
    console.error('[DEBUG] Error in getUserBookings:', err);
    next(err);
  }
};

// Get booking by ID
exports.getBookingById = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('customerId', 'name email phone location carBrand carModel carYear plateNumber')
      .populate('mechanicId', 'name email phone location specialty rating skills experienceYears');

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Check if user has permission to view this booking
    if (booking.customerId._id.toString() !== req.user.id &&
      booking.mechanicId._id.toString() !== req.user.id &&
      req.user.role !== 'admin') {
      return res.status(403).json({ message: "Forbidden" });
    }

    res.json(booking);
  } catch (err) {
    next(err);
  }
};

// Update booking status (accept/reject/complete/start service)
exports.updateBookingStatus = async (req, res, next) => {
  try {
    const { status, mechanicNotes, actualCost } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Check permissions
    if (req.user.role === 'mechanic' && booking.mechanicId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (req.user.role === 'client' && booking.customerId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Update booking
    booking.status = status;
    if (mechanicNotes) booking.mechanicNotes = mechanicNotes;
    if (actualCost) booking.actualCost = actualCost;

    if (status === 'in_progress') {
      // Start service timer
      booking.serviceStartedAt = new Date();
    } else if (status === 'completed') {
      booking.completedAt = new Date();
      booking.paymentStatus = 'paid'; // Assume payment is completed

      // Calculate service duration if service was started
      if (booking.serviceStartedAt) {
        const durationMs = booking.completedAt.getTime() - booking.serviceStartedAt.getTime();
        booking.serviceDuration = Math.round(durationMs / (1000 * 60)); // Duration in minutes
      }
    }

    await booking.save();

    // Populate mechanic data for notification
    await booking.populate('mechanicId', 'name');

    // Create notification for the other party
    const Notification = require("../models/Notification");
    let notificationRecipient, notificationType, notificationTitle, notificationMessage;

    if (req.user.role === 'mechanic') {
      // Mechanic updated status, notify customer
      notificationRecipient = booking.customerId;
      if (status === 'accepted') {
        notificationType = 'booking_accepted';
        notificationTitle = 'تم قبول طلب الحجز';
        notificationMessage = `تم قبول طلب الحجز الخاص بك من قبل ${booking.mechanicId.name}`;
      } else if (status === 'completed') {
        notificationType = 'booking_completed';
        notificationTitle = 'تم إكمال الخدمة';
        notificationMessage = `تم إكمال الخدمة بنجاح من قبل ${booking.mechanicId.name}`;
      } else {
        notificationType = 'booking_status_update';
        notificationTitle = 'تحديث حالة الحجز';
        notificationMessage = `تم تحديث حالة الحجز إلى ${status}`;
      }
    } else if (req.user.role === 'client') {
      // Customer updated status, notify mechanic
      notificationRecipient = booking.mechanicId;
      notificationType = 'booking_status_update';
      notificationTitle = 'تحديث حالة الحجز';
      notificationMessage = `تم تحديث حالة الحجز إلى ${status} من قبل العميل`;
    }

    if (notificationRecipient) {
      const statusNotification = new Notification({
        recipientId: notificationRecipient,
        type: notificationType,
        title: notificationTitle,
        message: notificationMessage,
        data: {
          bookingId: booking._id,
          status: status,
          updatedBy: req.user.id
        }
      });
      await statusNotification.save();

      // Emit real-time notification to recipient
      if (global.emitNotificationToUser) {
        global.emitNotificationToUser(notificationRecipient.toString(), {
          _id: statusNotification._id,
          type: statusNotification.type,
          title: statusNotification.title,
          message: statusNotification.message,
          data: statusNotification.data,
          createdAt: statusNotification.createdAt
        });
      }
    }

    // Populate data
    await booking.populate('customerId', 'name email phone');
    await booking.populate('mechanicId', 'name email phone');

    res.json({
      message: `Booking ${status} successfully`,
      booking,
    });
  } catch (err) {
    next(err);
  }
};

// Complete service and generate invoice
exports.completeService = async (req, res, next) => {
  try {
    const { workDescription, cost, parts, laborCost } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) return res.status(404).json({ message: "Booking not found" });

    if (booking.mechanicId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (booking.status !== 'in_progress') {
      return res.status(400).json({ message: "Service must be in progress to complete" });
    }

    // Process parts - convert string array to object array
    let processedParts = [];
    if (parts && Array.isArray(parts)) {
      processedParts = parts.map(part => {
        if (typeof part === 'string') {
          return { name: part, cost: 0 };
        } else if (typeof part === 'object' && part.name) {
          return { name: part.name, cost: part.cost || 0 };
        }
        return null;
      }).filter(part => part !== null);
    }

    // Create service record
    const serviceRecord = {
      mechanicId: req.user.id,
      workDescription,
      cost: parseFloat(cost), // parts cost
      parts: processedParts,
      laborCost: parseFloat(laborCost),
      createdAt: new Date()
    };

    booking.serviceRecords.push(serviceRecord);

    // Calculate total service cost (parts + labor)
    const serviceCost = parseFloat(cost) + parseFloat(laborCost);
    const platformFee = serviceCost * 0.2; // 20%
    const totalAmount = serviceCost + platformFee; // What customer pays
    const mechanicAmount = serviceCost; // What mechanic gets

    booking.invoice = {
      serviceRecordId: booking.serviceRecords[booking.serviceRecords.length - 1]._id,
      totalAmount,
      platformFee,
      mechanicAmount,
      paymentStatus: 'pending',
      createdAt: new Date()
    };

    // Update booking status
    booking.status = 'completed';
    booking.completedAt = new Date();
    booking.actualCost = serviceCost;

    await booking.save();

    // Update mechanic stats (only completed bookings, earnings added on payment)
    const mechanic = await User.findById(booking.mechanicId);
    if (mechanic) {
      mechanic.completedBookings = (mechanic.completedBookings || 0) + 1;
      await mechanic.save();
    }

    res.json({
      booking,
      invoice: booking.invoice,
      message: "Service completed successfully. Invoice generated."
    });
  } catch (err) {
    next(err);
  }
};

// Add customer review
exports.addReview = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) return res.status(404).json({ message: "Booking not found" });

    if (booking.customerId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Only the customer can add reviews" });
    }

    if (booking.status !== 'completed') {
      return res.status(400).json({ message: "Can only review completed services" });
    }

    // Check if review already exists
    const existingReview = booking.reviews.find(r => r.clientId.toString() === req.user.id);
    if (existingReview) {
      return res.status(400).json({ message: "Review already exists" });
    }

    // Add review
    const review = {
      clientId: req.user.id,
      rating: parseInt(rating),
      comment,
      createdAt: new Date()
    };

    booking.reviews.push(review);
    await booking.save();

    // Update mechanic rating
    const mechanic = await User.findById(booking.mechanicId);
    if (mechanic) {
      const allReviews = await Booking.find({
        mechanicId: booking.mechanicId,
        'reviews.0': { $exists: true }
      }).select('reviews');

      let totalRating = 0;
      let reviewCount = 0;

      allReviews.forEach(b => {
        b.reviews.forEach(r => {
          totalRating += r.rating;
          reviewCount++;
        });
      });

      mechanic.rating = reviewCount > 0 ? totalRating / reviewCount : 0;
      await mechanic.save();
    }

    res.json({
      booking,
      review,
      message: "Review added successfully"
    });
  } catch (err) {
    next(err);
  }
};

// Process payment
exports.processPayment = async (req, res, next) => {
  try {
    const { paymentMethod } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) return res.status(404).json({ message: "Booking not found" });

    if (booking.customerId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (!booking.invoice || booking.invoice.paymentStatus === 'paid') {
      return res.status(400).json({ message: "No pending invoice found" });
    }

    // Simulate payment processing - Always succeed for demo purposes
    const paymentSuccess = true;

    if (paymentSuccess) {
      booking.invoice.paymentStatus = 'paid';
      booking.invoice.paymentMethod = paymentMethod;
      booking.paymentStatus = 'paid';

      // Calculate mechanic earnings (service cost)
      const mechanicEarnings = booking.invoice.mechanicAmount;

      // Update mechanic's total earnings
      const mechanic = await User.findById(booking.mechanicId);
      if (mechanic) {
        mechanic.totalEarnings = (mechanic.totalEarnings || 0) + mechanicEarnings;
        await mechanic.save();
      }

      await booking.save();

      // Create notification for mechanic about payment
      const Notification = require("../models/Notification");
      const paymentNotification = new Notification({
        recipientId: booking.mechanicId,
        type: 'order_status_update',
        title: 'تم استلام الدفعة',
        message: `تم استلام دفعة بقيمة ${mechanicEarnings} ج.م من خدمة مكتملة`,
        data: {
          bookingId: booking._id,
          amount: mechanicEarnings,
          paymentMethod: paymentMethod
        }
      });
      await paymentNotification.save();

      // Emit real-time notification to mechanic
      if (global.emitNotificationToUser) {
        global.emitNotificationToUser(booking.mechanicId.toString(), {
          _id: paymentNotification._id,
          type: paymentNotification.type,
          title: paymentNotification.title,
          message: paymentNotification.message,
          data: paymentNotification.data,
          createdAt: paymentNotification.createdAt
        });
      }

      res.json({
        success: true,
        message: "Payment processed successfully",
        invoice: booking.invoice,
        mechanicEarnings: mechanicEarnings
      });
    } else {
      booking.invoice.paymentStatus = 'failed';
      await booking.save();

      res.status(400).json({
        success: false,
        message: "Payment failed. Please try again."
      });
    }
  } catch (err) {
    next(err);
  }
};

// Get all bookings (admin only)
exports.getAllBookings = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    let query = {};

    if (status) {
      query.status = status;
    }

    const bookings = await Booking.find(query)
      .populate('customerId', 'name email phone')
      .populate('mechanicId', 'name email phone specialty')
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const count = await Booking.countDocuments(query);

    res.json({
      bookings,
      total: count,
      page: Number(page),
      pages: Math.ceil(count / limit),
    });
  } catch (err) {
    next(err);
  }
};

// Delete booking
exports.deleteBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Check permissions
    if (booking.customerId.toString() !== req.user.id &&
      booking.mechanicId.toString() !== req.user.id &&
      req.user.role !== 'admin') {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Only allow deletion of pending bookings
    if (booking.status !== 'pending') {
      return res.status(400).json({ message: "Can only delete pending bookings" });
    }

    await Booking.findByIdAndDelete(req.params.id);

    res.json({ message: "Booking deleted successfully" });
  } catch (err) {
    next(err);
  }
};

// Generate PDF invoice
exports.generateInvoicePDF = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('customerId', 'name email phone')
      .populate('mechanicId', 'name email phone specialty');

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Check if user has permission to view this invoice
    if (booking.customerId._id.toString() !== req.user.id &&
      booking.mechanicId._id.toString() !== req.user.id &&
      req.user.role !== 'admin') {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Check if booking is completed and has invoice
    if (booking.status !== 'completed' || !booking.invoice) {
      return res.status(400).json({ message: "Invoice not available for this booking" });
    }

    // Generate PDF using PDFKit
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument();

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${booking._id.toString().slice(-8).toUpperCase()}.pdf"`);

    // Pipe the PDF to the response
    doc.pipe(res);

    // Header
    doc.fontSize(20).text('فاتورة الخدمة', { align: 'center' });
    doc.moveDown();

    // Invoice details
    doc.fontSize(12);
    doc.text(`رقم الفاتورة: #${booking._id.toString().slice(-8).toUpperCase()}`, { align: 'right' });
    doc.text(`تاريخ الفاتورة: ${new Date(booking.invoice.createdAt).toLocaleDateString('ar-EG')}`, { align: 'right' });
    doc.text(`تاريخ الخدمة: ${new Date(booking.completedAt).toLocaleDateString('ar-EG')}`, { align: 'right' });
    doc.moveDown();

    // Customer and Mechanic info
    doc.text('معلومات العميل:', { align: 'right' });
    doc.text(`الاسم: ${booking.customerId.name}`, { align: 'right' });
    doc.text(`البريد الإلكتروني: ${booking.customerId.email}`, { align: 'right' });
    doc.moveDown();

    doc.text('معلومات الميكانيكي:', { align: 'right' });
    doc.text(`الاسم: ${booking.mechanicId.name}`, { align: 'right' });
    doc.text(`التخصص: ${booking.mechanicId.specialty || 'غير محدد'}`, { align: 'right' });
    doc.moveDown();

    // Service details
    doc.fontSize(14).text('تفاصيل الخدمة:', { align: 'right' });
    doc.fontSize(12);
    doc.text(`نوع الخدمة: ${booking.serviceType}`, { align: 'right' });
    doc.text(`السيارة: ${booking.carInfo}`, { align: 'right' });
    doc.text(`رقم اللوحة: ${booking.licensePlate}`, { align: 'right' });
    doc.moveDown();

    // Invoice summary
    doc.moveDown();
    doc.fontSize(14).text('ملخص الفاتورة:', { align: 'right' });
    doc.fontSize(12);
    const serviceCost = booking.invoice.mechanicAmount;
    doc.text(`تكلفة الخدمة: ${serviceCost} ج.م`, { align: 'right' });
    doc.text(`رسوم المنصة (20%): ${booking.invoice.platformFee} ج.م`, { align: 'right' });
    doc.text(`التكلفة الإجمالية: ${booking.invoice.totalAmount} ج.م`, { align: 'right' });
    doc.moveDown();

    // Payment status
    doc.fontSize(14).text('حالة الدفع:', { align: 'right' });
    doc.fontSize(12);
    doc.text(booking.invoice.paymentStatus === 'paid' ? 'تم الدفع' : 'في انتظار الدفع', { align: 'right' });

    if (booking.invoice.paymentMethod) {
      const paymentMethodText = booking.invoice.paymentMethod === 'visa' ? 'فيزا/ماستركارد' :
        booking.invoice.paymentMethod === 'vodafone_cash' ? 'فودافون كاش' :
          booking.invoice.paymentMethod === 'fawry' ? 'فوري' : booking.invoice.paymentMethod;
      doc.text(`طريقة الدفع: ${paymentMethodText}`, { align: 'right' });
    }

    // Footer
    doc.moveDown(2);
    doc.fontSize(10).text('شكراً لاستخدام خدماتنا!', { align: 'center' });
    doc.text('لأي استفسارات، يرجى الاتصال بنا', { align: 'center' });

    // Finalize the PDF
    doc.end();

  } catch (err) {
    next(err);
  }
};