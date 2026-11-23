const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { test } = require('node:test');
const mongoose = require('mongoose');
const { createPaymentService } = require('../src/services/paymentService');

const keySecret = 'test-secret-with-more-than-thirty-two-characters';

function paymentSignature(orderId, paymentId) {
  return crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
}

function settingModel(value = null) {
  return {
    findOne() {
      return {
        select() {
          return { lean: async () => (value === null ? null : { value }) };
        },
      };
    },
  };
}

test('checkout reports missing Razorpay credentials instead of simulating a payment', async () => {
  const service = createPaymentService({
    credentials: { keyId: '', keySecret: '', webhookSecret: '' },
  });

  await assert.rejects(
    () => service.createCheckoutOrder({ _id: new mongoose.Types.ObjectId() }, {}),
    { code: 'PAYMENTS_NOT_CONFIGURED' }
  );
});

test('checkout amount comes from the current vendor tank and creates an attempt', async () => {
  const customerId = new mongoose.Types.ObjectId();
  const vendorId = new mongoose.Types.ObjectId();
  const tankId = new mongoose.Types.ObjectId();
  let razorpayRequest;
  let savedAttempt;
  const service = createPaymentService({
    credentials: { keyId: 'rzp_test_key', keySecret, webhookSecret: '' },
    users: {
      findOne(filter) {
        assert.equal(String(filter._id), String(vendorId));
        return {
          select: async () => ({
            _id: vendorId,
            name: 'Water Vendor',
            vendorLocation: { coordinates: [77.6, 12.9] },
            inventory: {
              id: (id) => String(id) === String(tankId)
                ? { _id: tankId, name: 'Family Tank', capacityLiters: 5000, price: 2500, available: true }
                : null,
            },
          }),
        };
      },
    },
    settings: settingModel(),
    payments: {
      async create(attempt) {
        savedAttempt = attempt;
      },
    },
    fetchImpl: async (url, options) => {
      razorpayRequest = { url, options };
      return {
        ok: true,
        json: async () => ({ id: 'order_razorpay_1', amount: 250000, currency: 'INR' }),
      };
    },
  });

  const checkout = await service.createCheckoutOrder(
    { _id: customerId, name: 'Customer', email: 'customer@example.com', phone: '9876543210' },
    {
      vendorId: String(vendorId),
      tankId: String(tankId),
      latitude: 12.9,
      longitude: 77.6,
      deliveryAddress: '12 Main Street, Bengaluru',
      deliveryDate: 'Tomorrow',
      deliveryTime: '6:00 PM',
    }
  );

  assert.equal(razorpayRequest.url, 'https://api.razorpay.com/v1/orders');
  assert.equal(JSON.parse(razorpayRequest.options.body).amount, 250000);
  assert.equal(checkout.keyId, 'rzp_test_key');
  assert.equal(checkout.order.id, 'order_razorpay_1');
  assert.equal(savedAttempt.amount, 2500);
  assert.equal(savedAttempt.vendor, vendorId);
  assert.equal(savedAttempt.status, 'created');
});

