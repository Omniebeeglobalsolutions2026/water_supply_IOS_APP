const assert = require('node:assert/strict');
const { before, test } = require('node:test');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'waterflow-test-secret-at-least-32-bytes';

const { createAuthService } = require('../src/services/authService');

before(() => {
  process.env.NODE_ENV = 'test';
});

function makeService({ existingUsers = [] } = {}) {
  const users = {
    findByEmail: async (email) => existingUsers.find((user) => user.email === email) || null,
    create: async (data) => ({ _id: 'user-test-id', ...data }),
  };

  return createAuthService({
    users,
    hashPassword: async (password) => `hashed:${password}`,
    comparePassword: async (password, hash) => hash === `hashed:${password}`,
    signToken: (payload) => `signed:${payload.sub}`,
  });
}

function validVendorDetails(overrides = {}) {
  const image = {
    name: 'document.jpg',
    mimeType: 'image/jpeg',
    data: 'data:image/jpeg;base64,aGVsbG8=',
  };
  return {
    name: 'Vendor One',
    phone: '+1 555 010 2222',
    email: 'vendor@example.test',
    password: 'a-secure-password',
    role: 'vendor',
    businessName: 'Clear Water Co',
    vendorLocation: { address: '12 Water Street, Bengaluru', latitude: 12.9, longitude: 77.6 },
    vendorRadiusKm: 2,
    vendorServiceType: 'water_tanker',
    bankDetails: { bankName: 'Example Bank', ifscCode: 'ABCD0123456' },
    onboardingDocuments: { govtIdProof: image, bankPassbook: image },
    ...overrides,
  };
}

test('register normalizes email and creates a customer account by default', async () => {
  const service = makeService();
  const result = await service.register({
    name: 'Customer One',
    phone: '+1 555 010 1111',
    email: '  CUSTOMER@example.test ',
    password: 'a-secure-password',
  });

  assert.equal(result.user.email, 'customer@example.test');
  assert.equal(result.user.role, 'user');
  assert.equal(result.token, 'signed:user-test-id');
});

test('vendor registration is pending and does not issue a session token', async () => {
  const service = makeService();
  const result = await service.register(validVendorDetails());

  assert.equal(result.user.role, 'vendor');
  assert.equal(result.user.businessName, 'Clear Water Co');
  assert.equal(result.user.approvalStatus, 'pending');
  assert.equal(result.status, 'pending');
  assert.equal(result.token, undefined);
});

test('vendor registration saves location, service, bank information, and document uploads', async () => {
  let created;
  const service = createAuthService({
    users: {
      findByEmail: async () => null,
      create: async (data) => {
        created = data;
        return { _id: 'vendor-id', ...data };
      },
    },
    hashPassword: async (password) => `hashed:${password}`,
    signToken: (payload) => `signed:${payload.sub}`,
  });

  await service.register(validVendorDetails());
  assert.deepEqual(created.vendorLocation, {
    type: 'Point',
    coordinates: [77.6, 12.9],
    address: '12 Water Street, Bengaluru',
  });
  assert.equal(created.vendorRadiusKm, 2);
  assert.equal(created.vendorServiceType, 'water_tanker');
  assert.equal(created.bankDetails.ifscCode, 'ABCD0123456');
  assert.equal(created.onboardingDocuments.govtIdProof.data, 'data:image/jpeg;base64,aGVsbG8=');
});

test('vendor registration rejects an address without coordinates or required documents', async () => {
  const service = makeService();
  await assert.rejects(
    service.register(validVendorDetails({ vendorLocation: { address: 'Bengaluru' } })),
    (error) => error.statusCode === 400 && error.code === 'INVALID_VENDOR_LOCATION'
  );
  await assert.rejects(
    service.register(validVendorDetails({ onboardingDocuments: {} })),
    (error) => error.statusCode === 400 && error.code === 'INVALID_VENDOR_DOCUMENTS'
  );
});

