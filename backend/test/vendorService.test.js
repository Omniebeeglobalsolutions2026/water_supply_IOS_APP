const assert = require('node:assert/strict');
const { test } = require('node:test');
const mongoose = require('mongoose');
const { createVendorService } = require('../src/services/vendorService');

test('nearby search uses a manually configured radius and bounds the geo query', async () => {
  let pipeline;
  let settingQuery;
  const service = createVendorService({
    users: {
      aggregate(value) {
        pipeline = value;
        return Promise.resolve([]);
      },
    },
    settings: {
      findOne(query) {
        settingQuery = query;
        return { select: () => ({ lean: async () => ({ value: 7.5 }) }) };
      },
    },
  });

  const offers = await service.findNearby({ latitude: 12.9, longitude: 77.6, radiusKm: 2 });
  assert.deepEqual(offers, []);
  assert.deepEqual(settingQuery, { key: 'nearby_search_radius_km' });
  assert.deepEqual(pipeline[0].$geoNear.near, { type: 'Point', coordinates: [77.6, 12.9] });
  assert.equal(pipeline[0].$geoNear.maxDistance, 7500);
  assert.equal(pipeline[0].$geoNear.query.approvalStatus, 'approved');
  assert.deepEqual(pipeline[3].$sort, { distanceMeters: 1, 'inventory.price': 1 });
  assert.equal(Object.hasOwn(pipeline[4].$project, 'distanceKm'), true);
  await assert.rejects(
    () => service.findNearby({ latitude: 91, longitude: 77.6 }),
    { code: 'INVALID_COORDINATES' }
  );
});

test('nearby search rejects an invalid saved radius setting', async () => {
  const service = createVendorService({
    settings: {
      findOne() {
        return { select: () => ({ lean: async () => ({ value: 101 }) }) };
      },
    },
  });

  await assert.rejects(
    () => service.findNearby({ latitude: 12.9, longitude: 77.6 }),
    { code: 'INVALID_NEARBY_RADIUS_SETTING' }
  );
});

test('nearby search defaults to ten kilometers until an admin changes the setting', async () => {
  let pipeline;
  const service = createVendorService({
    users: {
      aggregate(value) {
        pipeline = value;
        return Promise.resolve([]);
      },
    },
    settings: {
      findOne() {
        return { select: () => ({ lean: async () => null }) };
      },
    },
  });

  await service.findNearby({ latitude: 12.9, longitude: 77.6 });
  assert.equal(pipeline[0].$geoNear.maxDistance, 10000);
});

test('nearby search groups capacities, keeps the highest price, and orders candidates by distance', async () => {
  const listings = [
    { vendorId: 'vendor-a', vendorName: 'Vendor A', distanceKm: 2, tank: { id: 'tank-a', name: '500 L Tanker', capacityLiters: 500, price: 500 } },
    { vendorId: 'vendor-b', vendorName: 'Vendor B', distanceKm: 4, tank: { id: 'tank-b', name: '500 L Tanker', capacityLiters: 500, price: 450 } },
    { vendorId: 'vendor-c', vendorName: 'Vendor C', distanceKm: 6, tank: { id: 'tank-c', name: '500 L Tanker', capacityLiters: 500, price: 600 } },
    { vendorId: 'vendor-d', vendorName: 'Vendor D', distanceKm: 3, tank: { id: 'tank-d', name: '600 L Tanker', capacityLiters: 600, price: 700 } },
  ];
  const service = createVendorService({
    users: { aggregate: async () => listings },
    settings: {
      findOne() {
        return { select: () => ({ lean: async () => null }) };
      },
    },
  });

  const offers = await service.findNearby({ latitude: 12.9, longitude: 77.6 });

  assert.deepEqual(offers.map((offer) => [offer.capacityLiters, offer.displayedPrice]), [[500, 600], [600, 700]]);
  assert.deepEqual(offers[0].vendors.map((candidate) => candidate.vendorId), ['vendor-a', 'vendor-b', 'vendor-c']);
  assert.equal(offers[0].vendors[2].price, 600);
});
test('work mode accepts only an explicit boolean and persists the setting', async () => {
  let update;
  const service = createVendorService({
    users: {
      findOneAndUpdate(filter, change) {
        update = { filter, change };
        return {
          select: async () => ({ workMode: false }),
        };
      },
    },
  });

  assert.equal(await service.setWorkMode('vendor-id', { enabled: false }), false);
  assert.deepEqual(update.change, { $set: { workMode: false } });
  await assert.rejects(() => service.setWorkMode('vendor-id', { enabled: 'false' }), {
    code: 'INVALID_WORK_MODE',
  });
});

