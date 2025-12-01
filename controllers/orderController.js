const Order = require("../models/Order");
const Product = require("../models/Product");
const { validationResult } = require("express-validator");

exports.getAllOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    let query = {};

    // Filter orders based on user role
    if (req.user.role === 'client') {
      // Clients can only see their own orders
      query.userId = req.user.id;
    } else if (req.user.role === 'workshop') {
      // Workshops can only see orders for their products
      query.workshopId = req.user.id;
    }
    // Admin can see all orders (no filter)

    const orders = await Order.find(query)
      .populate('userId', 'name email phone')
      .populate('workshopId', 'workshopName name')
      .populate({
        path: 'products.productId',
        select: 'name brand category images price'
      })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ createdAt: -1 }); // Most recent first

    const count = await Order.countDocuments(query);
    res.json({
      orders,
      total: count,
      page: Number(page),
      pages: Math.ceil(count / limit),
    });
  } catch (err) {
    next(err);
  }
};

exports.getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.userId.toString() !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ message: "Forbidden" });
    res.json(order);
  } catch (err) {
    next(err);
  }
};

exports.getUserOrders = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Check if user can access these orders
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: "Forbidden" });
    }

    const orders = await Order.find({ userId })
      .populate('workshopId', 'workshopName name')
      .sort({ createdAt: -1 });

    res.json({ orders });
  } catch (err) {
    next(err);
  }
};

exports.createOrder = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { products, workshopId, customerInfo, paymentMethod } = req.body;

    // Validate required fields
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: "يجب تحديد منتجات الطلب" });
    }

    if (!workshopId) {
      return res.status(400).json({ message: "يجب تحديد مركز الصيانة" });
    }

    if (!customerInfo || !customerInfo.name || !customerInfo.phone || !customerInfo.address) {
      return res.status(400).json({ message: "بيانات العميل مطلوبة" });
    }

    if (!paymentMethod) {
      return res.status(400).json({ message: "يجب تحديد طريقة الدفع" });
    }

    // Calculate total amount and update stock
    let totalAmount = 0;
    const orderProducts = [];

    for (const product of products) {
      const quantity = parseInt(product.quantity) || 1;
      const price = parseFloat(product.price) || 0;
      totalAmount += quantity * price;

      // Update product stock
      const productDoc = await Product.findById(product.productId || product.id);
      if (!productDoc) {
        return res.status(404).json({ message: `المنتج ${product.name} غير موجود` });
      }

      if (productDoc.stock < quantity) {
        return res.status(400).json({ message: `الكمية المطلوبة من ${productDoc.name} غير متوفرة` });
      }

      // Decrease stock
      productDoc.stock -= quantity;
      await productDoc.save();

      orderProducts.push({
        productId: product.productId || product.id,
        quantity,
        price
      });
    }

    const order = new Order({
      userId: req.user.id,
      workshopId,
      products: orderProducts,
      totalAmount,
      customerInfo,
      paymentMethod,
      status: 'confirmed' // Set status to confirmed for successful orders
    });

    await order.save();

    // Send notification to workshop about the order
    try {
      const Notification = require("../models/Notification");
      const newNotification = new Notification({
        recipientId: workshopId,
        type: 'product_order',
        title: 'طلب منتج جديد',
        message: `تم استلام طلب جديد بقيمة ${totalAmount} ج.م`,
        data: {
          orderId: order._id,
          totalAmount,
          customerName: customerInfo.name
        }
      });
      await newNotification.save();
    } catch (notificationError) {
      console.error('Error creating notification:', notificationError);
      // Don't fail the order creation if notification fails
    }

    console.log(`New order created: ${order._id} for workshop: ${workshopId}`);

    res.status(201).json(order);
  } catch (err) {
    console.error('Error creating order:', err);
    next(err);
  }
};

// Prevent duplicate notifications by checking if order was already processed
exports.createOrderOnce = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    // Check if order already exists to prevent duplicates
    const existingOrder = await Order.findOne({
      userId: req.user.id,
      workshopId: req.body.workshopId,
      items: req.body.items,
      createdAt: { $gte: new Date(Date.now() - 60000) } // Within last minute
    });

    if (existingOrder) {
      return res.status(200).json(existingOrder); // Return existing order instead of creating duplicate
    }

    const order = new Order({ ...req.body, userId: req.user.id });
    await order.save();

    // Send notification to workshop about the order
    // This would be implemented with WebSocket/Socket.IO in a real application
    // For now, we'll just log it
    console.log(`New order created: ${order._id} for workshop: ${order.workshopId}`);

    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
};

