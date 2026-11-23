const express = require('express');
const authenticate = require('../middleware/authenticate');
const paymentController = require('../controllers/paymentController');

const router = express.Router();
const requireCustomer = [authenticate, authenticate.requireRole('user')];

router.post('/razorpay/orders', ...requireCustomer, paymentController.createRazorpayOrder);
router.post('/razorpay/verify', ...requireCustomer, paymentController.verifyRazorpayPayment);
router.post('/razorpay/webhook', paymentController.razorpayWebhook);

module.exports = router;