test('order creation snapshots an approved vendor tank and populates the customer', async () => {
  const vendorId = new mongoose.Types.ObjectId();
  const tankId = new mongoose.Types.ObjectId();
  const orderId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();
  let notifiedVendor;
  let notifiedOrder;
  const tank = { _id: tankId, name: 'Tanker', capacityLiters: 5000, waterSource: 'bore', price: 850, available: true };
  let savedOrder;
  let userQuery;
  const service = createVendorService({
    users: {
      findOne(query) {
        userQuery = query;
        return {
          select: async () => ({
            _id: vendorId,
            inventory: { id: (id) => (String(id) === String(tankId) ? tank : null) },
          }),
        };
      },
    },
    orders: {
      async create(order) {
        savedOrder = order;
        return { ...order, _id: orderId };
      },
      findById(id) {
        assert.equal(String(id), String(orderId));
        return {
          populate(path, fields) {
            assert.equal(path, 'customer');
            assert.equal(fields, 'name phone email');
            return { lean: async () => ({
              ...savedOrder,
              _id: orderId,
              customer: { name: 'Customer Name', phone: '12345' },
              paymentStatus: 'pending',
            }) };
          },
        };
      },
    },
    notifications: {
      async notifyVendorOrderCreated(id, orderDetails) {
        notifiedVendor = id;
        notifiedOrder = orderDetails;
      },
    },
  });

  const order = await service.createOrder(customerId, {
    vendorId: String(vendorId),
    tankId: String(tankId),
    deliveryAddress: '10 Main Street, Bengaluru',
    deliveryDate: 'Tomorrow',
    deliveryTime: '10:00 AM',
  });

  assert.equal(userQuery.approvalStatus, 'approved');
  assert.equal(userQuery.workMode.$ne, false);
  assert.equal(order.customer, 'Customer Name');
  assert.equal(order.capacityLiters, 5000);
  assert.equal(order.waterSource, 'bore');
  assert.equal(order.amount, 850);
  assert.equal(savedOrder.vendor, vendorId);
  assert.equal(savedOrder.tankId, tankId);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(String(notifiedVendor), String(vendorId));
  assert.equal(String(notifiedOrder._id), String(orderId));
});

test('tank listings require and persist a supported water source', async () => {
  let insertedTank;
  const tank = {
    _id: new mongoose.Types.ObjectId(),
    name: '500 L Tanker',
    capacityLiters: 500,
    waterSource: 'well',
    price: 300,
    available: true,
  };
  const service = createVendorService({
    users: {
      async updateOne(filter, update) {
        assert.deepEqual(filter, { _id: 'vendor-id', role: 'vendor' });
        insertedTank = update.$push.inventory;
        return { matchedCount: 1 };
      },
      findOne() {
        return {
          select() {
            return { lean: async () => ({ _id: 'vendor-id', inventory: [tank] }) };
          },
        };
      },
    },
  });

  const profile = await service.addTank('vendor-id', {
    name: '500 L Tanker',
    capacityLiters: 500,
    waterSource: 'well',
    price: 300,
  });
  assert.equal(insertedTank.waterSource, 'well');
  assert.equal(profile.inventory[0].waterSource, 'well');
  await assert.rejects(() => service.addTank('vendor-id', {
    name: '500 L Tanker',
    capacityLiters: 500,
    price: 300,
  }), { code: 'INVALID_TANK' });
  await assert.rejects(() => service.addTank('vendor-id', {
    name: '500 L Tanker',
    capacityLiters: 500,
    waterSource: 'ocean',
    price: 300,
  }), { code: 'INVALID_TANK' });
});

