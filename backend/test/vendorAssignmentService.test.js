const assert = require('node:assert/strict');
const { test } = require('node:test');
const mongoose = require('mongoose');
const { createVendorAssignmentService } = require('../src/services/vendorAssignmentService');

function createAssignmentHarness({ candidates, request, now = new Date('2026-03-01T12:00:00.000Z') }) {
  const orderId = new mongoose.Types.ObjectId();
  const order = {
    _id: orderId,
    customer: new mongoose.Types.ObjectId(),
    status: 'waiting_for_vendor',
    assignmentState: request ? 'waiting' : 'ready',
    assignmentLockToken: null,
    assignmentLockUntil: null,
    currentVendorRequestId: request?._id || null,
    currentVendorRequestExpiresAt: request?.expiresAt || null,
    nextVendorIndex: request ? 1 : 0,
    eligibleVendors: candidates,
    vendorRequests: request ? [request] : [],
    deliveryCoordinates: { type: 'Point', coordinates: [77.6, 12.9] },
    capacityLiters: 500,
    amount: 600,
    tankName: '500 L Tanker',
    deliveryAddress: '12 Main Street, Bengaluru',
    deliveryDate: 'Tomorrow',
    deliveryTime: '6:00 PM',
    paymentStatus: 'paid',
  };
  const notified = [];
  const users = {
    findOne(filter) {
      const candidate = candidates.find((item) => String(item.vendor) === String(filter._id));
      const tank = candidate && {
        _id: candidate.tankId,
        name: candidate.tankName,
        capacityLiters: candidate.capacityLiters,
        price: candidate.price,
        available: true,
        waterSource: 'bore',
      };
      return {
        select: async () => candidate ? {
          _id: candidate.vendor,
          name: candidate.vendorName,
          businessName: candidate.vendorName,
          vendorLocation: { coordinates: [77.6, 12.9] },
          inventory: { id: () => tank },
        } : null,
      };
    },
  };
  const orders = {
    findOneAndUpdate(filter, update) {
      if (update.$set.assignmentLockToken) {
        order.assignmentLockToken = update.$set.assignmentLockToken;
        order.assignmentLockUntil = update.$set.assignmentLockUntil;
      } else {
        const requestStatus = update.$set['vendorRequests.$[request].status'];
        if (requestStatus) {
          const currentRequest = order.vendorRequests.find(
            (item) => String(item._id) === String(filter.currentVendorRequestId)
          );
          if (currentRequest) {
            currentRequest.status = requestStatus;
            currentRequest.respondedAt = update.$set['vendorRequests.$[request].respondedAt'];
          }
        }
        Object.entries(update.$set).forEach(([key, value]) => {
          if (!key.startsWith('vendorRequests.')) order[key] = value;
        });
      }
      return { lean: async () => ({ ...order, vendorRequests: [...order.vendorRequests] }) };
    },
    updateOne(filter, update) {
      if (update.$set['vendorRequests.$[request].status'] === 'expired') {
        const expired = order.vendorRequests.find((item) => String(item._id) === String(order.currentVendorRequestId));
        expired.status = 'expired';
        expired.respondedAt = update.$set['vendorRequests.$[request].respondedAt'];
        order.currentVendorRequestId = null;
        order.currentVendorRequestExpiresAt = null;
        order.assignmentState = 'ready';
      } else {
        Object.assign(order, update.$set);
        if (update.$push?.vendorRequests) order.vendorRequests.push(update.$push.vendorRequests);
      }
      return { modifiedCount: 1 };
    },
    findById() {
      return { lean: async () => order };
    },
  };
  const notifications = Object.fromEntries([
    'notifyVendorOrderCreated',
    'notifyVendorOrderExpired',
    'notifyVendorOrderCancelled',
    'notifyCustomerBookingProcessing',
    'notifyCustomerBookingConfirmed',
    'notifyCustomerNoVendorAvailable',
  ].map((method) => [method, async (...args) => notified.push({ method, args })]));

  return {
    order,
    notified,
    service: createVendorAssignmentService({
      users,
      orders,
      notifications,
      now: () => now,
      loggerImpl: { warn() {}, error() {} },
    }),
  };
}

function candidate(name, distanceKm, price) {
  return {
    vendor: new mongoose.Types.ObjectId(),
    vendorName: name,
    tankId: new mongoose.Types.ObjectId(),
    tankName: '500 L Tanker',
    capacityLiters: 500,
    price,
    distanceKm,
  };
}

test('starts with the nearest eligible vendor and saves a 30-minute request window', async () => {
  const candidates = [candidate('Nearest Vendor', 2, 500), candidate('Next Vendor', 4, 450)];
  const { order, notified, service } = createAssignmentHarness({ candidates });

  await service.startAssignment(order._id);

  assert.equal(String(order.vendor), String(candidates[0].vendor));
  assert.equal(order.assignmentState, 'waiting');
  assert.equal(order.nextVendorIndex, 1);
  assert.equal(order.vendorRequests.length, 1);
  assert.equal(order.vendorRequests[0].status, 'sent');
  assert.equal(order.vendorRequests[0].expiresAt.getTime(), Date.parse('2026-03-01T12:30:00.000Z'));
  assert.deepEqual(notified.map((item) => item.method), [
    'notifyVendorOrderCreated',
    'notifyCustomerBookingProcessing',
  ]);
});

