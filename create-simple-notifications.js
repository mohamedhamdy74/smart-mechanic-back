require("dotenv").config();
const mongoose = require("mongoose");
const Notification = require("./models/Notification");

async function createSimpleNotifications() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    // Create a simple notification for testing
    const notification = new Notification({
      recipientId: '690c8c9cd346830f695dd55e', // client user
      type: 'booking_status_update',
      title: 'تحديث حالة الحجز',
      message: 'تم قبول طلب الحجز الخاص بك',
      data: { bookingId: 'test123', status: 'accepted' }
    });

    await notification.save();
    console.log('Created test notification');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

createSimpleNotifications();