const express = require('express');
const authenticate = require('../middleware/authenticate');
const { listVendors, setVendorApproval } = require('../controllers/adminController');

const router = express.Router();
const requireAdmin = authenticate.requireRole('admin');

router.use(authenticate, requireAdmin);
router.get('/vendors', listVendors);
router.patch('/vendors/:id/approval', setVendorApproval);

module.exports = router;
