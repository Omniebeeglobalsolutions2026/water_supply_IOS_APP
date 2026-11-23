const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const AppError = require('../errors/AppError');
const config = require('../config/env');
const userRepository = require('../repositories/userRepository');

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[\d\s()-]{7,20}$/;
const accountRoles = new Set(['user', 'vendor', 'admin']);
const registrationRoles = new Set(['user', 'vendor']);
const vendorRadiusOptions = new Set([2, 5, 10]);
const vendorServiceOptions = new Set(['water_tanker', 'other']);
const allowedDocumentTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function validateVendorOnboarding(input) {
  const location = input.vendorLocation || {};
  const address = typeof location.address === 'string' ? location.address.trim() : '';
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  if (address.length < 3 || address.length > 300
    || !Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new AppError(400, 'Choose a valid business address from the location suggestions.', 'INVALID_VENDOR_LOCATION');
  }

  const vendorRadiusKm = Number(input.vendorRadiusKm);
  if (!vendorRadiusOptions.has(vendorRadiusKm)) {
    throw new AppError(400, 'Choose a radius of 2, 5, or 10 kilometers.', 'INVALID_VENDOR_RADIUS');
  }

  const vendorServiceType = input.vendorServiceType;
  if (!vendorServiceOptions.has(vendorServiceType)) {
    throw new AppError(400, 'Choose the service you provide.', 'INVALID_VENDOR_SERVICE');
  }

  const onboardingDocuments = {};
  for (const field of ['govtIdProof', 'bankPassbook']) {
    const document = input.onboardingDocuments?.[field];
    if (!document || typeof document.name !== 'string'
      || document.name.trim().length < 1 || document.name.length > 120
      || !allowedDocumentTypes.has(document.mimeType)
      || typeof document.data !== 'string'
      || document.data.length > 1250000
      || !new RegExp(`^data:${document.mimeType.replace('/', '\\/')};base64,[A-Za-z0-9+/]+={0,2}$`).test(document.data)) {
      throw new AppError(400, 'Upload a valid government ID image and bank passbook image (JPG, PNG, or WEBP; each under 900 KB).', 'INVALID_VENDOR_DOCUMENTS');
    }
    onboardingDocuments[field] = {
      name: document.name.trim(),
      mimeType: document.mimeType,
      data: document.data,
    };
  }

  const bankInput = input.bankDetails && typeof input.bankDetails === 'object' ? input.bankDetails : {};
  const bankDetails = {
    bankName: typeof bankInput.bankName === 'string' ? bankInput.bankName.trim() : '',
    branch: typeof bankInput.branch === 'string' ? bankInput.branch.trim() : '',
    holderName: typeof bankInput.holderName === 'string' ? bankInput.holderName.trim() : '',
    accountNumber: typeof bankInput.accountNumber === 'string' ? bankInput.accountNumber.trim() : '',
    ifscCode: typeof bankInput.ifscCode === 'string' ? bankInput.ifscCode.trim().toUpperCase() : '',
  };
  if (Object.values(bankDetails).some((value) => value.length > 100)
    || bankDetails.accountNumber.length > 34
    || (bankDetails.accountNumber && !/^[\dA-Za-z -]{6,34}$/.test(bankDetails.accountNumber))
    || (bankDetails.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankDetails.ifscCode))) {
    throw new AppError(400, 'Check the bank account details and IFSC code.', 'INVALID_BANK_DETAILS');
  }

  return {
    vendorLocation: {
      type: 'Point',
      coordinates: [longitude, latitude],
      address,
    },
    vendorRadiusKm,
    vendorServiceType,
    bankDetails,
    onboardingDocuments,
  };
}

function toPublicUser(user) {
  return {
    id: String(user.id || user._id),
    name: user.name,
    phone: user.phone,
    email: user.email,
    businessName: user.businessName,
    role: user.role,
    ...(user.role === 'vendor' ? { approvalStatus: user.approvalStatus || 'pending' } : {}),
  };
}

