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

const vendorRequestSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vendorName: { type: String, required: true, trim: true, maxlength: 100 },
  tankId: { type: mongoose.Schema.Types.ObjectId, required: true },
  distanceKm: { type: Number, required: true, min: 0, max: 10 },
  vendorPrice: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['sent', 'accepted', 'rejected', 'expired', 'cancelled'], required: true },
  sentAt: { type: Date, required: true },
  respondedAt: { type: Date },
  expiresAt: { type: Date, required: true },
  response: { type: String, trim: true, maxlength: 300 },
});

const orderSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    vendorName: { type: String, trim: true, maxlength: 100 },
    tankId: { type: mongoose.Schema.Types.ObjectId },
    tankName: { type: String, required: true, trim: true, maxlength: 60 },
    capacityLiters: { type: Number, required: true, min: 1 },
    waterSource: { type: String, enum: ['bore', 'well', 'lake', 'rain'] },
    amount: { type: Number, required: true, min: 0 },
    displayedPrice: { type: Number, min: 0 },
    deliveryCoordinates: {
      type: { type: String, enum: ['Point'] },
      coordinates: {
        type: [Number],
        validate: {
          validator: (coordinates) => coordinates.length === 2
            && coordinates.every(Number.isFinite)
            && coordinates[0] >= -180
            && coordinates[0] <= 180
            && coordinates[1] >= -90
            && coordinates[1] <= 90,
          message: 'Delivery coordinates must contain valid longitude and latitude.',
        },
      },
    },
    eligibleVendors: { type: [vendorCandidateSchema], default: [] },
    vendorRequests: { type: [vendorRequestSchema], default: [] },
    currentVendorRequestId: { type: mongoose.Schema.Types.ObjectId },
    currentVendorRequestExpiresAt: { type: Date },
    nextVendorIndex: { type: Number, default: 0, min: 0 },
    assignmentState: { type: String, enum: ['ready', 'waiting', 'done'] },
    assignmentLockToken: { type: String },
    assignmentLockUntil: { type: Date },
    refundReceipt: { type: String },
    refundLockToken: { type: String },
    refundLockUntil: { type: Date },
    razorpayRefundId: { type: String },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'refund_pending', 'refunded'], default: 'pending' },
    razorpayOrderId: { type: String, sparse: true, unique: true },
    razorpayPaymentId: { type: String },
    deliveryAddress: { type: String, required: true, trim: true, maxlength: 500 },
    deliveryDate: { type: String, required: true, trim: true, maxlength: 40 },
    deliveryTime: { type: String, required: true, trim: true, maxlength: 60 },
    status: {
      type: String,
      enum: ['pending', 'waiting_for_vendor', 'approved', 'rejected', 'completed', 'cancelled', 'no_vendor_available'],
      default: 'pending',
      index: true,
    },
  },
  { timestamps: true }
);

orderSchema.index({ vendor: 1, createdAt: -1 });
orderSchema.index({ status: 1, assignmentState: 1, currentVendorRequestExpiresAt: 1, assignmentLockUntil: 1 });
orderSchema.index({ status: 1, paymentStatus: 1, refundLockUntil: 1 });

module.exports = mongoose.model('Order', orderSchema);