exports.updateOrder = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Allow workshops to update orders for their products
    const isWorkshopOwner = req.user.role === 'workshop' && order.workshopId.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    const isClientOwner = order.userId.toString() === req.user.id;

    if (!isWorkshopOwner && !isAdmin && !isClientOwner) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // If workshop is updating status, validate the status change
    if (req.body.status && isWorkshopOwner) {
      const validStatuses = ['pending', 'confirmed', 'shipped', 'completed', 'cancelled'];
      if (!validStatuses.includes(req.body.status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      // If cancelling order, restore stock
      if (req.body.status === 'cancelled' && order.status !== 'cancelled') {
        for (const orderProduct of order.products) {
          const product = await Product.findById(orderProduct.productId);
          if (product) {
            product.stock += orderProduct.quantity;
            await product.save();
          }
        }
      }
    }

    const oldStatus = order.status;
    Object.assign(order, req.body);
    await order.save();

    // Send notification to customer about status update if workshop updated it
    if (req.body.status && isWorkshopOwner && oldStatus !== req.body.status) {
      try {
        const Notification = require("../models/Notification");
        const statusMessages = {
          'confirmed': 'تم تأكيد طلبك',
          'shipped': 'تم شحن طلبك',
          'completed': 'تم إكمال طلبك',
          'cancelled': 'تم إلغاء طلبك'
        };

        const newNotification = new Notification({
          recipientId: order.userId,
          type: 'order_status_update',
          title: 'تحديث حالة الطلب',
          message: statusMessages[req.body.status] || 'تم تحديث حالة طلبك',
          data: {
            orderId: order._id,
            newStatus: req.body.status,
            totalAmount: order.totalAmount
          }
        });
        await newNotification.save();
      } catch (notificationError) {
        console.error('Error creating status update notification:', notificationError);
      }
    }

    res.json(order);
  } catch (err) {
    next(err);
  }
};

exports.deleteOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Allow workshops to delete orders for their products
    const isWorkshopOwner = req.user.role === 'workshop' && order.workshopId.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    const isClientOwner = order.userId.toString() === req.user.id;

    if (!isWorkshopOwner && !isAdmin && !isClientOwner) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // If deleting order, restore stock if order wasn't cancelled
    if (order.status !== 'cancelled') {
      for (const orderProduct of order.products) {
        const product = await Product.findById(orderProduct.productId);
        if (product) {
          product.stock += orderProduct.quantity;
          await product.save();
        }
      }
    }

    await Order.findByIdAndDelete(req.params.id);
    res.json({ message: "Order deleted" });
  } catch (err) {
    next(err);
  }
};

exports.confirmReceipt = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Only client who owns the order can confirm receipt
    if (order.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Only shipped orders can be confirmed as received
    if (order.status !== 'shipped') {
      return res.status(400).json({ message: "يمكن تأكيد الاستلام لطلبات المشحونة فقط" });
    }

    order.status = 'completed';
    await order.save();

    // Send notification to workshop about order completion
    try {
      const Notification = require("../models/Notification");
      const newNotification = new Notification({
        recipientId: order.workshopId,
        type: 'order_completed',
        title: 'تم تأكيد استلام الطلب',
        message: `قام العميل بتأكيد استلام الطلب رقم ${order._id.slice(-8)}`,
        data: {
          orderId: order._id,
          totalAmount: order.totalAmount,
          customerName: order.customerInfo.name
        }
      });
      await newNotification.save();
    } catch (notificationError) {
      console.error('Error creating receipt confirmation notification:', notificationError);
    }

    res.json(order);
  } catch (err) {
    next(err);
  }
};

// Get workshop statistics (sales, revenue, etc.)
exports.getWorkshopStats = async (req, res, next) => {
  try {
    const workshopId = req.user.id;
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const mongoose = require('mongoose');

    // Monthly sales and revenue
    const monthlyStats = await Order.aggregate([
      {
        $match: {
          workshopId: new mongoose.Types.ObjectId(workshopId),
          status: { $in: ['completed', 'shipped'] },
          createdAt: { $gte: currentMonth }
        }
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' }
        }
      }
    ]);

    // Total products count
    const totalProducts = await Product.countDocuments({ userId: workshopId });

    // Top selling products
    const topProducts = await Order.aggregate([
      {
        $match: {
          workshopId: new mongoose.Types.ObjectId(workshopId),
          status: { $in: ['completed', 'shipped'] }
        }
      },
      { $unwind: '$products' },
      {
        $group: {
          _id: '$products.productId',
          totalSold: { $sum: '$products.quantity' },
          totalRevenue: { $sum: { $multiply: ['$products.quantity', '$products.price'] } }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $project: {
          name: '$product.name',
          totalSold: 1,
          totalRevenue: 1
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 5 }
    ]);

    // Daily orders for the current month
    const dailyOrders = await Order.aggregate([
      {
        $match: {
          workshopId: new mongoose.Types.ObjectId(workshopId),
          status: { $in: ['completed', 'shipped'] },
          createdAt: { $gte: currentMonth }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          orders: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    const stats = {
      monthlySales: monthlyStats[0]?.totalOrders || 0,
      monthlyRevenue: monthlyStats[0]?.totalRevenue || 0,
      totalProducts,
      topProducts,
      dailyOrders
    };

    res.json(stats);
  } catch (err) {
    console.error('Error fetching workshop stats:', err);
    next(err);
  }
};