function createAuthService({
  users = userRepository,
  hashPassword = bcrypt.hash,
  comparePassword = bcrypt.compare,
  signToken = jwt.sign,
  jwtSecret = config.jwtSecret,
  jwtExpiresIn = config.jwtExpiresIn,
} = {}) {
  function createAccessToken(user) {
    return signToken({ sub: String(user.id || user._id) }, jwtSecret, {
      expiresIn: jwtExpiresIn,
      algorithm: 'HS256',
    });
  }

  async function register(input = {}) {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    const phone = typeof input.phone === 'string' ? input.phone.trim() : '';
    const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
    const password = typeof input.password === 'string' ? input.password : '';
    const role = input.role === undefined ? 'user' : input.role;
    const businessName = typeof input.businessName === 'string' ? input.businessName.trim() : '';

    if (!registrationRoles.has(role)) throw new AppError(400, 'Choose a valid account type.', 'INVALID_ROLE');
    if (name.length < 2 || name.length > 80) throw new AppError(400, 'Enter a name between 2 and 80 characters.', 'INVALID_NAME');
    if (!phonePattern.test(phone)) throw new AppError(400, 'Enter a valid phone number.', 'INVALID_PHONE');
    if (email.length > 254 || !emailPattern.test(email)) throw new AppError(400, 'Enter a valid email address.', 'INVALID_EMAIL');
    if (password.length < 8 || password.length > 128) throw new AppError(400, 'Password must be between 8 and 128 characters.', 'INVALID_PASSWORD');
    if (role === 'vendor' && (businessName.length < 2 || businessName.length > 100)) {
      throw new AppError(400, 'Enter a business name between 2 and 100 characters.', 'INVALID_BUSINESS_NAME');
    }
    const vendorDetails = role === 'vendor' ? validateVendorOnboarding(input) : null;

    if (await users.findByEmail(email)) {
      throw new AppError(409, 'An account with this email already exists.', 'EMAIL_IN_USE');
    }

    const passwordHash = await hashPassword(password, 12);
    try {
      const user = await users.create({
        name,
        phone,
        email,
        passwordHash,
        role,
        ...(role === 'vendor' ? { approvalStatus: 'pending' } : {}),
        ...(role === 'vendor' ? { businessName } : {}),
        ...(role === 'vendor' ? vendorDetails : {}),
      });
      if (role === 'vendor') {
        return { status: 'pending', user: toPublicUser(user) };
      }
      return { token: createAccessToken(user), user: toPublicUser(user) };
    } catch (error) {
      if (error.code === 11000) {
        throw new AppError(409, 'An account with this email already exists.', 'EMAIL_IN_USE');
      }
      throw error;
    }
  }

  async function login(input = {}) {
    const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
    const password = typeof input.password === 'string' ? input.password : '';
    const role = input.role;

    if (!emailPattern.test(email) || password.length === 0) {
      throw new AppError(400, 'Enter a valid email and password.', 'INVALID_CREDENTIALS');
    }

    if (role && !accountRoles.has(role)) {
      throw new AppError(400, 'Enter a valid email, password, and account type.', 'INVALID_CREDENTIALS');
    }

    const user = await users.findByEmail(email, { includePasswordHash: true });
    if (!user || (role && user.role !== role) || !(await comparePassword(password, user.passwordHash))) {
      throw new AppError(401, 'Email or password is incorrect.', 'AUTHENTICATION_FAILED');
    }

    if (user.role === 'vendor' && (user.approvalStatus || 'pending') !== 'approved') {
      if (user.approvalStatus === 'rejected') {
        throw new AppError(403, 'Your vendor application was not approved. Contact the administrator for more information.', 'VENDOR_REJECTED');
      }
      throw new AppError(403, 'Your vendor application is awaiting admin approval.', 'VENDOR_PENDING');
    }

    return { token: createAccessToken(user), user: toPublicUser(user) };
  }

  async function updateProfile(userId, input = {}) {
    const updates = {};
    if (typeof input.name === 'string') {
      const name = input.name.trim();
      if (name.length < 2 || name.length > 80) {
        throw new AppError(400, 'Enter a name between 2 and 80 characters.', 'INVALID_NAME');
      }
      updates.name = name;
    }
    if (typeof input.phone === 'string') {
      const phone = input.phone.trim();
      if (!phonePattern.test(phone)) {
        throw new AppError(400, 'Enter a valid phone number.', 'INVALID_PHONE');
      }
      updates.phone = phone;
    }
    if (typeof input.email === 'string') {
      const email = input.email.trim().toLowerCase();
      if (email.length > 254 || !emailPattern.test(email)) {
        throw new AppError(400, 'Enter a valid email address.', 'INVALID_EMAIL');
      }
      const existing = await users.findByEmail(email);
      if (existing && String(existing._id || existing.id) !== String(userId)) {
        throw new AppError(409, 'An account with this email already exists.', 'EMAIL_IN_USE');
      }
      updates.email = email;
    }
    if (typeof input.businessName === 'string') {
      const businessName = input.businessName.trim();
      if (businessName.length >= 2 && businessName.length <= 100) {
        updates.businessName = businessName;
      }
    }

    if (Object.keys(updates).length === 0) {
      throw new AppError(400, 'No valid fields provided for update.', 'INVALID_UPDATE');
    }

    const updatedUser = await users.updateUser(userId, updates);
    if (!updatedUser) {
      throw new AppError(404, 'User not found.', 'USER_NOT_FOUND');
    }
    return { user: toPublicUser(updatedUser) };
  }

  return { register, login, updateProfile, toPublicUser };
}

const authService = createAuthService();
authService.createAuthService = createAuthService;

module.exports = authService;