const Product = require("../models/Product");
const { validationResult } = require("express-validator");

exports.getAllProducts = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, workshopId, category, inStock, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    let query = {};

    // If workshopId is provided, filter products by workshop
    if (workshopId) {
      query.userId = workshopId;
    }

    // Filter by category if provided
    if (category) {
      query.category = category;
    }

    // Filter by stock status if provided
    if (inStock !== undefined) {
      query.inStock = inStock === 'true';
    }

    // Text search in product name
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    // Build sort object
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // ✅ Use Promise.all for parallel execution to reduce fetch time
    const [products, count] = await Promise.all([
      Product.find(query)
        .populate('userId', 'workshopName name') // Get workshop info
        .sort(sortOptions)
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(), // Use lean() for better performance
      Product.countDocuments(query)
    ]);

    res.json({
      products,
      total: count,
      page: Number(page),
      pages: Math.ceil(count / limit),
    });
  } catch (err) {
    next(err);
  }
};

exports.getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    next(err);
  }
};

exports.createProduct = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });
    const images = req.files ? req.files.map(file => file.path) : [];
    const product = new Product({ ...req.body, userId: req.user.id, images });
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
};

exports.updateProduct = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (product.userId.toString() !== req.user.id) return res.status(403).json({ message: "Forbidden" });
    const newImages = req.files ? req.files.map(file => file.path) : [];
    const updatedImages = [...(product.images || []), ...newImages];
    Object.assign(product, req.body, { images: updatedImages });
    await product.save();
    res.json(product);
  } catch (err) {
    next(err);
  }
};

exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (product.userId.toString() !== req.user.id) return res.status(403).json({ message: "Forbidden" });
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Product deleted" });
  } catch (err) {
    next(err);
  }
};
