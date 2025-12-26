const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        'product_order',      // New product order for workshop
        'order_status_update', // Order status changed
        'booking_request',    // New booking request for mechanic
        'booking_accepted',   // Booking accepted
        'booking_completed',  // Booking completed
        'booking_status_update', // Booking status changed
        'new_message',         // New chat message
        'maintenance_reminder' // Maintenance task reminder
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    read: {
      type: Boolean,
      default: false,
    },
    data: {
      type: mongoose.Schema.Types.Mixed, // Additional data for the notification
    },
  },
  { timestamps: true }
);

// Index for efficient queries
notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, read: 1 });

module.exports = mongoose.model("Notification", notificationSchema);