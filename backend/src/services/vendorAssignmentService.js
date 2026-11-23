const crypto = require('node:crypto');
const mongoose = require('mongoose');
const AppError = require('../errors/AppError');
const User = require('../models/User');
const Order = require('../models/Order');
const logger = require('../config/logger');
const pushNotificationService = require('./pushNotificationService').createPushNotificationService();

const responseWindowMs = 30 * 60 * 1000;
const assignmentLeaseMs = 60 * 1000;
const maximumRadiusKm = 10;

function createVendorAssignmentService({
  users = User,
  orders = Order,
  notifications = pushNotificationService,
  now = () => new Date(),
  loggerImpl = logger,
} = {}) {
  let noVendorAvailableHandler = async () => {};

  function setNoVendorAvailableHandler(handler) {
    noVendorAvailableHandler = typeof handler === 'function' ? handler : async () => {};
  }

  async function notify(method, ...args) {
    if (typeof notifications[method] !== 'function') return;
    try {
      await notifications[method](...args);
    } catch (error) {
      loggerImpl.warn({ err: error, method }, 'Unable to send booking assignment notification');
    }
  }

  async function startAssignment(orderId) {
    await processOrder(orderId);
    return getOrder(orderId);
  }

  async function processOrder(orderId) {
    const currentTime = now();
    const lockToken = crypto.randomUUID();
    const order = await orders.findOneAndUpdate(
      {
        _id: orderId,
        status: 'waiting_for_vendor',
        $and: [
          {
            $or: [
              { assignmentLockUntil: { $exists: false } },
              { assignmentLockUntil: null },
              { assignmentLockUntil: { $lte: currentTime } },
            ],
          },
          {
            $or: [
              { assignmentState: 'ready' },
              {
                assignmentState: 'waiting',
                currentVendorRequestExpiresAt: { $lte: currentTime },
              },
            ],
          },
        ],
      },
      {
        $set: {
          assignmentLockToken: lockToken,
          assignmentLockUntil: new Date(currentTime.getTime() + assignmentLeaseMs),
        },
      },
      { new: true }
    ).lean();
    if (!order) return null;

    if (order.currentVendorRequestId) {
      const expiredRequest = await orders.updateOne(
        {
          _id: order._id,
          assignmentLockToken: lockToken,
          currentVendorRequestId: order.currentVendorRequestId,
          currentVendorRequestExpiresAt: { $lte: currentTime },
        },
        {
          $set: {
            'vendorRequests.$[request].status': 'expired',
            'vendorRequests.$[request].respondedAt': currentTime,
            'vendorRequests.$[request].response': 'No response before the 30-minute deadline.',
            currentVendorRequestId: null,
            currentVendorRequestExpiresAt: null,
            assignmentState: 'ready',
          },
        },
        { arrayFilters: [{ 'request._id': order.currentVendorRequestId, 'request.status': 'sent' }] }
      );
      if (expiredRequest.modifiedCount === 1) {
        const request = order.vendorRequests.find(
          (item) => String(item._id) === String(order.currentVendorRequestId)
        );
        if (request) {
          await notify('notifyVendorOrderExpired', request.vendor, order);
        }
      }
    }

    const latestOrder = await getOrder(order._id);
    if (!latestOrder || latestOrder.assignmentLockToken !== lockToken) return null;

    let candidateIndex = Number(latestOrder.nextVendorIndex) || 0;
    const consideredVendors = new Set(
      latestOrder.vendorRequests.map((request) => String(request.vendor))
    );
    while (candidateIndex < latestOrder.eligibleVendors.length) {
      const candidate = latestOrder.eligibleVendors[candidateIndex];
      candidateIndex += 1;
      const candidateVendorId = String(candidate.vendor);
      if (consideredVendors.has(candidateVendorId)) {
        await orders.updateOne(
          { _id: latestOrder._id, assignmentLockToken: lockToken },
          { $set: { nextVendorIndex: candidateIndex } }
        );
        continue;
      }
      consideredVendors.add(candidateVendorId);
      const eligible = await getEligibleVendor(candidate, latestOrder);
      if (!eligible) {
        await orders.updateOne(
          { _id: latestOrder._id, assignmentLockToken: lockToken },
          { $set: { nextVendorIndex: candidateIndex } }
        );
        continue;
      }

      const sentAt = now();
      const expiresAt = new Date(sentAt.getTime() + responseWindowMs);
      const requestId = new mongoose.Types.ObjectId();
      const result = await orders.updateOne(
        { _id: latestOrder._id, assignmentLockToken: lockToken, status: 'waiting_for_vendor' },
        {
          $set: {
            vendor: eligible.vendorId,
            vendorName: eligible.vendorName,
            tankId: eligible.tankId,
            tankName: eligible.tankName,
            waterSource: eligible.waterSource,
            currentVendorRequestId: requestId,
            currentVendorRequestExpiresAt: expiresAt,
            nextVendorIndex: candidateIndex,
            assignmentState: 'waiting',
            assignmentLockToken: null,
            assignmentLockUntil: null,
          },
          $push: {
            vendorRequests: {
              _id: requestId,
              vendor: eligible.vendorId,
              vendorName: eligible.vendorName,
              tankId: eligible.tankId,
              distanceKm: eligible.distanceKm,
              vendorPrice: eligible.price,
              status: 'sent',
              sentAt,
              expiresAt,
            },
          },
        }
      );
      if (result.modifiedCount !== 1) return null;

      const notificationOrder = {
        ...latestOrder,
        _id: latestOrder._id,
        vendor: eligible.vendorId,
        vendorName: eligible.vendorName,
        tankId: eligible.tankId,
        tankName: eligible.tankName,
        capacityLiters: eligible.capacityLiters,
        amount: latestOrder.amount,
        vendorResponseDeadline: expiresAt,
      };
      await notify('notifyVendorOrderCreated', eligible.vendorId, notificationOrder);
      await notify('notifyCustomerBookingProcessing', latestOrder.customer, notificationOrder, eligible.vendorName);
      return getOrder(latestOrder._id);
    }

    const finished = await orders.findOneAndUpdate(
      { _id: latestOrder._id, assignmentLockToken: lockToken, status: 'waiting_for_vendor' },
      {
        $set: {
          status: 'no_vendor_available',
          vendor: null,
          vendorName: null,
          currentVendorRequestId: null,
          currentVendorRequestExpiresAt: null,
          assignmentState: 'done',
          assignmentLockToken: null,
          assignmentLockUntil: null,
          nextVendorIndex: candidateIndex,
        },
      },
      { new: true }
    ).lean();
    if (finished) {
      await notify('notifyCustomerNoVendorAvailable', finished.customer, finished);
      try {
        await noVendorAvailableHandler(finished);
      } catch (error) {
        loggerImpl.error({ err: error, orderId: String(finished._id) }, 'Unable to start refund for unassigned booking');
      }
    }
    return finished;
  }

  async function getEligibleVendor(candidate, order) {
    const vendor = await users.findOne({
      _id: candidate.vendor,
      role: 'vendor',
      approvalStatus: 'approved',
      workMode: { $ne: false },
      'inventory._id': candidate.tankId,
    }).select('_id name businessName vendorLocation inventory');
    if (!vendor) return null;

    const tank = typeof vendor.inventory?.id === 'function'
      ? vendor.inventory.id(candidate.tankId)
      : vendor.inventory?.find((item) => String(item._id) === String(candidate.tankId));
    if (!tank || tank.available === false
      || Number(tank.capacityLiters) !== Number(order.capacityLiters)
      || !Number.isFinite(Number(tank.price))
      || Number(tank.price) > Number(order.amount)) {
      return null;
    }

    const coordinates = vendor.vendorLocation?.coordinates;
    const deliveryCoordinates = order.deliveryCoordinates?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length !== 2
      || !coordinates.every(Number.isFinite)
      || !Array.isArray(deliveryCoordinates) || deliveryCoordinates.length !== 2
      || !deliveryCoordinates.every(Number.isFinite)) {
      return null;
    }
    const distanceKm = distanceInKilometers(
      deliveryCoordinates[1],
      deliveryCoordinates[0],
      coordinates[1],
      coordinates[0]
    );
    if (distanceKm > maximumRadiusKm) return null;

    return {
      vendorId: vendor._id,
      vendorName: vendor.businessName || vendor.name || candidate.vendorName,
      tankId: tank._id,
      tankName: tank.name,
      capacityLiters: tank.capacityLiters,
      waterSource: tank.waterSource,
      price: Number(tank.price),
      distanceKm,
    };
  }

  async function respondToRequest(vendorId, orderId, input = {}) {
    if (!['approved', 'rejected'].includes(input.status)) {
      throw new AppError(400, 'Choose accept or reject for this booking request.', 'INVALID_ORDER_STATUS');
    }
    const currentTime = now();
    const responseText = typeof input.response === 'string' ? input.response.trim().slice(0, 300) : '';
    const order = await orders.findOneAndUpdate(
      {
        _id: orderId,
        vendor: vendorId,
        status: 'waiting_for_vendor',
        currentVendorRequestId: input.requestId,
        currentVendorRequestExpiresAt: { $gt: currentTime },
        'vendorRequests': {
          $elemMatch: {
            _id: input.requestId,
            vendor: vendorId,
            status: 'sent',
          },
        },
      },
      input.status === 'approved'
        ? {
          $set: {
            status: 'approved',
            assignmentState: 'done',
            currentVendorRequestId: null,
            currentVendorRequestExpiresAt: null,
            assignmentLockToken: null,
            assignmentLockUntil: null,
            'vendorRequests.$[request].status': 'accepted',
            'vendorRequests.$[request].respondedAt': currentTime,
            'vendorRequests.$[request].response': responseText || 'Vendor accepted the booking.',
            'vendorRequests.$[other].status': 'cancelled',
            'vendorRequests.$[other].respondedAt': currentTime,
            'vendorRequests.$[other].response': 'Another vendor accepted the booking.',
          },
        }
        : {
          $set: {
            assignmentState: 'ready',
            currentVendorRequestId: null,
            currentVendorRequestExpiresAt: null,
            assignmentLockToken: null,
            assignmentLockUntil: null,
            'vendorRequests.$[request].status': 'rejected',
            'vendorRequests.$[request].respondedAt': currentTime,
            'vendorRequests.$[request].response': responseText || 'Vendor rejected the booking.',
          },
        },
      {
        new: true,
        arrayFilters: input.status === 'approved'
          ? [
              { 'request._id': input.requestId, 'request.status': 'sent' },
              { 'other._id': { $ne: input.requestId }, 'other.status': 'sent' },
            ]
          : [{ 'request._id': input.requestId, 'request.status': 'sent' }],
      }
    ).lean();
    if (!order) {
      throw new AppError(409, 'This booking request has expired or is no longer active.', 'BOOKING_REQUEST_NOT_ACTIVE');
    }

    if (input.status === 'approved') {
      await notify('notifyCustomerBookingConfirmed', order.customer, order, order.vendorName);
      const otherVendors = order.vendorRequests
        .filter((request) => String(request.vendor) !== String(vendorId) && request.status === 'sent');
      await Promise.all(otherVendors.map((request) => (
        notify('notifyVendorOrderCancelled', request.vendor, order)
      )));
      return serializeAssignmentOrder(await getOrder(orderId));
    }

    await processOrder(orderId);
    return serializeAssignmentOrder(await getOrder(orderId));
  }

  async function cancelOrder(customerId, orderId) {
    const currentTime = now();
    const order = await orders.findOneAndUpdate(
      { _id: orderId, customer: customerId, status: 'waiting_for_vendor' },
      {
        $set: {
          status: 'cancelled',
          assignmentState: 'done',
          currentVendorRequestId: null,
          currentVendorRequestExpiresAt: null,
          assignmentLockToken: null,
          assignmentLockUntil: null,
          'vendorRequests.$[request].status': 'cancelled',
          'vendorRequests.$[request].respondedAt': currentTime,
          'vendorRequests.$[request].response': 'Customer cancelled the booking.',
        },
      },
      {
        new: true,
        arrayFilters: [{ 'request.status': 'sent' }],
      }
    ).lean();
    if (!order) {
      throw new AppError(409, 'Only a booking waiting for vendor confirmation can be cancelled.', 'BOOKING_NOT_CANCELLABLE');
    }
    const activeVendorRequest = order.vendorRequests.find((request) => request.status === 'cancelled');
    if (activeVendorRequest) {
      await notify('notifyVendorOrderCancelled', activeVendorRequest.vendor, order);
    }
    await notify('notifyCustomerBookingCancelled', customerId, order);
    try {
      await noVendorAvailableHandler(order);
    } catch (error) {
      loggerImpl.error({ err: error, orderId: String(order._id) }, 'Unable to start refund for cancelled booking');
    }
    return serializeAssignmentOrder(order);
  }

  async function processPendingAssignments() {
    const currentTime = now();
    const pending = await orders.find({
      status: 'waiting_for_vendor',
      $or: [
        { assignmentState: 'ready' },
        { assignmentState: 'waiting', currentVendorRequestExpiresAt: { $lte: currentTime } },
      ],
    }).select('_id').limit(100).lean();
    for (const order of pending) {
      try {
        await processOrder(order._id);
      } catch (error) {
        loggerImpl.error({ err: error, orderId: String(order._id) }, 'Unable to advance vendor assignment');
      }
    }
  }

  async function getOrder(orderId) {
    return orders.findById(orderId).lean();
  }

  return {
    setNoVendorAvailableHandler,
    startAssignment,
    processOrder,
    processPendingAssignments,
    respondToRequest,
    cancelOrder,
  };
}

