const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["client", "mechanic", "workshop", "admin"],
      required: true,
    },
    name: { type: String, required: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    phone: { type: String },
    location: { type: String, required: true },
    // Client fields
    carBrand: { type: String },
    carModel: { type: String },
    carYear: { type: String },
    plateNumber: { type: String },
    lastMaintenance: { type: Date },
    dealership: { type: String },
    totalBookings: { type: Number, default: 0 },
    completedBookings: { type: Number, default: 0 },
    mileage: { type: Number },
    // Mechanic fields
    skills: [{ type: String }],
    experienceYears: { type: Number },
    rating: { type: Number, default: 0 },
    specialty: { type: String },
    bio: { type: String },
    certifications: [{ type: String }],
    availabilityStatus: { type: String, enum: ["available", "unavailable"], default: "available" },
    totalEarnings: { type: Number, default: 0 },
    responseTime: { type: Number, default: 0 }, // in minutes
    acceptanceRate: { type: Number, default: 100 }, // percentage
    // Location for mechanics (used for distance & vector search)
    latitude: { type: Number },
    longitude: { type: Number },
    // Embedding for semantic search (array of floats)
    embedding: { type: [Number] },
    // Mechanic profile embedding for RAG (768 dimensions from Gemini)
    mechanicProfileEmbedding: { type: [Number] },
    // Profile update approval system
    pendingUpdates: {
      name: String,
      phone: String,
      location: String,
      skills: [{ type: String }],
      specialty: String,
      bio: String,
      experienceYears: Number,
      certifications: [{ type: String }],
      requestedAt: Date,
    },
    profileImage: { type: String }, // Profile picture path
    // Workshop fields (kept minimal for now)
    workshopName: { type: String },
    workshopAddress: { type: String },
    isVerified: { type: Boolean, default: false },
    description: { type: String },
    services: [{ type: String }],
    workingHours: { type: String },
  },
  { timestamps: true }
);

// Indexes for fast lookup
userSchema.index({ role: 1, createdAt: -1 }); // filter mechanics
userSchema.index({ role: 1, rating: -1, completedBookings: -1 }); // sort by rating/experience
userSchema.index({ email: 1 });
userSchema.index({ latitude: 1, longitude: 1 }); // location queries
userSchema.index({ availabilityStatus: 1 });
userSchema.index({ location: "2dsphere" }); // geospatial queries
userSchema.index({ name: 1 });
userSchema.index({ phone: 1 });

// Password hashing and embedding generation
userSchema.pre("save", async function (next) {
  // Hash password if modified
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }

  // Auto-generate mechanic profile embedding when profile changes
  if (this.role === 'mechanic' &&
    (this.isModified('skills') ||
      this.isModified('specialty') ||
      this.isModified('bio') ||
      this.isModified('name'))) {

    try {
      const { getEmbedding } = require('../utils/embedding-utils');

      // Create profile text from mechanic data
      const profileText = [
        this.name,
        this.specialty,
        this.skills?.join(' '),
        this.bio
      ].filter(Boolean).join(' ');

      if (profileText.trim()) {
        this.mechanicProfileEmbedding = await getEmbedding(profileText);
        console.log(`🔄 Updated embedding for mechanic: ${this.name}`);
      }
    } catch (error) {
      console.error(`❌ Failed to generate embedding for ${this.name}:`, error.message);
      // Don't block save if embedding fails
    }
  }

  next();
});

userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