test('capacity checkout uses the highest current offer and rejects a stale displayed price', async () => {
  const customerId = new mongoose.Types.ObjectId();
  const firstVendor = new mongoose.Types.ObjectId();
  const secondVendor = new mongoose.Types.ObjectId();
  const firstTank = new mongoose.Types.ObjectId();
  const secondTank = new mongoose.Types.ObjectId();
  let fetchCalls = 0;
  let savedAttempt;
  const service = createPaymentService({
    credentials: { keyId: 'rzp_test_key', keySecret, webhookSecret: '' },
    vendorService: {
      async findNearby() {
        return [{
          capacityLiters: 500,
          name: '500 L Tanker',
          displayedPrice: 600,
          vendors: [
            { vendorId: firstVendor, vendorName: 'Nearest Vendor', tankId: firstTank, tankName: '500 L Tanker', capacityLiters: 500, price: 500, distanceKm: 2 },
            { vendorId: secondVendor, vendorName: 'Highest Price Vendor', tankId: secondTank, tankName: '500 L Tanker', capacityLiters: 500, price: 600, distanceKm: 6 },
          ],
        }];
      },
    },
    payments: {
      async create(attempt) {
        savedAttempt = attempt;
      },
    },
    fetchImpl: async (url, options) => {
      fetchCalls += 1;
      assert.equal(url, 'https://api.razorpay.com/v1/orders');
      assert.equal(JSON.parse(options.body).amount, 60000);
      return {
        ok: true,
        json: async () => ({ id: 'order_grouped_1', amount: 60000, currency: 'INR' }),
      };
    },
  });
  const customer = { _id: customerId, name: 'Customer' };
  const delivery = {
    capacityLiters: 500,
    displayedPrice: 600,
    latitude: 12.9,
    longitude: 77.6,
    deliveryAddress: '12 Main Street, Bengaluru',
    deliveryDate: 'Tomorrow',
    deliveryTime: '6:00 PM',
  };

  const checkout = await service.createCheckoutOrder(customer, delivery);
  assert.equal(checkout.order.amount, 60000);
  assert.equal(savedAttempt.displayedPrice, 600);
  assert.deepEqual(savedAttempt.eligibleVendors.map((candidate) => candidate.vendor), [firstVendor, secondVendor]);
  assert.deepEqual(savedAttempt.eligibleVendors.map((candidate) => candidate.distanceKm), [2, 6]);

  await assert.rejects(
    () => service.createCheckoutOrder(customer, { ...delivery, displayedPrice: 500 }),
    { code: 'OFFER_PRICE_CHANGED' }
  );
  assert.equal(fetchCalls, 1);
});

test('checkout reports a safe credential error when Razorpay rejects authentication', async () => {
  const vendorId = new mongoose.Types.ObjectId();
  const tankId = new mongoose.Types.ObjectId();
  const service = createPaymentService({
    credentials: { keyId: 'rzp_test_key', keySecret, webhookSecret: '' },
    users: {
      findOne() {
        return {
          select: async () => ({
            _id: vendorId,
            name: 'Water Vendor',
            vendorLocation: { coordinates: [77.6, 12.9] },
            inventory: {
              id: () => ({ _id: tankId, name: 'Family Tank', price: 2500, available: true }),
            },
          }),
        };
      },
    },
    settings: settingModel(),
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: { description: 'Do not expose provider response details.' } }),
    }),
  });

  await assert.rejects(
    () => service.createCheckoutOrder({ _id: new mongoose.Types.ObjectId() }, {
      vendorId: String(vendorId),
      tankId: String(tankId),
      latitude: 12.9,
      longitude: 77.6,
      deliveryAddress: '12 Main Street, Bengaluru',
      deliveryDate: 'Tomorrow',
      deliveryTime: '6:00 PM',
    }),
    (error) => error.code === 'RAZORPAY_AUTHENTICATION_FAILED'
      && error.message.includes('matching pair')
      && !error.message.includes('provider response')
  );
});

test('checkout rejects a vendor outside the current admin-configured radius', async () => {
  const vendorId = new mongoose.Types.ObjectId();
  const tankId = new mongoose.Types.ObjectId();
  let fetchCalls = 0;
  const service = createPaymentService({
    credentials: { keyId: 'rzp_test_key', keySecret, webhookSecret: '' },
    users: {
      findOne() {
        return {
          select: async () => ({
            _id: vendorId,
            name: 'Water Vendor',
            vendorLocation: { coordinates: [77.6, 12.9] },
            inventory: {
              id: () => ({ _id: tankId, name: 'Family Tank', price: 2500, available: true }),
            },
          }),
        };
      },
    },
    settings: settingModel(5),
    fetchImpl: async () => {
      fetchCalls += 1;
    },
  });

  await assert.rejects(
    () => service.createCheckoutOrder({ _id: new mongoose.Types.ObjectId() }, {
      vendorId: String(vendorId),
      tankId: String(tankId),
      latitude: 12.9,
      longitude: 77.7,
      deliveryAddress: '12 Main Street, Bengaluru',
      deliveryDate: 'Tomorrow',
      deliveryTime: '6:00 PM',
    }),
    { code: 'OFFER_OUTSIDE_RADIUS' }
  );
  assert.equal(fetchCalls, 0);
});