test('a vendor rejection immediately sends the request to the next eligible vendor', async () => {
  const candidates = [candidate('First Vendor', 2, 500), candidate('Second Vendor', 4, 450)];
  const requestId = new mongoose.Types.ObjectId();
  const request = {
    _id: requestId,
    vendor: candidates[0].vendor,
    vendorName: candidates[0].vendorName,
    tankId: candidates[0].tankId,
    distanceKm: 2,
    vendorPrice: 500,
    status: 'sent',
    sentAt: new Date('2026-03-01T11:50:00.000Z'),
    expiresAt: new Date('2026-03-01T12:20:00.000Z'),
  };
  const { order, notified, service } = createAssignmentHarness({ candidates, request });

  await service.respondToRequest(candidates[0].vendor, order._id, {
    requestId,
    status: 'rejected',
  });

  assert.equal(order.vendorRequests[0].status, 'rejected');
  assert.equal(String(order.vendor), String(candidates[1].vendor));
  assert.equal(order.assignmentState, 'waiting');
  assert.equal(order.vendorRequests.length, 2);
  assert.equal(order.vendorRequests[1].status, 'sent');
  assert.deepEqual(notified.map((item) => item.method), [
    'notifyVendorOrderCreated',
    'notifyCustomerBookingProcessing',
  ]);
});

test('a vendor timeout expires the request and advances to the next vendor', async () => {
  const candidates = [candidate('First Vendor', 2, 500), candidate('Second Vendor', 4, 450)];
  const requestId = new mongoose.Types.ObjectId();
  const request = {
    _id: requestId,
    vendor: candidates[0].vendor,
    vendorName: candidates[0].vendorName,
    tankId: candidates[0].tankId,
    distanceKm: 2,
    vendorPrice: 500,
    status: 'sent',
    sentAt: new Date('2026-03-01T11:00:00.000Z'),
    expiresAt: new Date('2026-03-01T11:30:00.000Z'),
  };
  const { order, notified, service } = createAssignmentHarness({ candidates, request });

  await service.processOrder(order._id);

  assert.equal(order.vendorRequests[0].status, 'expired');
  assert.equal(String(order.vendor), String(candidates[1].vendor));
  assert.equal(order.vendorRequests[1].status, 'sent');
  assert.deepEqual(notified.map((item) => item.method), [
    'notifyVendorOrderExpired',
    'notifyVendorOrderCreated',
    'notifyCustomerBookingProcessing',
  ]);
});

test('vendor acceptance confirms the order and stops sequential assignment', async () => {
  const candidates = [candidate('First Vendor', 2, 500), candidate('Second Vendor', 4, 450)];
  const requestId = new mongoose.Types.ObjectId();
  const request = {
    _id: requestId,
    vendor: candidates[0].vendor,
    vendorName: candidates[0].vendorName,
    tankId: candidates[0].tankId,
    distanceKm: 2,
    vendorPrice: 500,
    status: 'sent',
    sentAt: new Date('2026-03-01T11:50:00.000Z'),
    expiresAt: new Date('2026-03-01T12:20:00.000Z'),
  };
  const { order, notified, service } = createAssignmentHarness({ candidates, request });

  await service.respondToRequest(candidates[0].vendor, order._id, {
    requestId,
    status: 'approved',
  });

  assert.equal(order.status, 'approved');
  assert.equal(order.assignmentState, 'done');
  assert.equal(order.vendorRequests[0].status, 'accepted');
  assert.equal(order.vendorRequests.length, 1);
  assert.deepEqual(notified.map((item) => item.method), ['notifyCustomerBookingConfirmed']);
});

test('a vendor whose price rises above the paid quote is skipped', async () => {
  const candidates = [candidate('Price Increased Vendor', 1, 700), candidate('Eligible Vendor', 4, 550)];
  const { order, service } = createAssignmentHarness({ candidates });

  await service.startAssignment(order._id);

  assert.equal(order.nextVendorIndex, 2);
  assert.equal(String(order.vendor), String(candidates[1].vendor));
  assert.equal(order.vendorRequests.length, 1);
  assert.equal(String(order.vendorRequests[0].vendor), String(candidates[1].vendor));
});

test('duplicate listings from one vendor never create multiple requests for one booking', async () => {
  const duplicatedVendor = candidate('Repeated Vendor', 1, 700);
  const sameVendorListing = { ...duplicatedVendor, tankId: new mongoose.Types.ObjectId(), price: 500 };
  const nextVendor = candidate('Next Vendor', 4, 550);
  const candidates = [duplicatedVendor, sameVendorListing, nextVendor];
  const { order, service } = createAssignmentHarness({ candidates });

  await service.startAssignment(order._id);

  assert.equal(order.nextVendorIndex, 3);
  assert.equal(order.vendorRequests.length, 1);
  assert.equal(String(order.vendorRequests[0].vendor), String(nextVendor.vendor));
});
