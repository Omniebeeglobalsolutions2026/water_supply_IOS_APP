const mongoose = require('mongoose');
const AppError = require('../errors/AppError');
const vendorService = require('../services/vendorService');
const pushNotificationService = require('../services/pushNotificationService').createPushNotificationService();

function formatInventory(inventory = []) {
  return inventory.map((tank) => ({
    id: String(tank._id || tank.id),
    name: tank.name,
    capacityLiters: tank.capacityLiters,
    waterSource: tank.waterSource,
    price: tank.price,
    available: tank.available !== false,
  }));
}

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
}

const getProfile = asyncHandler(async (req, res) => {
  const vendor = await vendorService.getProfile(req.user._id);
  return res.json({
    vendor: {
      id: String(vendor._id),
      name: vendor.name,
      phone: vendor.phone,
      email: vendor.email,
      businessName: vendor.businessName,
      approvalStatus: vendor.approvalStatus,
      workMode: vendor.workMode !== false,
      radiusKm: vendor.vendorRadiusKm || null,
      serviceType: vendor.vendorServiceType || null,
      bankDetails: vendor.bankDetails || {},
      location: vendor.vendorLocation || null,
      inventory: formatInventory(vendor.inventory),
    },
  });
});

const registerPushToken = asyncHandler(async (req, res) => {
  const result = await pushNotificationService.registerVendorToken(req.user._id, req.body);
  return res.json(result);
});

const unregisterPushToken = asyncHandler(async (req, res) => {
  const result = await pushNotificationService.unregisterVendorToken(req.user._id, req.body);
  return res.json(result);
});

const registerCustomerPushToken = asyncHandler(async (req, res) => {
  const result = await pushNotificationService.registerCustomerToken(req.user._id, req.body);
  return res.json(result);
});

const unregisterCustomerPushToken = asyncHandler(async (req, res) => {
  const result = await pushNotificationService.unregisterCustomerToken(req.user._id, req.body);
  return res.json(result);
});

const updateLocation = asyncHandler(async (req, res) => {
  const location = await vendorService.updateLocation(req.user._id, req.body);
  return res.json({ location });
});

const addTank = asyncHandler(async (req, res) => {
  const vendor = await vendorService.addTank(req.user._id, req.body);
  return res.status(201).json({ inventory: formatInventory(vendor.inventory) });
});

const updateTank = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.tankId)) {
    throw new AppError(400, 'Invalid tank ID.', 'INVALID_TANK_ID');
  }
  const vendor = await vendorService.updateTank(req.user._id, req.params.tankId, req.body);
  return res.json({ inventory: formatInventory(vendor.inventory) });
});

const deleteTank = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.tankId)) {
    throw new AppError(400, 'Invalid tank ID.', 'INVALID_TANK_ID');
  }
  await vendorService.deleteTank(req.user._id, req.params.tankId);
  return res.status(204).end();
});

const findNearby = asyncHandler(async (req, res) => {
  const offers = (await vendorService.findNearby(req.query)).map(({ vendors, ...offer }) => ({
    ...offer,
    vendorsCount: vendors.length,
  }));
  return res.json({ offers });
});

const setWorkMode = asyncHandler(async (req, res) => {
  const enabled = await vendorService.setWorkMode(req.user._id, req.body);
  return res.json({ workMode: enabled });
});

const createOrder = asyncHandler(async (req, res) => {
  const order = await vendorService.createOrder(req.user._id, req.body);
  return res.status(201).json({ order });
});

const listOrders = asyncHandler(async (req, res) => {
  const orders = await vendorService.listOrders(req.user._id, req.query);
  return res.json({ orders });
});

const listCustomerOrders = asyncHandler(async (req, res) => {
  const orders = await vendorService.listCustomerOrders(req.user._id);
  return res.json({ orders });
});

const cancelCustomerOrder = asyncHandler(async (req, res) => {
  const order = await vendorService.cancelCustomerOrder(req.user._id, req.params.orderId);
  return res.json({ order });
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await vendorService.updateOrderStatus(req.user._id, req.params.orderId, req.body);
  return res.json({ order });
});

const getDashboard = asyncHandler(async (req, res) => {
  const dashboard = await vendorService.getDashboard(req.user._id, req.query);
  return res.json({ dashboard });
});

module.exports = {
  getProfile, updateLocation, addTank, updateTank, deleteTank, findNearby,
  registerPushToken, unregisterPushToken, registerCustomerPushToken, unregisterCustomerPushToken,
  setWorkMode, createOrder, listOrders, listCustomerOrders, cancelCustomerOrder, updateOrderStatus, getDashboard,
};
