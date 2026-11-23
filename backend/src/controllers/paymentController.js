const { createPaymentService } = require('../services/paymentService');

const paymentService = createPaymentService();

async function createRazorpayOrder(req, res, next) {
  try {
    const checkout = await paymentService.createCheckoutOrder(req.user, req.body || {});
    return res.status(201).json(checkout);
  } catch (error) {
    return next(error);
  }
}

async function verifyRazorpayPayment(req, res, next) {
  try {
    const result = await paymentService.verifyAndCompletePayment(req.user._id, req.body || {});
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function razorpayWebhook(req, res, next) {
  try {
    const result = await paymentService.handleWebhook(
      req.body,
      req.get('x-razorpay-signature')
    );
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

module.exports = { createRazorpayOrder, verifyRazorpayPayment, razorpayWebhook, paymentService };
