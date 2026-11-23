const express = require('express');
const authenticate = require('../middleware/authenticate');
const vendorController = require('../controllers/vendorController');

const router = express.Router();
const requireVendor = authenticate.requireRole('vendor');

router.get('/vendors/nearby', vendorController.findNearby);
router.post('/orders', authenticate, authenticate.requireRole('user'), vendorController.createOrder);
router.get('/orders', authenticate, authenticate.requireRole('user'), vendorController.listCustomerOrders);
router.delete('/orders/:orderId', authenticate, authenticate.requireRole('user'), vendorController.cancelCustomerOrder);
router.put('/user/push-token', authenticate, authenticate.requireRole('user'), vendorController.registerCustomerPushToken);
router.delete('/user/push-token', authenticate, authenticate.requireRole('user'), vendorController.unregisterCustomerPushToken);
router.use('/vendor', authenticate, requireVendor);
router.get('/vendor/profile', vendorController.getProfile);
router.put('/vendor/push-token', vendorController.registerPushToken);
router.delete('/vendor/push-token', vendorController.unregisterPushToken);
router.put('/vendor/location', vendorController.updateLocation);
router.patch('/vendor/work-mode', vendorController.setWorkMode);
router.post('/vendor/inventory', vendorController.addTank);
router.patch('/vendor/inventory/:tankId', vendorController.updateTank);
router.delete('/vendor/inventory/:tankId', vendorController.deleteTank);
router.get('/vendor/orders', vendorController.listOrders);
router.patch('/vendor/orders/:orderId/status', vendorController.updateOrderStatus);
router.get('/vendor/dashboard', vendorController.getDashboard);

module.exports = router;
