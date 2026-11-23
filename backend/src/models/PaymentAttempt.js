const mongoose = require('mongoose');

const vendorCandidateSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vendorName: { type: String, required: true, trim: true, maxlength: 100 },
  tankId: { type: mongoose.Schema.Types.ObjectId, required: true },
  tankName: { type: String, required: true, trim: true, maxlength: 60 },
  capacityLiters: { type: Number, required: true, min: 1 },
  waterSource: { type: String, enum: ['bore', 'well', 'lake', 'rain'] },
  price: { type: Number, required: true, min: 0 },
  distanceKm: { type: Number, required: true, min: 0, max: 10 },
});

const paymentAttemptSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    tankId: { type: mongoose.Schema.Types.ObjectId },
    tankName: { type: String, required: true, trim: true, maxlength: 60 },
    capacityLiters: { type: Number, required: true, min: 1 },
    waterSource: { type: String, enum: ['bore', 'well', 'lake', 'rain'] },
    vendorName: { type: String, required: true, trim: true, maxlength: 100 },
    deliveryAddress: { type: String, required: true, trim: true, maxlength: 500 },
    deliveryDate: { type: String, required: true, trim: true, maxlength: 40 },
    deliveryTime: { type: String, required: true, trim: true, maxlength: 60 },
    deliveryCoordinates: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number], required: true },
    },
    displayedPrice: { type: Number, required: true, min: 0 },
    eligibleVendors: { type: [vendorCandidateSchema], default: [] },
    amount: { type: Number, required: true, min: 0 },
    razorpayOrderId: { type: String, required: true, unique: true },
    razorpayPaymentId: { type: String },
    razorpayRefundId: { type: String },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    status: { type: String, enum: ['created', 'paid', 'refund_pending', 'refunded', 'failed'], default: 'created' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PaymentAttempt', paymentAttemptSchema);