test('order creation rejects invalid and unavailable tank selections', async () => {
  let createCalls = 0;
  const service = createVendorService({
    users: {
      findOne() {
        return { select: async () => null };
      },
    },
    orders: {
      async create() {
        createCalls += 1;
      },
    },
  });
  await assert.rejects(() => service.createOrder('customer-id', {
    vendorId: 'not-an-object-id',
    tankId: 'also-invalid',
  }), { code: 'INVALID_ORDER_SELECTION' });
  await assert.rejects(() => service.createOrder('customer-id', {
    vendorId: String(new mongoose.Types.ObjectId()),
    tankId: String(new mongoose.Types.ObjectId()),
    deliveryAddress: '10 Main Street, Bengaluru',
    deliveryDate: 'Tomorrow',
    deliveryTime: '10:00 AM',
  }), { code: 'OFFER_UNAVAILABLE' });
  assert.equal(createCalls, 0);
});

test('customer order history includes the vendor business name', async () => {
  const customerId = new mongoose.Types.ObjectId();
  const service = createVendorService({
    orders: {
      find(filter) {
        assert.equal(filter.customer, customerId);
        return {
          populate(path, fields) {
            assert.equal(path, 'vendor');
            assert.equal(fields, 'businessName name');
            return {
              sort() {
                return {
                  limit() {
                    return {
                      lean: async () => [{
                        _id: new mongoose.Types.ObjectId(),
                        customer: customerId,
                        vendor: { businessName: 'Clear Water Co.', name: 'Owner' },
                        tankName: 'Family Tank',
                        capacityLiters: 5000,
                        waterSource: 'lake',
                        amount: 800,
                        deliveryAddress: 'Main Street',
                        deliveryDate: 'Tomorrow',
                        deliveryTime: '10:00 AM',
                        status: 'pending',
                        paymentStatus: 'pending',
                      }],
                    };
                  },
                };
              },
            };
          },
        };
      },
    },
  });

  const history = await service.listCustomerOrders(customerId);
  assert.equal(history.length, 1);
  assert.equal(history[0].vendor, 'Clear Water Co.');
  assert.equal(history[0].tank, 'Family Tank');
  assert.equal(history[0].waterSource, 'lake');
});

test('earnings distinguish completed orders from actual paid settlements', async () => {
  const vendorId = new mongoose.Types.ObjectId();
  const service = createVendorService({
    orders: {
      find(filter) {
        if (filter.createdAt) {
          return {
            lean: async () => [
              { _id: new mongoose.Types.ObjectId(), status: 'completed', amount: 120, paymentStatus: 'paid', createdAt: new Date() },
              { _id: new mongoose.Types.ObjectId(), status: 'pending', amount: 75, paymentStatus: 'pending', createdAt: new Date() },
            ],
          };
        }
        return {
          select: () => ({
            lean: async () => [
              { status: 'completed', amount: 120, paymentStatus: 'paid' },
              { status: 'completed', amount: 80, paymentStatus: 'pending' },
              { status: 'pending', amount: 75, paymentStatus: 'pending' },
            ],
          }),
        };
      },
    },
  });

  const dashboard = await service.getDashboard(vendorId, { period: 'daily' });
  assert.equal(dashboard.grossEarning, 120);
  assert.equal(dashboard.allTimeOrders, 3);
  assert.equal(dashboard.totalOrders, 2);
  assert.equal(dashboard.settledAmount, 120);
  assert.equal(dashboard.pendingSettlement, 0);
  assert.equal(dashboard.orders.length, 2);
});
