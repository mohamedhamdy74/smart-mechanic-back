require('dotenv').config();
const mongoose = require('mongoose');

async function checkOrders() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const Order = require('./models/Order');

        const count = await Order.countDocuments();
        console.log('Total Orders in DB:', count);

        const orders = await Order.find({})
            .select('workshopId status totalAmount createdAt userId')
            .lean();

        console.log('\nOrders:');
        orders.forEach((o, i) => {
            console.log(`${i + 1}. workshopId: ${o.workshopId}, status: ${o.status}, total: ${o.totalAmount}, date: ${o.createdAt}`);
        });

        // Check specific workshopId
        const workshopId = '691b93af688f60e81e718407';
        const workshopOrders = await Order.find({ workshopId }).lean();
        console.log(`\nOrders for workshop ${workshopId}:`, workshopOrders.length);

        // Count completed/shipped orders
        const completedOrders = await Order.countDocuments({
            workshopId,
            status: { $in: ['completed', 'shipped'] }
        });
        console.log('Completed/Shipped orders for workshop:', completedOrders);

        await mongoose.connection.close();
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

checkOrders();
