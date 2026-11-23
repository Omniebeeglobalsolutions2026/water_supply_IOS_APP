const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createAdminService } = require('../src/services/adminService');

function makeService({ vendors = [] } = {}) {
  let updatedVendor;
  const service = createAdminService({
    users: {
      findVendors: async (status) => ({
        vendors: status === 'all'
          ? vendors
          : vendors.filter((vendor) => vendor.approvalStatus === status),
        total: status === 'all' ? vendors.length : vendors.filter((vendor) => vendor.approvalStatus === status).length,
      }),
      updateVendorApproval: async (id, approvalStatus) => {
        const vendor = vendors.find((item) => String(item._id) === id);
        if (!vendor) return null;
        updatedVendor = { ...vendor, approvalStatus };
        return updatedVendor;
      },
    },
  });
  return { service, getUpdatedVendor: () => updatedVendor };
}

test('admin service lists pending vendor applications without sensitive fields', async () => {
  const { service } = makeService({
    vendors: [{
      _id: 'vendor-1',
      name: 'Vendor One',
      phone: '+1 555 010 2222',
      email: 'vendor@example.test',
      businessName: 'Clear Water Co',
      approvalStatus: 'pending',
      passwordHash: 'must-not-leak',
    }],
  });

  const result = await service.listVendors();
  assert.equal(result.vendors.length, 1);
  assert.equal(result.vendors[0].approvalStatus, 'pending');
  assert.equal('passwordHash' in result.vendors[0], false);
  assert.deepEqual(result.pagination, { page: 1, pageSize: 100, total: 1, pageCount: 1 });
});

test('admin service changes the vendor approval status', async () => {
  const { service, getUpdatedVendor } = makeService({
    vendors: [{ _id: 'vendor-1', name: 'Vendor One', approvalStatus: 'pending' }],
  });

  const vendor = await service.setVendorApproval('vendor-1', 'approve');
  assert.equal(vendor.approvalStatus, 'approved');
  assert.equal(getUpdatedVendor().approvalStatus, 'approved');
});

test('admin service rejects unsupported status and decisions', async () => {
  const { service } = makeService();
  await assert.rejects(
    service.listVendors('unknown'),
    (error) => error.statusCode === 400 && error.code === 'INVALID_VENDOR_STATUS'
  );
  await assert.rejects(
    service.setVendorApproval('vendor-1', 'maybe'),
    (error) => error.statusCode === 400 && error.code === 'INVALID_VENDOR_DECISION'
  );
});

test('admin service reports unknown vendors', async () => {
  const { service } = makeService();
  await assert.rejects(
    service.setVendorApproval('missing', 'reject'),
    (error) => error.statusCode === 404 && error.code === 'VENDOR_NOT_FOUND'
  );
});

test('admin service rejects invalid page numbers', async () => {
  const { service } = makeService();
  await assert.rejects(
    service.listVendors('pending', 0),
    (error) => error.statusCode === 400 && error.code === 'INVALID_PAGE'
  );
});

test('admin service calculates page offsets and returns pagination metadata', async () => {
  let query;
  const service = createAdminService({
    pageSize: 2,
    users: {
      findVendors: async (status, options) => {
        query = { status, ...options };
        return { vendors: [], total: 5 };
      },
    },
  });

  const result = await service.listVendors('all', 3);

  assert.deepEqual(query, { status: 'all', skip: 4, limit: 2 });
  assert.deepEqual(result.pagination, { page: 3, pageSize: 2, total: 5, pageCount: 3 });
});
