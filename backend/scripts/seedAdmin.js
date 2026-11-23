require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const config = require('../src/config/env');
const User = require('../src/models/User');

async function seedAdmin() {
  const name = (process.env.ADMIN_NAME || '').trim();
  const phone = (process.env.ADMIN_PHONE || '').trim();
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';

  if (name.length < 2 || phone.length < 7 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Set valid ADMIN_NAME, ADMIN_PHONE, and ADMIN_EMAIL values in backend/.env.');
  }
  const allowWeakDevelopmentPassword =
    config.nodeEnv === 'development' && process.env.ALLOW_WEAK_ADMIN_PASSWORD === 'true';
  const minimumPasswordLength = allowWeakDevelopmentPassword ? 8 : 16;
  if (password.length < minimumPasswordLength || password.length > 128) {
    throw new Error(
      allowWeakDevelopmentPassword
        ? 'ADMIN_PASSWORD must be between 8 and 128 characters.'
        : 'ADMIN_PASSWORD must be between 16 and 128 characters. For a local-only development account, set ALLOW_WEAK_ADMIN_PASSWORD=true in backend/.env.'
    );
  }

  const { uri, ...mongoOptions } = config.mongo;
  await mongoose.connect(uri, mongoOptions);
  try {
    const existing = await User.findOne({ email }).select('+passwordHash');
    const passwordHash = await bcrypt.hash(password, 12);

    if (existing && existing.role !== 'admin') {
      throw new Error('The configured admin email already belongs to a non-admin account.');
    }

    if (existing) {
      existing.name = name;
      existing.phone = phone;
      existing.passwordHash = passwordHash;
      existing.approvalStatus = 'approved';
      await existing.save();
      console.log(`Admin credentials updated for ${email}.`);
    } else {
      await User.create({
        name,
        phone,
        email,
        passwordHash,
        role: 'admin',
        approvalStatus: 'approved',
      });
      console.log(`Admin account created for ${email}.`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

seedAdmin().catch((error) => {
  console.error(`Admin provisioning failed: ${error.message}`);
  process.exitCode = 1;
});
