require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../back-end/models/User");

async function createAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("Connected to MongoDB");

    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: "admin" });
    if (existingAdmin) {
      console.log("Admin user already exists:", existingAdmin.email);
      console.log("Deleting existing admin...");
      await User.findByIdAndDelete(existingAdmin._id);
      console.log("Existing admin deleted.");
    }

    // Create new admin user
    const adminUser = new User({
      name: "مدير النظام",
      email: "admin@admin.com",
      password: "admin123", // This will be hashed by the pre-save middleware
      role: "admin",
      location: "القاهرة",
      phone: "+201234567890"
    });

    await adminUser.save();
    console.log("✅ Admin user created successfully!");
    console.log("📧 Email: admin@admin.com");
    console.log("🔑 Password: admin123");
    console.log("⚠️  Please change the password after first login.");
    console.log("\n🔗 To access admin dashboard:");
    console.log("1. Go to: http://localhost:5173/auth?mode=login");
    console.log("2. Select 'مدير النظام (admin@admin.com)' from user type");
    console.log("3. Enter password: admin123");
    console.log("4. Click 'دخول كمدير'");
    console.log("5. You will be redirected to /admin dashboard");

  } catch (error) {
    console.error("❌ Error creating admin:", error);
  } finally {
    await mongoose.connection.close();
    console.log("Database connection closed");
  }
}

createAdmin();