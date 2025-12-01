const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { authenticate, authorize } = require('../middlewares/auth');

// All cart routes require authentication as client
router.get('/', authenticate, authorize('client'), cartController.getCart);
router.post('/add', authenticate, authorize('client'), cartController.addItem);
router.post('/clear', authenticate, authorize('client'), cartController.clearCart);

module.exports = router;