test('public registration cannot create admin accounts', async () => {
  const service = makeService();
  await assert.rejects(
    service.register({
      name: 'Platform Admin',
      phone: '+1 555 010 2222',
      email: 'admin@example.test',
      password: 'a-secure-password',
      role: 'admin',
    }),
    (error) => error.statusCode === 400 && error.code === 'INVALID_ROLE'
  );
});

test('register rejects vendor accounts without business details', async () => {
  const service = makeService();
  await assert.rejects(
    service.register({
      name: 'Vendor One',
      phone: '+1 555 010 2222',
      email: 'vendor@example.test',
      password: 'a-secure-password',
      role: 'vendor',
    }),
    (error) => error.statusCode === 400 && error.code === 'INVALID_BUSINESS_NAME'
  );
});

test('login rejects an account with the wrong password', async () => {
  const service = makeService({
    existingUsers: [{ _id: 'user-test-id', email: 'customer@example.test', role: 'user', passwordHash: 'hashed:correct-password' }],
  });

  await assert.rejects(
    service.login({ email: 'customer@example.test', password: 'wrong-password', role: 'user' }),
    (error) => error.statusCode === 401
  );
});

test('login blocks a vendor until admin approval', async () => {
  const service = makeService({
    existingUsers: [{
      _id: 'vendor-test-id',
      email: 'vendor@example.test',
      role: 'vendor',
      approvalStatus: 'pending',
      passwordHash: 'hashed:correct-password',
    }],
  });

  await assert.rejects(
    service.login({ email: 'vendor@example.test', password: 'correct-password', role: 'vendor' }),
    (error) => error.statusCode === 403 && error.code === 'VENDOR_PENDING'
  );
});

test('login gives rejected vendors a clear status', async () => {
  const service = makeService({
    existingUsers: [{
      _id: 'vendor-test-id',
      email: 'vendor@example.test',
      role: 'vendor',
      approvalStatus: 'rejected',
      passwordHash: 'hashed:correct-password',
    }],
  });

  await assert.rejects(
    service.login({ email: 'vendor@example.test', password: 'correct-password', role: 'vendor' }),
    (error) => error.statusCode === 403 && error.code === 'VENDOR_REJECTED'
  );
});

test('approved vendors can log in', async () => {
  const service = makeService({
    existingUsers: [{
      _id: 'vendor-test-id',
      email: 'vendor@example.test',
      role: 'vendor',
      approvalStatus: 'approved',
      passwordHash: 'hashed:correct-password',
    }],
  });

  const result = await service.login({
    email: 'vendor@example.test',
    password: 'correct-password',
    role: 'vendor',
  });
  assert.equal(result.token, 'signed:vendor-test-id');
  assert.equal(result.user.approvalStatus, 'approved');
});

test('provisioned admin accounts can log in', async () => {
  const service = makeService({
    existingUsers: [{
      _id: 'admin-test-id',
      email: 'admin@example.test',
      role: 'admin',
      approvalStatus: 'approved',
      passwordHash: 'hashed:correct-password',
    }],
  });

  const result = await service.login({
    email: 'admin@example.test',
    password: 'correct-password',
    role: 'admin',
  });
  assert.equal(result.token, 'signed:admin-test-id');
  assert.equal(result.user.role, 'admin');
});

test('login without role automatically identifies customer or vendor', async () => {
  const service = makeService({
    existingUsers: [
      {
        _id: 'user-1',
        email: 'customer@example.test',
        role: 'user',
        passwordHash: 'hashed:user-pass',
      },
      {
        _id: 'vendor-1',
        email: 'vendor@example.test',
        role: 'vendor',
        approvalStatus: 'approved',
        passwordHash: 'hashed:vendor-pass',
      },
    ],
  });

  const userLogin = await service.login({
    email: 'customer@example.test',
    password: 'user-pass',
  });
  assert.equal(userLogin.user.role, 'user');
  assert.equal(userLogin.token, 'signed:user-1');

  const vendorLogin = await service.login({
    email: 'vendor@example.test',
    password: 'vendor-pass',
  });
  assert.equal(vendorLogin.user.role, 'vendor');
  assert.equal(vendorLogin.token, 'signed:vendor-1');
});