test('verified captured Razorpay payment creates one paid water order', async () => {
  const customerId = new mongoose.Types.ObjectId();
  const vendorId = new mongoose.Types.ObjectId();
  const tankId = new mongoose.Types.ObjectId();
  const paymentAttemptId = new mongoose.Types.ObjectId();
  const orderId = new mongoose.Types.ObjectId();
  const attempt = {
    _id: paymentAttemptId,
    customer: customerId,
    vendor: vendorId,
    tankId,
    tankName: 'Family Tank',
    capacityLiters: 5000,
    vendorName: 'Water Vendor',
    amount: 2500,
    deliveryAddress: '12 Main Street, Bengaluru',
    deliveryDate: 'Tomorrow',
    deliveryTime: '6:00 PM',
    razorpayOrderId: 'order_razorpay_1',
    status: 'created',
  };
  let createdOrder;
  let verifiedPaymentCalls = 0;
  let notifiedVendor;
  const service = createPaymentService({
    credentials: { keyId: 'rzp_test_key', keySecret, webhookSecret: '' },
    notifications: {
      async notifyVendorOrderCreated(id) {
        notifiedVendor = id;
      },
    },
    payments: {
      findOne() {
        return { lean: async () => attempt };
      },
      async updateOne(filter, update) {
        assert.equal(String(filter._id), String(paymentAttemptId));
        assert.equal(update.$set.status, 'paid');
      },
    },
    orders: {
      findOne() {
        return { lean: async () => null };
      },
      async create(order) {
        createdOrder = order;
        return { ...order, _id: orderId };
      },
    },
    fetchImpl: async () => {
      verifiedPaymentCalls += 1;
      return {
        ok: true,
        json: async () => ({
          id: 'pay_razorpay_1',
          order_id: 'order_razorpay_1',
          amount: 250000,
          currency: 'INR',
          status: 'captured',
        }),
      };
    },
  });

  const result = await service.verifyAndCompletePayment(customerId, {
    razorpay_order_id: 'order_razorpay_1',
    razorpay_payment_id: 'pay_razorpay_1',
    razorpay_signature: paymentSignature('order_razorpay_1', 'pay_razorpay_1'),
  });

  assert.equal(verifiedPaymentCalls, 1);
  assert.equal(createdOrder.paymentStatus, 'paid');
  assert.equal(createdOrder.amount, 2500);
  assert.equal(createdOrder.razorpayPaymentId, 'pay_razorpay_1');
  assert.equal(result.order.id, String(orderId));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(String(notifiedVendor), String(vendorId));
});

test('payment verification rejects an invalid signature without contacting Razorpay', async () => {
  let fetchCalls = 0;
  const service = createPaymentService({
    credentials: { keyId: 'rzp_test_key', keySecret, webhookSecret: '' },
    fetchImpl: async () => {
      fetchCalls += 1;
    },
  });

  await assert.rejects(
    () => service.verifyAndCompletePayment(new mongoose.Types.ObjectId(), {
      razorpay_order_id: 'order_razorpay_1',
      razorpay_payment_id: 'pay_razorpay_1',
      razorpay_signature: '0'.repeat(64),
    }),
    { code: 'PAYMENT_VERIFICATION_FAILED' }
  );
  assert.equal(fetchCalls, 0);
});

