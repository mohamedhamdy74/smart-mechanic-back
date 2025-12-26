const User = require('../models/User');
const Product = require('../models/Product');

exports.getCart = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).populate('cart.productId');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const items = (user.cart || []).map((c) => ({
      id: c._id,
      productId: c.productId?._id || null,
      name: c.productId?.name || c.productId?.nameAr || 'Unknown',
      price: c.productId?.price || 0,
      quantity: c.quantity || 1,
      images: c.productId?.images || [],
    }));

    res.json({ items });
  } catch (err) {
    next(err);
  }
};

exports.addItem = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { productId, quantity = 1 } = req.body;

    if (!productId) return res.status(400).json({ message: 'productId is required' });

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Find existing item
    const existing = user.cart.find((c) => c.productId?.toString() === productId.toString());

    if (existing) {
      const newQuantity = (existing.quantity || 0) + Number(quantity);
      if (newQuantity <= 0) {
        // Remove item if quantity matches 0 or less
        user.cart.pull(existing._id);
      } else {
        existing.quantity = newQuantity;
      }
    } else {
      if (Number(quantity) > 0) {
        user.cart.push({ productId, quantity: Number(quantity) });
      }
    }

    await user.save();

    res.json({ message: 'Item added to cart' });
  } catch (err) {
    next(err);
  }
};

exports.clearCart = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.cart = [];
    await user.save();

    res.json({ message: 'Cart cleared' });
  } catch (err) {
    next(err);
  }
};
