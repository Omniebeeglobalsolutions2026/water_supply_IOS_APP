const AppError = require('../errors/AppError');
const userRepository = require('../repositories/userRepository');

const approvalStatuses = new Set(['pending', 'approved', 'rejected', 'all']);

function createAdminService({ users = userRepository, pageSize = 100 } = {}) {
  async function listVendors(status = 'pending', page = 1) {
    if (!approvalStatuses.has(status)) {
      throw new AppError(400, 'Choose pending, approved, rejected, or all vendors.', 'INVALID_VENDOR_STATUS');
    }
    if (!Number.isInteger(page) || page < 1 || page > 10000) {
      throw new AppError(400, 'Page must be a positive integer.', 'INVALID_PAGE');
    }

    const { vendors, total } = await users.findVendors(status, {
      skip: (page - 1) * pageSize,
      limit: pageSize,
    });
    return {
      vendors: vendors.map((vendor) => ({
        id: String(vendor._id || vendor.id),
        name: vendor.name,
        phone: vendor.phone,
        email: vendor.email,
        businessName: vendor.businessName,
        approvalStatus: vendor.approvalStatus || 'pending',
        createdAt: vendor.createdAt,
      })),
      pagination: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
    };
  }

  async function setVendorApproval(id, decision) {
    const approvalStatus = decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : null;
    if (!approvalStatus) {
      throw new AppError(400, 'Choose approve or reject.', 'INVALID_VENDOR_DECISION');
    }
    const vendor = await users.updateVendorApproval(id, approvalStatus);
    if (!vendor) {
      throw new AppError(404, 'Vendor application was not found.', 'VENDOR_NOT_FOUND');
    }
    return {
      id: String(vendor._id || vendor.id),
      name: vendor.name,
      phone: vendor.phone,
      email: vendor.email,
      businessName: vendor.businessName,
      approvalStatus: vendor.approvalStatus,
      createdAt: vendor.createdAt,
    };
  }

  return { listVendors, setVendorApproval };
}

const adminService = createAdminService();
adminService.createAdminService = createAdminService;

module.exports = adminService;
