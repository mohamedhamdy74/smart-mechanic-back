const Car = require("../models/Car");
const { validationResult } = require("express-validator");

exports.getAllCars = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    let query = {};
    if (req.user.role !== 'admin') {
      query.userId = req.user.id;
    }
    const cars = await Car.find(query)
      .skip((page - 1) * limit)
      .limit(Number(limit));
    const count = await Car.countDocuments(query);
    res.json({
      cars,
      total: count,
      page: Number(page),
      pages: Math.ceil(count / limit),
    });
  } catch (err) {
    next(err);
  }
};

exports.getCarById = async (req, res, next) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) return res.status(404).json({ message: "Car not found" });
    if (car.userId.toString() !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ message: "Forbidden" });
    res.json(car);
  } catch (err) {
    next(err);
  }
};

exports.createCar = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });
    const images = req.files ? req.files.map(file => file.path) : [];
    const car = new Car({ ...req.body, userId: req.user.id, images });
    await car.save();
    res.status(201).json(car);
  } catch (err) {
    next(err);
  }
};

exports.updateCar = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });
    const car = await Car.findById(req.params.id);
    if (!car) return res.status(404).json({ message: "Car not found" });
    if (car.userId.toString() !== req.user.id) return res.status(403).json({ message: "Forbidden" });
    const newImages = req.files ? req.files.map(file => file.path) : [];
    const updatedImages = [...(car.images || []), ...newImages];
    Object.assign(car, req.body, { images: updatedImages });
    await car.save();
    res.json(car);
  } catch (err) {
    next(err);
  }
};

exports.deleteCar = async (req, res, next) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) return res.status(404).json({ message: "Car not found" });
    if (car.userId.toString() !== req.user.id) return res.status(403).json({ message: "Forbidden" });
    await Car.findByIdAndDelete(req.params.id);
    res.json({ message: "Car deleted" });
  } catch (err) {
    next(err);
  }
};