function distanceInKilometers(latitude1, longitude1, latitude2, longitude2) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const latitudeDelta = radians(latitude2 - latitude1);
  const longitudeDelta = radians(longitude2 - longitude1);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(latitude1)) * Math.cos(radians(latitude2))
    * Math.sin(longitudeDelta / 2) ** 2;
  const boundedHaversine = Math.min(1, Math.max(0, haversine));
  return 6371 * 2 * Math.atan2(Math.sqrt(boundedHaversine), Math.sqrt(1 - boundedHaversine));
}

function serializeAssignmentOrder(order) {
  if (!order) return null;
  const activeRequest = order.vendorRequests?.find(
    (request) => String(request._id) === String(order.currentVendorRequestId)
  );
  return {
    id: String(order._id),
    status: order.status,
    vendor: order.vendorName || null,
    vendorId: order.vendor ? String(order.vendor) : null,
    paymentStatus: order.paymentStatus,
    amount: order.amount,
    tank: order.tankName,
    capacityLiters: order.capacityLiters,
    location: order.deliveryAddress,
    date: order.deliveryDate,
    time: order.deliveryTime,
    vendorResponseDeadline: activeRequest?.expiresAt || null,
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

const vendorAssignmentService = createVendorAssignmentService();
vendorAssignmentService.createVendorAssignmentService = createVendorAssignmentService;
module.exports = vendorAssignmentService;
