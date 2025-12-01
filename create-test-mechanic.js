require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");

async function createTestMechanic() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const mechanic = new User({
      _id: "690c9aa591144b9b4d724ddd",
      name: "Test Mechanic",
      email: "test.mechanic@email.com",
      password: "test123",
      role: "mechanic",
      phone: "+201091234567",
      location: "أسوان",
      skills: ["إصلاح المحركات", "تغيير الزيوت"],
      experienceYears: 5,
      rating: 4.5,
      completedBookings: 10,
      availabilityStatus: "available"
    });

    await mechanic.save();
    console.log("Test mechanic created with ID:", mechanic._id);

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.connection.close();
  }
}

createTestMechanic();