test('authorized payments are captured before an order is marked paid', async () => {
  const customerId = new mongoose.Types.ObjectId();
  const vendorId = new mongoose.Types.ObjectId();
  const tankId = new mongoose.Types.ObjectId();
  const attempt = {
    _id: new mongoose.Types.ObjectId(),
    customer: customerId,
    vendor: vendorId,
    tankId,
    tankName: 'Family Tank',
    capacityLiters: 5000,
    vendorName: 'Water Vendor',
    amount: 2500,
    deliveryAddress: '12 Main Street, Bengaluru',
    deliveryDate: 'Tomorrow',
    deliveryTime: '6:00 PM',
    razorpayOrderId: 'order_razorpay_2',
    status: 'created',
  };
  const requests = [];
  let createdOrder;
  const service = createPaymentService({
    credentials: { keyId: 'rzp_test_key', keySecret, webhookSecret: '' },
    notifications: { async notifyVendorOrderCreated() {} },
    payments: {
      findOne() {
        return { lean: async () => attempt };
      },
      async updateOne() {},
    },
    orders: {
      findOne() {
        return { lean: async () => null };
      },
      async create(order) {
        createdOrder = order;
        return { ...order, _id: new mongoose.Types.ObjectId() };
      },
    },
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        json: async () => (options.method === 'POST'
          ? { status: 'captured' }
          : {
            id: 'pay_razorpay_2',
            order_id: 'order_razorpay_2',
            amount: 250000,
            currency: 'INR',
            status: 'authorized',
          }),
      };
    },
  });

  await service.verifyAndCompletePayment(customerId, {
    razorpay_order_id: 'order_razorpay_2',
    razorpay_payment_id: 'pay_razorpay_2',
    razorpay_signature: paymentSignature('order_razorpay_2', 'pay_razorpay_2'),
  });

  assert.equal(requests.length, 2);
  assert.match(requests[1].url, /\/payments\/pay_razorpay_2\/capture$/);
  assert.equal(JSON.parse(requests[1].options.body).amount, 250000);
  assert.equal(createdOrder.paymentStatus, 'paid');
});

test('concurrent refund workers create at most one Razorpay refund', async () => {
  const orderId = new mongoose.Types.ObjectId();
  const order = {
    _id: orderId,
    status: 'no_vendor_available',
    paymentStatus: 'paid',
    amount: 600,
    razorpayPaymentId: 'pay_refund_1',
  };
  let refundLockToken = null;
  let refundCalls = 0;
  let orderPaymentStatus = 'paid';
  const service = createPaymentService({
    credentials: { keyId: 'rzp_test_key', keySecret, webhookSecret: '' },
    orders: {
      findOneAndUpdate(filter, update) {
        if (refundLockToken) return { lean: async () => null };
        refundLockToken = update.$set.refundLockToken;
        return {
          lean: async () => ({
            ...order,
            ...update.$set,
            refundLockToken,
          }),
        };
      },
      async updateOne(filter, update) {
        if (update.$set?.paymentStatus === 'refunded') {
          assert.equal(filter.refundLockToken, refundLockToken);
          orderPaymentStatus = 'refunded';
          refundLockToken = null;
        } else if (update.$unset?.refundLockToken) {
          refundLockToken = null;
        }
        return { modifiedCount: 1 };
      },
    },
    payments: {
      async updateOne() {},
    },
    fetchImpl: async (url, options) => {
      if (options.method === 'POST') refundCalls += 1;
      return {
        ok: true,
        json: async () => (options.method === 'POST'
          ? { id: 'rfnd_1', status: 'processed' }
          : { items: [] }),
      };
    },
  });

  await Promise.all([service.refundOrder(order), service.refundOrder(order)]);

  assert.equal(refundCalls, 1);
  assert.equal(orderPaymentStatus, 'refunded');
});

test('Razorpay webhook verifies its signature before accepting payment events', async () => {
  const webhookSecret = 'private-webhook-secret';
  const rawBody = Buffer.from(JSON.stringify({ event: 'payment.failed' }));
  const signature = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  const service = createPaymentService({
    credentials: { keyId: 'rzp_test_key', keySecret, webhookSecret },
  });

  assert.deepEqual(await service.handleWebhook(rawBody, signature), { received: true });
  await assert.rejects(
    () => service.handleWebhook(rawBody, '0'.repeat(64)),
    { code: 'INVALID_WEBHOOK_SIGNATURE' }
  );
});
