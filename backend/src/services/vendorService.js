const mongoose = require('mongoose');
const AppError = require('../errors/AppError');
const User = require('../models/User');
const Order = require('../models/Order');
const PlatformSetting = require('../models/PlatformSetting');
const logger = require('../config/logger');
const pushNotificationService = require('./pushNotificationService').createPushNotificationService();
const defaultAssignmentService = require('./vendorAssignmentService');

const defaultNearbyRadiusKm = 10;

function createVendorService({
  users = User,
  orders = Order,
  settings = PlatformSetting,
  notifications = pushNotificationService,
  assignments = defaultAssignmentService,
} = {}) {
  async function getProfile(vendorId) {
    const vendor = await users.findOne({ _id: vendorId, role: 'vendor' })
      .select('_id name phone email businessName approvalStatus vendorLocation vendorRadiusKm vendorServiceType bankDetails workMode inventory')
      .lean();
    if (!vendor) throw new AppError(404, 'Vendor account was not found.', 'VENDOR_NOT_FOUND');
    return vendor;
  }

  async function updateLocation(vendorId, input = {}) {
    const address = typeof input.address === 'string' ? input.address.trim() : '';
    const latitude = Number(input.latitude);
    const longitude = Number(input.longitude);
    if (address.length < 3 || address.length > 300
      || !Number.isFinite(latitude) || latitude < -90 || latitude > 90
      || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new AppError(400, 'Choose a valid business address and map location.', 'INVALID_VENDOR_LOCATION');
    }

    const vendor = await users.findOneAndUpdate(
      { _id: vendorId, role: 'vendor' },
      { $set: { vendorLocation: { type: 'Point', coordinates: [longitude, latitude], address } } },
      { new: true, runValidators: true }
    ).select('_id vendorLocation');
    if (!vendor) throw new AppError(404, 'Vendor account was not found.', 'VENDOR_NOT_FOUND');
    return vendor.vendorLocation;
  }

  async function addTank(vendorId, input = {}) {
    const tank = validateTank(input);
    const result = await users.updateOne(
      { _id: vendorId, role: 'vendor' },
      { $push: { inventory: tank } },
      { runValidators: true }
    );
    if (result.matchedCount !== 1) throw new AppError(404, 'Vendor account was not found.', 'VENDOR_NOT_FOUND');
    return getProfile(vendorId);
  }

  async function updateTank(vendorId, tankId, input = {}) {
    const tank = validateTank(input);
    const result = await users.updateOne(
      { _id: vendorId, role: 'vendor', 'inventory._id': tankId },
      {
        $set: {
          'inventory.$.name': tank.name,
          'inventory.$.capacityLiters': tank.capacityLiters,
          'inventory.$.waterSource': tank.waterSource,
          'inventory.$.price': tank.price,
          'inventory.$.available': tank.available,
        },
      },
      { runValidators: true }
    );
    if (result.matchedCount !== 1) throw new AppError(404, 'Tank listing was not found.', 'TANK_NOT_FOUND');
    return getProfile(vendorId);
  }

  async function deleteTank(vendorId, tankId) {
    const result = await users.updateOne(
      { _id: vendorId, role: 'vendor' },
      { $pull: { inventory: { _id: tankId } } }
    );
    if (result.matchedCount !== 1) throw new AppError(404, 'Vendor account was not found.', 'VENDOR_NOT_FOUND');
    if (result.modifiedCount !== 1) throw new AppError(404, 'Tank listing was not found.', 'TANK_NOT_FOUND');
  }

  async function setWorkMode(vendorId, input = {}) {
    if (typeof input.enabled !== 'boolean') {
      throw new AppError(400, 'Work mode must be enabled or disabled.', 'INVALID_WORK_MODE');
    }
    const vendor = await users.findOneAndUpdate(
      { _id: vendorId, role: 'vendor' },
      { $set: { workMode: input.enabled } },
      { new: true, runValidators: true }
    ).select('_id workMode');
    if (!vendor) throw new AppError(404, 'Vendor account was not found.', 'VENDOR_NOT_FOUND');
    return vendor.workMode;
  }

  async function createOrder(customerId, input = {}) {
    const vendorId = typeof input.vendorId === 'string' ? input.vendorId : '';
    const tankId = typeof input.tankId === 'string' ? input.tankId : '';
    const deliveryAddress = typeof input.deliveryAddress === 'string' ? input.deliveryAddress.trim() : '';
    const deliveryDate = typeof input.deliveryDate === 'string' ? input.deliveryDate.trim() : '';
    const deliveryTime = typeof input.deliveryTime === 'string' ? input.deliveryTime.trim() : '';
    if (!mongoose.Types.ObjectId.isValid(vendorId) || !mongoose.Types.ObjectId.isValid(tankId)) {
      throw new AppError(400, 'Choose a valid vendor and tank listing.', 'INVALID_ORDER_SELECTION');
    }
    if (deliveryAddress.length < 5 || deliveryAddress.length > 500
      || deliveryDate.length < 1 || deliveryDate.length > 40
      || deliveryTime.length < 1 || deliveryTime.length > 60) {
      throw new AppError(400, 'Enter a valid delivery address, date, and time.', 'INVALID_DELIVERY_DETAILS');
    }
    const vendor = await users.findOne({
      _id: vendorId,
      role: 'vendor',
      approvalStatus: 'approved',
      workMode: { $ne: false },
      inventory: { $elemMatch: { _id: tankId, available: { $ne: false } } },
    }).select('_id inventory');
    if (!vendor) {
      throw new AppError(409, 'This vendor or tank is no longer available. Refresh nearby offers and choose another.', 'OFFER_UNAVAILABLE');
    }
    const tank = vendor.inventory.id(tankId);
    if (!tank || tank.available === false) {
      throw new AppError(409, 'This tank is no longer available. Choose another listing.', 'OFFER_UNAVAILABLE');
    }
    const order = await orders.create({
      customer: customerId,
      vendor: vendor._id,
      tankId: tank._id,
      tankName: tank.name,
      capacityLiters: tank.capacityLiters,
      waterSource: tank.waterSource,
      amount: tank.price,
      deliveryAddress,
      deliveryDate,
      deliveryTime,
    });
    const populatedOrder = await orders.findById(order._id).populate('customer', 'name phone email').lean();
    Promise.resolve()
      .then(() => notifications.notifyVendorOrderCreated(vendor._id, populatedOrder))
      .catch((error) => logger.warn({ err: error, vendorId: String(vendor._id) }, 'Unable to queue vendor order notification'));
    return serializeOrder(populatedOrder);
  }

  async function listOrders(vendorId, input = {}) {
    const allowedStatuses = new Set(['all', 'pending', 'waiting_for_vendor', 'approved', 'rejected', 'completed', 'cancelled', 'no_vendor_available']);
    const status = input.status || 'all';
    if (!allowedStatuses.has(status)) throw new AppError(400, 'Choose a valid order status.', 'INVALID_ORDER_STATUS');
    const filter = { vendor: vendorId };
    if (status === 'pending') filter.status = { $in: ['pending', 'waiting_for_vendor'] };
    else if (status !== 'all') filter.status = status;
    const items = await orders.find(filter)
      .populate('customer', 'name phone email')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return items.map(serializeOrder);
  }

  async function listCustomerOrders(customerId) {
    const items = await orders.find({ customer: customerId })
      .populate('vendor', 'businessName name')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return items.map(serializeOrder);
  }

  async function cancelCustomerOrder(customerId, orderId) {
    return assignments.cancelOrder(customerId, orderId);
  }

  async function updateOrderStatus(vendorId, orderId, input = {}) {
    if (!['approved', 'rejected', 'completed'].includes(input.status)) {
      throw new AppError(400, 'Choose approve, reject, or complete for this order.', 'INVALID_ORDER_STATUS');
    }
    const assignmentOrder = input.status === 'completed'
      ? null
      : await orders.findOne({
        _id: orderId,
        vendor: vendorId,
        status: 'waiting_for_vendor',
        currentVendorRequestId: input.requestId,
      }).lean();
    if (assignmentOrder) {
      return assignments.respondToRequest(vendorId, orderId, input);
    }

    const allowedPrevious = input.status === 'completed' ? 'approved' : 'pending';
    const order = await orders.findOneAndUpdate(
      { _id: orderId, vendor: vendorId, status: allowedPrevious },
      { $set: { status: input.status } },
      { new: true }
    ).populate('customer', 'name phone email').lean();
    if (order) return serializeOrder(order);
    const existing = await orders.exists({ _id: orderId, vendor: vendorId });
    if (!existing) throw new AppError(404, 'Order was not found.', 'ORDER_NOT_FOUND');
    throw new AppError(409, 'This order has already changed and cannot be updated with that action.', 'ORDER_STATUS_CONFLICT');
  }

  async function getDashboard(vendorId, input = {}) {
    const period = input.period || 'monthly';
    if (!['daily', 'weekly', 'monthly'].includes(period)) {
      throw new AppError(400, 'Choose daily, weekly, or monthly earnings.', 'INVALID_EARNINGS_PERIOD');
    }
    const now = new Date();
    const start = new Date(now);
    if (period === 'daily') {
      start.setHours(0, 0, 0, 0);
    } else if (period === 'weekly') {
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
    } else {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    }

    const [ordersInPeriod, allOrders] = await Promise.all([
      orders.find({ vendor: vendorId, createdAt: { $gte: start } }).lean(),
      orders.find({ vendor: vendorId }).select('status amount paymentStatus').lean(),
    ]);
    const completed = ordersInPeriod.filter((order) => order.status === 'completed');
    const grossEarning = completed.reduce((sum, order) => sum + (Number(order.amount) || 0), 0);
    const totalOrders = ordersInPeriod.length;
    const settledAmount = completed
      .filter((order) => order.paymentStatus === 'paid')
      .reduce((sum, order) => sum + (Number(order.amount) || 0), 0);

    return {
      period,
      grossEarning,
      serviceFee: 0,
      netEarning: grossEarning,
      totalOrders,
      settledAmount,
      pendingSettlement: Math.max(0, grossEarning - settledAmount),
      allTimeOrders: allOrders.length,
      orders: ordersInPeriod.sort((a, b) => b.createdAt - a.createdAt).slice(0, 20).map(serializeOrder),
    };
  }

  async function findNearby(input = {}) {
    const latitude = Number(input.latitude);
    const longitude = Number(input.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
      || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new AppError(400, 'Enter a valid delivery location.', 'INVALID_COORDINATES');
    }

    const setting = await settings.findOne({ key: 'nearby_search_radius_km' }).select('value').lean();
    const configuredRadiusKm = setting?.value ?? defaultNearbyRadiusKm;
    if (!Number.isFinite(configuredRadiusKm) || configuredRadiusKm < 1 || configuredRadiusKm > 100) {
      throw new AppError(500, 'The nearby search radius setting is invalid.', 'INVALID_NEARBY_RADIUS_SETTING');
    }
    const radiusKm = Math.min(configuredRadiusKm, defaultNearbyRadiusKm);

    const listings = await users.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [longitude, latitude] },
          distanceField: 'distanceMeters',
          maxDistance: radiusKm * 1000,
          spherical: true,
          query: { role: 'vendor', approvalStatus: 'approved', workMode: { $ne: false } },
        },
      },
      { $unwind: '$inventory' },
      { $match: { 'inventory.available': { $ne: false } } },
      { $sort: { distanceMeters: 1, 'inventory.price': 1 } },
      {
        $project: {
          _id: 0,
          vendorId: { $toString: '$_id' },
          vendorName: { $ifNull: ['$businessName', '$name'] },
          businessName: '$businessName',
          vendorAddress: '$vendorLocation.address',
          distanceKm: { $divide: ['$distanceMeters', 1000] },
          tank: {
            id: { $toString: '$inventory._id' },
            name: '$inventory.name',
            capacityLiters: '$inventory.capacityLiters',
            waterSource: '$inventory.waterSource',
            price: '$inventory.price',
          },
        },
      },
    ]);
    const variants = new Map();
    const vendorListings = new Map();
    listings.forEach((listing) => {
      const capacityLiters = Number(listing.tank.capacityLiters);
      if (!Number.isFinite(capacityLiters) || !Number.isFinite(listing.tank.price)) return;
      const vendorKey = `${capacityLiters}:${listing.vendorId}`;
      const candidate = {
        vendorId: listing.vendorId,
        vendorName: listing.vendorName,
        vendorAddress: listing.vendorAddress || '',
        tankId: listing.tank.id,
        tankName: listing.tank.name,
        capacityLiters,
        waterSource: listing.tank.waterSource,
        price: Number(listing.tank.price),
        distanceKm: Number(listing.distanceKm),
      };
      const existingVendorListing = vendorListings.get(vendorKey);
      if (!existingVendorListing || candidate.price > existingVendorListing.price) {
        vendorListings.set(vendorKey, candidate);
      }
    });

    for (const candidate of vendorListings.values()) {
      const existingVariant = variants.get(candidate.capacityLiters) || {
        capacityLiters: candidate.capacityLiters,
        name: candidate.tankName,
        displayedPrice: candidate.price,
        vendors: [],
      };
      existingVariant.displayedPrice = Math.max(existingVariant.displayedPrice, candidate.price);
      existingVariant.vendors.push(candidate);
      variants.set(candidate.capacityLiters, existingVariant);
    }

    return [...variants.values()]
      .map((variant) => ({
        ...variant,
        vendors: variant.vendors.sort((left, right) => left.distanceKm - right.distanceKm),
      }))
      .sort((left, right) => left.capacityLiters - right.capacityLiters);
  }

  return {
    getProfile, updateLocation, addTank, updateTank, deleteTank, findNearby,
    setWorkMode, createOrder, listOrders, listCustomerOrders, cancelCustomerOrder, updateOrderStatus, getDashboard,
  };
}

