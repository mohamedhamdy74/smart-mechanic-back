const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    mechanicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    serviceType: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    appointmentDate: {
      type: Date,
      required: true,
    },
    appointmentTime: {
      type: String,
      required: true,
    },
    carInfo: {
      type: String,
      required: true,
    },
    licensePlate: {
      type: String,
      required: true,
    },
    location: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "in_progress", "completed", "cancelled"],
      default: "pending",
    },
    estimatedCost: {
      type: Number,
    },
    actualCost: {
      type: Number,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "refunded"],
      default: "pending",
    },
    customerRating: {
      type: Number,
      min: 1,
      max: 5,
    },
    customerFeedback: {
      type: String,
    },
    reviews: [{
      clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
      },
      comment: { type: String },
      createdAt: { type: Date, default: Date.now }
    }],
    serviceRecords: [{
      mechanicId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      workDescription: { type: String, required: true },
      cost: { type: Number, required: true },
      parts: [{ name: String, cost: Number }],
      laborCost: { type: Number, required: true },
      createdAt: { type: Date, default: Date.now }
    }],
    invoice: {
      serviceRecordId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ServiceRecord",
      },
      totalAmount: { type: Number },
      platformFee: { type: Number }, // 20% of total
      mechanicAmount: { type: Number }, // 80% of total
      paymentStatus: {
        type: String,
        enum: ["pending", "paid", "failed"],
        default: "pending",
      },
      paymentMethod: { type: String },
      createdAt: { type: Date, default: Date.now }
    },
    mechanicNotes: {
      type: String,
    },
    completedAt: {
      type: Date,
    },
    serviceStartedAt: {
      type: Date,
    },
    serviceDuration: {
      type: Number, // Duration in minutes
    },
    images: [{ type: String }], // For service photos
  },
  { timestamps: true }
);

// Indexes for better query performance
bookingSchema.index({ customerId: 1, status: 1 });
bookingSchema.index({ mechanicId: 1, status: 1 });
bookingSchema.index({ appointmentDate: 1 });

module.exports = mongoose.model("Booking", bookingSchema);