const adminService = require('../services/adminService');

async function listVendors(req, res, next) {
  try {
    const page = req.query.page === undefined ? 1 : Number(req.query.page);
    const result = await adminService.listVendors(req.query.status || 'pending', page);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function setVendorApproval(req, res, next) {
  try {
    const vendor = await adminService.setVendorApproval(req.params.id, req.body?.decision);
    return res.json({ vendor });
  } catch (error) {
    return next(error);
  }
}

module.exports = { listVendors, setVendorApproval };
