require("dotenv").config();
const mongoose = require("mongoose");
const Notification = require("./models/Notification");
const User = require("./models/User");

async function createTestNotifications() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    // Find some users
    const users = await User.find({}).limit(5);
    console.log('Found users:', users.map(u => ({ id: u._id, name: u.name, role: u.role })));

    if (users.length < 2) {
      console.log('Not enough users to create notifications');
      return;
    }

    // Create some test notifications
    const notifications = [
      {
        recipientId: users[0]._id,
        type: 'booking_request',
        title: 'طلب حجز جديد',
        message: 'لديك طلب حجز جديد من عميل',
        data: { bookingId: 'test123', customerId: users[1]._id }
      },
      {
        recipientId: users[1]._id,
        type: 'booking_status_update',
        title: 'تحديث حالة الحجز',
        message: 'تم تحديث حالة حجزك',
        data: { bookingId: 'test123', status: 'accepted' }
      },
      {
        recipientId: users[0]._id,
        type: 'order_status_update',
        title: 'تحديث حالة الطلب',
        message: 'تم شحن طلبك بنجاح',
        data: { orderId: 'order123', newStatus: 'shipped' }
      }
    ];

    for (const notif of notifications) {
      const notification = new Notification(notif);
      await notification.save();
      console.log('Created notification:', notif.title, 'for user:', notif.recipientId);
    }

    console.log('Test notifications created successfully');

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.connection.close();
  }
}

createTestNotifications();