const crypto = require('node:crypto');
const mongoose = require('mongoose');
const AppError = require('../errors/AppError');
const config = require('../config/env');
const User = require('../models/User');
const Order = require('../models/Order');
const PaymentAttempt = require('../models/PaymentAttempt');
const PlatformSetting = require('../models/PlatformSetting');
const logger = require('../config/logger');
const pushNotificationService = require('./pushNotificationService').createPushNotificationService();
const defaultVendorService = require('./vendorService');
const defaultAssignmentService = require('./vendorAssignmentService');

const razorpayApiBase = 'https://api.razorpay.com/v1';
const defaultNearbyRadiusKm = 10;

function createPaymentService({
  users = User,
  orders = Order,
  payments = PaymentAttempt,
  settings = PlatformSetting,
  notifications = pushNotificationService,
  vendorService = defaultVendorService,
  assignmentService = defaultAssignmentService,
  credentials = config.razorpay,
  fetchImpl = globalThis.fetch,
} = {}) {
  function requireCredentials() {
    if (!credentials.keyId || !credentials.keySecret) {
      throw new AppError(503, 'Online payments are not configured. Add Razorpay test keys to the API environment.', 'PAYMENTS_NOT_CONFIGURED');
    }
  }

  async function razorpayRequest(path, { method = 'GET', body } = {}) {
    const authorization = Buffer.from(`${credentials.keyId}:${credentials.keySecret}`).toString('base64');
    let response;
    try {
      response = await fetchImpl(`${razorpayApiBase}${path}`, {
        method,
        headers: {
          Authorization: `Basic ${authorization}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(15000),
      });
    } catch (error) {
      throw new AppError(502, `Unable to reach Razorpay: ${error.message || 'connection failed'}. Please try again.`, 'RAZORPAY_UNAVAILABLE');
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new AppError(
          502,
          'Razorpay rejected the API credentials. Verify the key ID and secret are a matching pair from the same Razorpay mode.',
          'RAZORPAY_AUTHENTICATION_FAILED'
        );
      }
      if (response.status === 400) {
        throw new AppError(
          502,
          'Razorpay rejected the order details. Check that the selected tank price is valid and try again.',
          'RAZORPAY_INVALID_ORDER_REQUEST'
        );
      }
      throw new AppError(502, 'Razorpay could not process the payment request. Please try again.', 'RAZORPAY_REQUEST_FAILED');
    }
    return payload;
  }

  async function createCheckoutOrder(customer, input = {}) {
    requireCredentials();
    const deliveryAddress = typeof input.deliveryAddress === 'string' ? input.deliveryAddress.trim() : '';
    const deliveryDate = typeof input.deliveryDate === 'string' ? input.deliveryDate.trim() : '';
    const deliveryTime = typeof input.deliveryTime === 'string' ? input.deliveryTime.trim() : '';
    const latitude = input.latitude;
    const longitude = input.longitude;

    if (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90
      || typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new AppError(400, 'Choose a valid delivery location before payment.', 'INVALID_COORDINATES');
    }
    if (deliveryAddress.length < 5 || deliveryAddress.length > 500
      || deliveryDate.length < 1 || deliveryDate.length > 40
      || deliveryTime.length < 1 || deliveryTime.length > 60) {
      throw new AppError(400, 'Enter a valid delivery address, date, and time.', 'INVALID_DELIVERY_DETAILS');
    }

    let vendor;
    let tank;
    let eligibleVendors = [];
    let displayedPrice;
    const capacityLiters = Number(input.capacityLiters);
    if (Number.isFinite(capacityLiters) && !input.tankId) {
      if (capacityLiters < 1 || capacityLiters > 1000000) {
        throw new AppError(400, 'Choose a valid tanker capacity.', 'INVALID_ORDER_SELECTION');
      }
      const variants = await vendorService.findNearby({ latitude, longitude });
      const variant = variants.find((item) => Number(item.capacityLiters) === capacityLiters);
      if (!variant || !Array.isArray(variant.vendors) || variant.vendors.length === 0) {
        throw new AppError(409, 'This tanker variant is no longer available nearby. Refresh the available tanks.', 'OFFER_UNAVAILABLE');
      }
      displayedPrice = Number(variant.displayedPrice);
      if (!Number.isFinite(Number(input.displayedPrice))
        || Math.round(Number(input.displayedPrice) * 100) !== Math.round(displayedPrice * 100)) {
        throw new AppError(409, 'The price changed since this offer was displayed. Review the updated price before paying.', 'OFFER_PRICE_CHANGED');
      }
      eligibleVendors = variant.vendors.map((candidate) => ({
        vendor: candidate.vendorId,
        vendorName: candidate.vendorName,
        tankId: candidate.tankId,
        tankName: candidate.tankName,
        capacityLiters,
        waterSource: candidate.waterSource,
        price: Number(candidate.price),
        distanceKm: Number(candidate.distanceKm),
      }));
      vendor = { _id: eligibleVendors[0].vendor, businessName: eligibleVendors[0].vendorName, name: eligibleVendors[0].vendorName };
      tank = { _id: eligibleVendors[0].tankId, name: variant.name, capacityLiters, waterSource: eligibleVendors[0].waterSource };
    } else {
      const vendorId = typeof input.vendorId === 'string' ? input.vendorId : '';
      const tankId = typeof input.tankId === 'string' ? input.tankId : '';
      if (!mongoose.Types.ObjectId.isValid(vendorId) || !mongoose.Types.ObjectId.isValid(tankId)) {
        throw new AppError(400, 'Choose a valid vendor and tank listing.', 'INVALID_ORDER_SELECTION');
      }
      vendor = await users.findOne({
        _id: vendorId,
        role: 'vendor',
        approvalStatus: 'approved',
        workMode: { $ne: false },
        inventory: { $elemMatch: { _id: tankId, available: { $ne: false } } },
      }).select('_id businessName name vendorLocation inventory');
      tank = vendor?.inventory?.id(tankId);
      if (!vendor || !tank || tank.available === false) {
        throw new AppError(409, 'This vendor or tank is no longer available. Refresh nearby offers and choose another.', 'OFFER_UNAVAILABLE');
      }
      const radiusSetting = await settings.findOne({ key: 'nearby_search_radius_km' }).select('value').lean();
      const configuredRadiusKm = radiusSetting?.value ?? defaultNearbyRadiusKm;
      if (!Number.isFinite(configuredRadiusKm) || configuredRadiusKm < 1 || configuredRadiusKm > 100) {
        throw new AppError(500, 'The nearby search radius setting is invalid.', 'INVALID_NEARBY_RADIUS_SETTING');
      }
      const [vendorLongitude, vendorLatitude] = vendor.vendorLocation?.coordinates || [];
      if (!Number.isFinite(vendorLatitude) || !Number.isFinite(vendorLongitude)
        || distanceInKilometers(latitude, longitude, vendorLatitude, vendorLongitude) > Math.min(configuredRadiusKm, defaultNearbyRadiusKm)) {
        throw new AppError(409, 'This vendor is outside the current nearby search radius. Refresh the available tanks.', 'OFFER_OUTSIDE_RADIUS');
      }
      displayedPrice = Number(tank.price);
    }

    const amount = Math.round(displayedPrice * 100);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new AppError(409, 'This tank has an invalid payment amount. Choose another listing.', 'INVALID_PAYMENT_AMOUNT');
    }

    const receipt = `wf_${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`;
    const razorpayOrder = await razorpayRequest('/orders', {
      method: 'POST',
      body: {
        amount,
        currency: 'INR',
        receipt,
        notes: {
          customerId: String(customer._id),
          vendorId: String(vendor._id),
          tankId: String(tank._id),
          capacityLiters: String(capacityLiters || tank.capacityLiters),
        },
      },
    });
    if (typeof razorpayOrder.id !== 'string' || razorpayOrder.amount !== amount || razorpayOrder.currency !== 'INR') {
      throw new AppError(502, 'Razorpay returned an invalid checkout order.', 'INVALID_RAZORPAY_ORDER');
    }

    await payments.create({
      customer: customer._id,
      vendor: vendor._id,
      tankId: tank._id,
      tankName: tank.name,
      capacityLiters: tank.capacityLiters,
      waterSource: tank.waterSource,
      vendorName: vendor.businessName || vendor.name,
      deliveryAddress,
      deliveryDate,
      deliveryTime,
      deliveryCoordinates: { type: 'Point', coordinates: [longitude, latitude] },
      displayedPrice,
      eligibleVendors,
      amount: amount / 100,
      razorpayOrderId: razorpayOrder.id,
      status: 'created',
    });

    return {
      keyId: credentials.keyId,
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
      },
      customer: {
        name: customer.name || '',
        email: customer.email || '',
        contact: customer.phone || '',
      },
      tank: { name: tank.name, capacityLiters: tank.capacityLiters },
      vendorName: eligibleVendors.length > 0
        ? 'The nearest available vendor will be contacted first'
        : vendor.businessName || vendor.name,
    };
  }

  function verifyCheckoutSignature(orderId, paymentId, signature) {
    if (typeof orderId !== 'string' || typeof paymentId !== 'string'
      || typeof signature !== 'string' || !/^[a-f\d]{64}$/i.test(signature)) {
      throw new AppError(400, 'Razorpay returned incomplete payment details.', 'INVALID_PAYMENT_SIGNATURE');
    }
    const expected = crypto
      .createHmac('sha256', credentials.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest();
    const actual = Buffer.from(signature, 'hex');
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
      throw new AppError(400, 'Payment verification failed. Do not retry if your bank shows a debit; contact support.', 'PAYMENT_VERIFICATION_FAILED');
    }
  }

  async function completeRefund(order, refundId) {
    const refunded = await orders.updateOne(
      {
        _id: order._id,
        status: { $in: ['no_vendor_available', 'cancelled'] },
        paymentStatus: 'refund_pending',
        refundLockToken: order.refundLockToken,
      },
      {
        $set: { paymentStatus: 'refunded', razorpayRefundId: refundId },
        $unset: { refundLockToken: 1, refundLockUntil: 1 },
      }
    );
    if (refunded.modifiedCount === 1) {
      await payments.updateOne(
        { orderId: order._id },
        { $set: { status: 'refunded', razorpayRefundId: refundId } }
      );
    }
  }

  async function refundOrder(order) {
    if (!order?.razorpayPaymentId || !['paid', 'refund_pending'].includes(order.paymentStatus)) return;
    const lockToken = crypto.randomUUID();
    const currentTime = new Date();
    const claimedOrder = await orders.findOneAndUpdate(
      {
        _id: order._id,
        status: { $in: ['no_vendor_available', 'cancelled'] },
        paymentStatus: { $in: ['paid', 'refund_pending'] },
        razorpayPaymentId: order.razorpayPaymentId,
        $or: [
          { refundLockUntil: { $exists: false } },
          { refundLockUntil: null },
          { refundLockUntil: { $lte: currentTime } },
        ],
      },
      {
        $set: {
          paymentStatus: 'refund_pending',
          refundReceipt: order.refundReceipt || `wf_refund_${String(order._id)}`,
          refundLockToken: lockToken,
          refundLockUntil: new Date(currentTime.getTime() + 60000),
        },
      },
      { new: true }
    ).lean();
    if (!claimedOrder) return;

    try {
      const refunds = await razorpayRequest(`/payments/${encodeURIComponent(claimedOrder.razorpayPaymentId)}/refunds`);
      const matchingRefund = (refunds.items || []).find((refund) => refund.receipt === claimedOrder.refundReceipt);
      if (matchingRefund) {
        if (matchingRefund.status === 'processed') await completeRefund(claimedOrder, matchingRefund.id);
        return;
      }

      const refund = await razorpayRequest(`/payments/${encodeURIComponent(claimedOrder.razorpayPaymentId)}/refund`, {
        method: 'POST',
        body: {
          amount: Math.round(claimedOrder.amount * 100),
          receipt: claimedOrder.refundReceipt,
          notes: {
            orderId: String(claimedOrder._id),
            reason: claimedOrder.status === 'cancelled'
              ? 'Customer cancelled the booking.'
              : 'No eligible vendor accepted the booking.',
          },
        },
      });
      if (refund.status === 'processed') await completeRefund(claimedOrder, refund.id);
      else if (refund.id) {
        await orders.updateOne(
          { _id: claimedOrder._id, paymentStatus: 'refund_pending', refundLockToken: lockToken },
          { $set: { razorpayRefundId: refund.id } }
        );
        await payments.updateOne(
          { orderId: claimedOrder._id },
          { $set: { status: 'refund_pending', razorpayRefundId: refund.id } }
        );
      }
    } finally {
      await orders.updateOne(
        { _id: claimedOrder._id, refundLockToken: lockToken },
        { $unset: { refundLockToken: 1, refundLockUntil: 1 } }
      );
    }
  }

  if (typeof assignmentService.setNoVendorAvailableHandler === 'function') {
    assignmentService.setNoVendorAvailableHandler(refundOrder);
  }

  async function processPendingRefunds() {
    const pendingOrders = await orders.find({
      status: { $in: ['no_vendor_available', 'cancelled'] },
      paymentStatus: { $in: ['paid', 'refund_pending'] },
      razorpayPaymentId: { $exists: true, $ne: null },
    }).select('_id amount paymentStatus razorpayPaymentId refundReceipt').limit(50).lean();
    for (const order of pendingOrders) {
      try {
        await refundOrder(order);
      } catch (error) {
        logger.warn({ err: error, orderId: String(order._id) }, 'Unable to process booking refund; it will be retried');
      }
    }
  }

  async function finalizeCapturedPayment(attempt, paymentId) {
    const existing = await orders.findOne({ razorpayOrderId: attempt.razorpayOrderId }).lean();
    if (existing) {
      await payments.updateOne(
        { _id: attempt._id },
        { $set: { status: 'paid', razorpayPaymentId: paymentId, orderId: existing._id } }
      );
      if (existing.status === 'waiting_for_vendor' && existing.assignmentState === 'ready') {
        await assignmentService.processOrder(existing._id);
      }
      const current = await orders.findById(existing._id).lean();
      return serializePaidOrder(current || existing);
    }

    try {
      if (Array.isArray(attempt.eligibleVendors) && attempt.eligibleVendors.length > 0) {
        const order = await orders.create({
          customer: attempt.customer,
          vendor: null,
          tankId: attempt.eligibleVendors[0].tankId,
          tankName: attempt.tankName,
          capacityLiters: attempt.capacityLiters,
          waterSource: attempt.waterSource,
          amount: attempt.amount,
          displayedPrice: attempt.displayedPrice || attempt.amount,
          deliveryCoordinates: attempt.deliveryCoordinates,
          eligibleVendors: attempt.eligibleVendors,
          nextVendorIndex: 0,
          assignmentState: 'ready',
          status: 'waiting_for_vendor',
          deliveryAddress: attempt.deliveryAddress,
          deliveryDate: attempt.deliveryDate,
          deliveryTime: attempt.deliveryTime,
          paymentStatus: 'paid',
          razorpayOrderId: attempt.razorpayOrderId,
          razorpayPaymentId: paymentId,
        });
        await payments.updateOne(
          { _id: attempt._id },
          { $set: { status: 'paid', razorpayPaymentId: paymentId, orderId: order._id } }
        );
        await notifications.notifyCustomerBookingSubmitted?.(attempt.customer, order);
        await assignmentService.startAssignment(order._id);
        const current = await orders.findById(order._id).lean();
        return serializePaidOrder(current || order);
      }

      const order = await orders.create({
        customer: attempt.customer,
        vendor: attempt.vendor,
        vendorName: attempt.vendorName,
        tankId: attempt.tankId,
        tankName: attempt.tankName,
        capacityLiters: attempt.capacityLiters,
        waterSource: attempt.waterSource,
        amount: attempt.amount,
        deliveryAddress: attempt.deliveryAddress,
        deliveryDate: attempt.deliveryDate,
        deliveryTime: attempt.deliveryTime,
        paymentStatus: 'paid',
        razorpayOrderId: attempt.razorpayOrderId,
        razorpayPaymentId: paymentId,
      });
      await payments.updateOne(
        { _id: attempt._id },
        { $set: { status: 'paid', razorpayPaymentId: paymentId, orderId: order._id } }
      );
      Promise.resolve()
        .then(() => notifications.notifyVendorOrderCreated(order.vendor, order))
        .catch((notificationError) => logger.warn(
          { err: notificationError, vendorId: String(order.vendor), orderId: String(order._id) },
          'Unable to queue vendor order notification'
        ));
      return serializePaidOrder(order);
    } catch (error) {
      if (error.code !== 11000) throw error;
      const order = await orders.findOne({ razorpayOrderId: attempt.razorpayOrderId }).lean();
      if (!order) throw error;
      await payments.updateOne(
        { _id: attempt._id },
        { $set: { status: 'paid', razorpayPaymentId: paymentId, orderId: order._id } }
      );
      return serializePaidOrder(order);
    }
  }

  async function verifyAndCompletePayment(customerId, input = {}) {
    requireCredentials();
    const orderId = input.razorpay_order_id;
    const paymentId = input.razorpay_payment_id;
    verifyCheckoutSignature(orderId, paymentId, input.razorpay_signature);

    const attempt = await payments.findOne({ customer: customerId, razorpayOrderId: orderId }).lean();
    if (!attempt) throw new AppError(404, 'Checkout order was not found for this account.', 'PAYMENT_ORDER_NOT_FOUND');
    if (attempt.status === 'paid' && attempt.orderId) {
      const existing = await orders.findById(attempt.orderId).lean();
      if (existing) {
        if (existing.status === 'waiting_for_vendor' && existing.assignmentState === 'ready') {
          await assignmentService.processOrder(existing._id);
          const current = await orders.findById(existing._id).lean();
          return { order: serializePaidOrder(current || existing) };
        }
        return { order: serializePaidOrder(existing) };
      }
    }

    const payment = await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`);
    if (payment.order_id !== orderId || payment.amount !== Math.round(attempt.amount * 100) || payment.currency !== 'INR') {
      throw new AppError(400, 'The Razorpay payment does not match this order.', 'PAYMENT_ORDER_MISMATCH');
    }

    let capturedPayment = payment;
    if (payment.status === 'authorized') {
      try {
        capturedPayment = await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}/capture`, {
          method: 'POST',
          body: { amount: payment.amount, currency: payment.currency },
        });
      } catch (error) {
        const latestPayment = await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`);
        if (latestPayment.status !== 'captured') throw error;
        capturedPayment = latestPayment;
      }
    }
    if (capturedPayment.status !== 'captured') {
      throw new AppError(409, 'Payment has not been captured yet. Please wait a moment and retry verification.', 'PAYMENT_NOT_CAPTURED');
    }

    return { order: await finalizeCapturedPayment(attempt, paymentId) };
  }

  async function handleWebhook(rawBody, signature) {
    if (!credentials.webhookSecret) {
      throw new AppError(503, 'Razorpay webhook verification is not configured.', 'WEBHOOK_NOT_CONFIGURED');
    }
    if (!Buffer.isBuffer(rawBody) || typeof signature !== 'string' || !/^[a-f\d]{64}$/i.test(signature)) {
      throw new AppError(400, 'Invalid Razorpay webhook signature.', 'INVALID_WEBHOOK_SIGNATURE');
    }
    const expected = crypto.createHmac('sha256', credentials.webhookSecret).update(rawBody).digest();
    const actual = Buffer.from(signature, 'hex');
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
      throw new AppError(400, 'Invalid Razorpay webhook signature.', 'INVALID_WEBHOOK_SIGNATURE');
    }
    let event;
    try {
      event = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new AppError(400, 'Invalid Razorpay webhook payload.', 'INVALID_WEBHOOK_PAYLOAD');
    }

    if (event.event === 'payment.captured') {
      const payment = event.payload?.payment?.entity;
      if (!payment?.order_id || !payment?.id) {
        throw new AppError(400, 'Razorpay webhook is missing payment details.', 'INVALID_WEBHOOK_PAYLOAD');
      }
      const attempt = await payments.findOne({ razorpayOrderId: payment.order_id }).lean();
      if (!attempt) throw new AppError(503, 'Payment order is not yet available for webhook processing.', 'PAYMENT_ORDER_NOT_READY');
      if (payment.amount !== Math.round(attempt.amount * 100) || payment.currency !== 'INR') {
        throw new AppError(400, 'Razorpay webhook payment does not match the order.', 'PAYMENT_ORDER_MISMATCH');
      }
      await finalizeCapturedPayment(attempt, payment.id);
    }
    return { received: true };
  }

  return { createCheckoutOrder, verifyAndCompletePayment, handleWebhook, processPendingRefunds, refundOrder };
}

function serializePaidOrder(order) {
  return {
    id: String(order._id),
    vendorId: order.vendor ? String(order.vendor) : null,
    vendorName: order.vendorName || (order.status === 'waiting_for_vendor' ? 'Finding a vendor' : ''),
    tankName: order.tankName,
    capacityLiters: order.capacityLiters,
    amount: order.amount,
    deliveryAddress: order.deliveryAddress,
    deliveryDate: order.deliveryDate,
    deliveryTime: order.deliveryTime,
    status: order.status,
    paymentStatus: order.paymentStatus,
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
    razorpayOrderId: order.razorpayOrderId,
    razorpayPaymentId: order.razorpayPaymentId,
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

module.exports = { createPaymentService };
