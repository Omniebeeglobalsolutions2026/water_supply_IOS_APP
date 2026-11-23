const AppError = require('../errors/AppError');
const logger = require('../config/logger');
const User = require('../models/User');

const expoPushEndpoint = 'https://exp.host/--/api/v2/push/send';
const expoPushTokenPattern = /^(?:Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$/;

function createPushNotificationService({
  users = User,
  fetchImpl = globalThis.fetch,
  loggerImpl = logger,
} = {}) {
  async function registerToken(userId, role, input = {}) {
    const token = typeof input.token === 'string' ? input.token.trim() : '';
    if (token.length > 256 || !expoPushTokenPattern.test(token)) {
      throw new AppError(400, 'A valid Expo push token is required.', 'INVALID_PUSH_TOKEN');
    }

    const result = await users.updateOne(
      { _id: userId, role },
      { $addToSet: { pushTokens: token } }
    );
    if (result.matchedCount !== 1) {
      throw new AppError(404, 'Account was not found.', 'USER_NOT_FOUND');
    }
    return { registered: true };
  }

  async function unregisterToken(userId, role, input = {}) {
    const token = typeof input.token === 'string' ? input.token.trim() : '';
    if (token.length > 256 || !expoPushTokenPattern.test(token)) {
      throw new AppError(400, 'A valid Expo push token is required.', 'INVALID_PUSH_TOKEN');
    }

    const result = await users.updateOne(
      { _id: userId, role },
      { $pull: { pushTokens: token } }
    );
    if (result.matchedCount !== 1) {
      throw new AppError(404, 'Account was not found.', 'USER_NOT_FOUND');
    }
    return { registered: false };
  }

  async function notifyUser(userId, role, message, context = {}) {
    const user = await users.findOne({ _id: userId, role }).select('+pushTokens').lean();
    const tokens = [...new Set(user?.pushTokens || [])].filter((token) => expoPushTokenPattern.test(token));
    if (tokens.length === 0) return;

    const messages = tokens.map((token) => ({
      to: token,
      ...message,
    }));
    const response = await fetchImpl(expoPushEndpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Expo Push Service returned HTTP ${response.status}.`);
    const payload = await response.json();
    const tickets = Array.isArray(payload.data) ? payload.data : [];
    const invalidTokens = tickets.flatMap((ticket, index) => {
      if (ticket.status !== 'error') return [];
      if (ticket.details?.error === 'DeviceNotRegistered') return [tokens[index]];
      loggerImpl.warn({ error: ticket.details?.error || ticket.message, userId, ...context }, 'Expo rejected push notification');
      return [];
    }).filter(Boolean);

    if (invalidTokens.length > 0) {
      await users.updateOne(
        { _id: userId, role },
        { $pull: { pushTokens: { $in: invalidTokens } } }
      );
    }
  }

  async function sendNotification(userId, role, title, body, data, context = {}) {
    try {
      await notifyUser(userId, role, {
        title,
        body,
        sound: role === 'vendor' && data?.screen === 'vendor-orders' ? 'order_alert.wav' : 'default',
        channelId: role === 'vendor' ? 'orders' : undefined,
        priority: 'high',
        data,
      }, context);
    } catch (error) {
      loggerImpl.warn({ err: error, userId: String(userId), ...context }, 'Unable to send push notification');
    }
  }

  async function notifyVendorOrderCreated(vendorId, order) {
    const orderId = String(order._id || order.id);
    const capacity = Number(order.capacityLiters || order.capacity);
    await sendNotification(
      vendorId,
      'vendor',
      'New water order',
      `${Number.isFinite(capacity) ? `${capacity.toLocaleString('en-IN')} L tanker` : 'A tanker'} order is waiting for your response.`,
      { screen: 'vendor-orders', orderId },
      { vendorId: String(vendorId), orderId }
    );
  }

  async function notifyVendorOrderExpired(vendorId, order) {
    await sendNotification(vendorId, 'vendor', 'Booking request expired', 'The response window for this tanker booking has expired.', {
      screen: 'vendor-orders',
      orderId: String(order._id || order.id),
    }, { vendorId: String(vendorId), orderId: String(order._id || order.id) });
  }

  async function notifyVendorOrderCancelled(vendorId, order) {
    await sendNotification(vendorId, 'vendor', 'Booking request cancelled', 'This tanker booking is no longer waiting for your response.', {
      screen: 'vendor-orders',
      orderId: String(order._id || order.id),
    }, { vendorId: String(vendorId), orderId: String(order._id || order.id) });
  }

  async function notifyCustomer(customerId, title, body, order, status) {
    const orderId = String(order._id || order.id);
    await sendNotification(customerId, 'user', title, body, {
      screen: 'customer-orders',
      orderId,
      status,
    }, { customerId: String(customerId), orderId });
  }

  async function notifyCustomerBookingSubmitted(customerId, order) {
    await notifyCustomer(customerId, 'Booking request submitted', 'Your payment is confirmed. We are contacting nearby vendors one at a time.', order, order.status);
  }

  async function notifyCustomerBookingProcessing(customerId, order, vendorName) {
    const body = vendorName
      ? `${vendorName} has been asked to confirm your tanker booking.`
      : 'Your previous vendor declined. We are contacting the next nearby vendor.';
    await notifyCustomer(customerId, 'Finding a vendor', body, order, order.status);
  }

  async function notifyCustomerBookingConfirmed(customerId, order, vendorName) {
    await notifyCustomer(customerId, 'Booking confirmed', `${vendorName || 'A vendor'} accepted your tanker booking.`, order, 'approved');
  }

  async function notifyCustomerNoVendorAvailable(customerId, order) {
    await notifyCustomer(customerId, 'No vendor available', 'No nearby vendor accepted your booking. Your payment refund is being processed.', order, 'no_vendor_available');
  }

  async function notifyCustomerBookingCancelled(customerId, order) {
    await notifyCustomer(customerId, 'Booking cancelled', 'Your tanker booking has been cancelled.', order, 'cancelled');
  }

  return {
    registerVendorToken: (vendorId, input) => registerToken(vendorId, 'vendor', input),
    unregisterVendorToken: (vendorId, input) => unregisterToken(vendorId, 'vendor', input),
    registerCustomerToken: (customerId, input) => registerToken(customerId, 'user', input),
    unregisterCustomerToken: (customerId, input) => unregisterToken(customerId, 'user', input),
    notifyVendorOrderCreated,
    notifyVendorOrderExpired,
    notifyVendorOrderCancelled,
    notifyCustomerBookingSubmitted,
    notifyCustomerBookingProcessing,
    notifyCustomerBookingConfirmed,
    notifyCustomerNoVendorAvailable,
    notifyCustomerBookingCancelled,
  };
}

module.exports = { createPushNotificationService };
