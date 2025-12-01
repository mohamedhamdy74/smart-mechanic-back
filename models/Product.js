const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    brand: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0 },
    inStock: {
      type: Boolean,
      default: function() {
        return this.stock > 0;
      }
    },
    category: { type: String, trim: true },
    description: { type: String, trim: true },
    images: [{ type: String }], // Array of image URLs or paths
    carType: { type: String, trim: true }, // Center-specific feature: car type compatibility
  },
  { timestamps: true }
);

// Add database indexes for performance
productSchema.index({ userId: 1, createdAt: -1 }); // For workshop products
productSchema.index({ category: 1, inStock: 1 }); // For category filtering
productSchema.index({ name: 1 }); // For text search
productSchema.index({ price: 1 }); // For price sorting
productSchema.index({ createdAt: -1 }); // For recent products

module.exports = mongoose.model("Product", productSchema);
