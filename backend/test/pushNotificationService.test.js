const assert = require('node:assert/strict');
const { test } = require('node:test');
const mongoose = require('mongoose');
const { createPushNotificationService } = require('../src/services/pushNotificationService');

test('vendor push token registration validates and stores Expo tokens', async () => {
  const vendorId = new mongoose.Types.ObjectId();
  let update;
  const service = createPushNotificationService({
    users: {
      async updateOne(filter, change) {
        update = { filter, change };
        return { matchedCount: 1 };
      },
    },
    loggerImpl: { warn() {} },
  });

  assert.deepEqual(
    await service.registerVendorToken(vendorId, { token: 'ExponentPushToken[test-device]' }),
    { registered: true }
  );
  assert.equal(String(update.filter._id), String(vendorId));
  assert.deepEqual(update.change, { $addToSet: { pushTokens: 'ExponentPushToken[test-device]' } });
  await assert.rejects(
    () => service.registerVendorToken(vendorId, { token: 'not-an-expo-token' }),
    { code: 'INVALID_PUSH_TOKEN' }
  );
});

test('new order notification is sent to the vendor with order details and buzzer sound', async () => {
  const vendorId = new mongoose.Types.ObjectId();
  const orderId = new mongoose.Types.ObjectId();
  let request;
  const service = createPushNotificationService({
    users: {
      findOne(filter) {
        assert.equal(String(filter._id), String(vendorId));
        return {
          select(fields) {
            assert.equal(fields, '+pushTokens');
            return { lean: async () => ({ pushTokens: ['ExponentPushToken[test-device]'] }) };
          },
        };
      },
    },
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ data: [{ status: 'ok' }] }) };
    },
    loggerImpl: { warn() {} },
  });

  await service.notifyVendorOrderCreated(vendorId, {
    _id: orderId,
    capacityLiters: 5000,
  });

  assert.equal(request.url, 'https://exp.host/--/api/v2/push/send');
  const [message] = JSON.parse(request.options.body);
  assert.equal(message.to, 'ExponentPushToken[test-device]');
  assert.equal(message.title, 'New water order');
  assert.match(message.body, /5,000 L tanker/);
  assert.equal(message.sound, 'order_alert.wav');
  assert.equal(message.channelId, 'orders');
  assert.deepEqual(message.data, { screen: 'vendor-orders', orderId: String(orderId) });
});

test('unregistered push tokens are removed from vendor devices', async () => {
  const vendorId = new mongoose.Types.ObjectId();
  let removed;
  const service = createPushNotificationService({
    users: {
      findOne() {
        return {
          select() {
            return { lean: async () => ({ pushTokens: ['ExponentPushToken[expired-device]'] }) };
          },
        };
      },
      async updateOne(filter, change) {
        removed = { filter, change };
        return { matchedCount: 1 };
      },
    },
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        data: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }],
      }),
    }),
    loggerImpl: { warn() {} },
  });

  await service.notifyVendorOrderCreated(vendorId, { id: 'order-1', capacityLiters: 1000 });
  assert.deepEqual(removed.change, {
    $pull: { pushTokens: { $in: ['ExponentPushToken[expired-device]'] } },
  });
});
