const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    businessName: { type: String, trim: true, maxlength: 100 },
    vendorRadiusKm: { type: Number, enum: [2, 5, 10] },
    vendorServiceType: { type: String, enum: ['water_tanker', 'other'] },
    workMode: { type: Boolean, default: true },
    pushTokens: { type: [String], default: [], select: false },
    bankDetails: {
      bankName: { type: String, trim: true, maxlength: 100 },
      branch: { type: String, trim: true, maxlength: 100 },
      holderName: { type: String, trim: true, maxlength: 100 },
      accountNumber: { type: String, trim: true, maxlength: 34 },
      ifscCode: { type: String, trim: true, uppercase: true, maxlength: 11 },
    },
    onboardingDocuments: {
      govtIdProof: {
        name: { type: String, trim: true, maxlength: 120 },
        mimeType: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp'] },
        data: { type: String, maxlength: 1250000, select: false },
      },
      bankPassbook: {
        name: { type: String, trim: true, maxlength: 120 },
        mimeType: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp'] },
        data: { type: String, maxlength: 1250000, select: false },
      },
    },
    vendorLocation: {
      type: {
        type: String,
        enum: ['Point'],
        required: function () {
          return this.role === 'vendor';
        },
      },
      coordinates: {
        type: [Number],
        required: function () {
          return this.role === 'vendor';
        },
        validate: {
          validator: (coordinates) => {
            if (!coordinates && this.role !== 'vendor') return true;
            return Array.isArray(coordinates)
              && coordinates.length === 2
              && coordinates.every(Number.isFinite)
              && coordinates[0] >= -180
              && coordinates[0] <= 180
              && coordinates[1] >= -90
              && coordinates[1] <= 90;
          },
          message: 'Vendor location must contain valid longitude and latitude coordinates.',
        },
      },
      address: { type: String, trim: true, maxlength: 300 },
    },
    inventory: [{
      name: { type: String, required: true, trim: true, minlength: 1, maxlength: 60 },
      capacityLiters: { type: Number, required: true, min: 1, max: 1000000 },
      waterSource: { type: String, enum: ['bore', 'well', 'lake', 'rain'] },
      price: { type: Number, required: true, min: 0, max: 10000000 },
      available: { type: Boolean, default: true },
    }],
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'vendor', 'admin'], default: 'user', required: true },
    approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', required: true },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true, name: 'email_1' });
userSchema.index({ vendorLocation: '2dsphere' }, { name: 'vendor_location_2dsphere' });

module.exports = mongoose.model('User', userSchema);