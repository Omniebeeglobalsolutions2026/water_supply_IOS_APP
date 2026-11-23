require('dotenv').config();

function integerSetting(name, fallback, minimum, maximum) {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue === '') return fallback;

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}

function proxySetting() {
  const value = process.env.TRUST_PROXY;
  if (value === undefined || value === '' || value === 'false') return false;
  if (value === 'true') return true;
  const hops = Number(value);
  if (!Number.isInteger(hops) || hops < 1 || hops > 10) {
    throw new Error('TRUST_PROXY must be false, true, or a hop count between 1 and 10.');
  }
  return hops;
}

const jwtSecret = process.env.JWT_SECRET || '';
if (Buffer.byteLength(jwtSecret, 'utf8') < 32 || /^(change-me|replace-this)/i.test(jwtSecret.trim())) {
  throw new Error('JWT_SECRET must be set to a private value of at least 32 bytes.');
}

const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
if (!/^\d+[smhd]$/.test(jwtExpiresIn)) {
  throw new Error('JWT_EXPIRES_IN must be a duration such as 30m, 12h, or 7d.');
}

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/water_supply_management';
if (!/^mongodb(?:\+srv)?:\/\//i.test(mongoUri)) {
  throw new Error('MONGODB_URI must be a MongoDB connection URI.');
}

const maxPoolSize = integerSetting('MONGO_MAX_POOL_SIZE', 20, 1, 200);
const minPoolSize = integerSetting('MONGO_MIN_POOL_SIZE', 0, 0, maxPoolSize);
const origins = (process.env.CORS_ORIGIN || 'http://localhost:8081,http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (origins.length === 0) {
  throw new Error('CORS_ORIGIN must contain at least one allowed origin.');
}

const razorpayKeyId = process.env.RAZORPAY_KEY_ID || '';
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || '';
const razorpayWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
if (Boolean(razorpayKeyId) !== Boolean(razorpayKeySecret)) {
  throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must both be configured.');
}

const logLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];
const logLevel = process.env.LOG_LEVEL || 'info';
if (!logLevels.includes(logLevel)) {
  throw new Error(`LOG_LEVEL must be one of: ${logLevels.join(', ')}.`);
}

module.exports = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  host: process.env.HOST || '0.0.0.0',
  port: integerSetting('PORT', 5000, 1, 65535),
  jwtSecret,
  jwtExpiresIn,
  corsOrigins: Object.freeze(origins),
  razorpay: Object.freeze({
    keyId: razorpayKeyId,
    keySecret: razorpayKeySecret,
    webhookSecret: razorpayWebhookSecret,
  }),
  trustProxy: proxySetting(),
  logLevel,
  requestBodyLimit: process.env.REQUEST_BODY_LIMIT || '3mb',
  authRateLimitWindowMs: integerSetting('AUTH_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000, 1000, 24 * 60 * 60 * 1000),
  authRateLimitMax: integerSetting('AUTH_RATE_LIMIT_MAX', 20, 1, 10000),
  gracefulShutdownTimeoutMs: integerSetting('GRACEFUL_SHUTDOWN_TIMEOUT_MS', 10000, 1000, 120000),
  mongo: Object.freeze({
    uri: mongoUri,
    minPoolSize,
    maxPoolSize,
    maxIdleTimeMS: integerSetting('MONGO_MAX_IDLE_TIME_MS', 30000, 1000, 10 * 60 * 1000),
    serverSelectionTimeoutMS: integerSetting('MONGO_SERVER_SELECTION_TIMEOUT_MS', 5000, 1000, 60000),
    connectTimeoutMS: integerSetting('MONGO_CONNECT_TIMEOUT_MS', 10000, 1000, 60000),
  }),
});