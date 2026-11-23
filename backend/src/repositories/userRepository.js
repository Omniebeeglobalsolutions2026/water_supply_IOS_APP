const User = require('../models/User');
const Order = require('../models/Order');
const PaymentAttempt = require('../models/PaymentAttempt');

const userRepository = {
  findByEmail(email, { includePasswordHash = false } = {}) {
    const query = User.findOne({ email });
    return includePasswordHash ? query.select('+passwordHash') : query;
  },

  findById(id) {
    return User.findById(id).select('_id name phone email businessName role approvalStatus');
  },

  updateUser(id, updates) {
    return User.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('_id name phone email businessName role approvalStatus');
  },

  create(userData) {
    return User.create(userData);
  },

  async findVendors(approvalStatus, { skip, limit }) {
    const filter = { role: 'vendor' };
    if (approvalStatus === 'pending') {
      filter.$or = [{ approvalStatus }, { approvalStatus: { $exists: false } }];
    } else if (approvalStatus !== 'all') {
      filter.approvalStatus = approvalStatus;
    }
    const [vendors, total] = await Promise.all([
      User.find(filter)
        .select('_id name phone email businessName approvalStatus createdAt')
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);
    return { vendors, total };
  },

  updateVendorApproval(id, approvalStatus) {
    return User.findOneAndUpdate(
      { _id: id, role: 'vendor' },
      { $set: { approvalStatus } },
      { new: true, runValidators: true }
    ).select('_id name phone email businessName approvalStatus createdAt');
  },

  ensureIndexes() {
    return Promise.all([User.createIndexes(), Order.createIndexes(), PaymentAttempt.createIndexes()]);
  },
};

module.exports = userRepository;