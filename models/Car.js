const mongoose = require("mongoose");

const carSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    make: { type: String, required: true },
    model: { type: String, required: true },
    year: { type: Number, required: true },
    vin: { type: String, required: true, unique: true },
    licensePlate: { type: String, required: true, unique: true },
    color: { type: String },
    mileage: { type: Number },
    fuelType: { type: String },
    transmission: { type: String },
    engineCapacity: { type: String },
    ownershipStatus: { type: String },
    images: [{ type: String }], // Array of image URLs or paths
  },
  { timestamps: true }
);

module.exports = mongoose.model("Car", carSchema);