function serializeOrder(order) {
  const customer = order.customer && typeof order.customer === 'object'
    ? order.customer
    : null;
  const vendorName = order.vendor && typeof order.vendor === 'object'
    ? order.vendor.businessName || order.vendor.name || 'Vendor'
    : order.vendorName || (order.status === 'waiting_for_vendor' ? 'Finding a vendor' : 'Vendor');
  return {
    id: String(order._id),
    customer: customer?.name || 'Customer',
    customerPhone: customer?.phone || '',
    vendor: vendorName,
    vendorName,
    vendorId: order.vendor?._id ? String(order.vendor._id) : order.vendor ? String(order.vendor) : null,
    tank: order.tankName,
    tankName: order.tankName,
    capacityLiters: order.capacityLiters,
    waterSource: order.waterSource,
    amount: order.amount,
    location: order.deliveryAddress,
    deliveryAddress: order.deliveryAddress,
    date: order.deliveryDate,
    deliveryDate: order.deliveryDate,
    time: order.deliveryTime,
    deliveryTime: order.deliveryTime,
    status: order.status,
    paymentStatus: order.paymentStatus,
    createdAt: order.createdAt,
    currentVendorRequestId: order.currentVendorRequestId ? String(order.currentVendorRequestId) : null,
    vendorResponseDeadline: order.currentVendorRequestExpiresAt || null,
    vendorRequests: (order.vendorRequests || []).map((request) => ({
      vendor: request.vendorName,
      distanceKm: request.distanceKm,
      status: request.status,
      sentAt: request.sentAt,
      respondedAt: request.respondedAt || null,
      expiresAt: request.expiresAt,
      response: request.response || '',
    })),
  };
}

function validateTank(input) {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const capacityLiters = Number(input.capacityLiters);
  const price = Number(input.price);
  const waterSource = typeof input.waterSource === 'string' ? input.waterSource.trim().toLowerCase() : '';
  const available = input.available === undefined ? true : input.available;
  if (name.length < 1 || name.length > 60
    || !Number.isFinite(capacityLiters) || capacityLiters < 1 || capacityLiters > 1000000
    || !Number.isFinite(price) || price < 0 || price > 10000000
    || !['bore', 'well', 'lake', 'rain'].includes(waterSource)
    || typeof available !== 'boolean') {
    throw new AppError(400, 'Enter a valid tank capacity, water source, price, and availability.', 'INVALID_TANK');
  }
  return { name, capacityLiters, waterSource, price, available };
}

const vendorService = createVendorService();
vendorService.createVendorService = createVendorService;
module.exports = vendorService;
