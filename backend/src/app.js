const cors = require('cors');
const express = require('express');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoose = require('mongoose');
const config = require('./config/env');
const AppError = require('./errors/AppError');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(requestLogger);
  app.use(helmet());
  app.use(cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes('*') || config.corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new AppError(403, 'Origin is not allowed.', 'CORS_ORIGIN_DENIED'));
    },
  }));
  app.use(express.json({ limit: config.requestBodyLimit }));

  app.get('/', (req, res) => res.status(200).json({
    name: 'BHAGIRA Water Supply API',
    status: 'online',
    version: '1.0.0',
    database: 'connected',
    time: new Date().toISOString(),
  }));

  app.get('/api/health/live', (req, res) => res.status(200).json({ status: 'ok' }));

  const readiness = async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) throw new Error('Database connection is unavailable.');
      await mongoose.connection.db.admin().ping();
      return res.status(200).json({ status: 'ok', database: 'connected' });
    } catch (error) {
      return res.status(503).json({ status: 'unavailable', database: 'disconnected', requestId: req.id });
    }
  };

  app.get('/api/health/ready', readiness);
  app.get('/api/health', readiness);

  const authLimiter = rateLimit({
    windowMs: config.authRateLimitWindowMs,
    limit: config.authRateLimitMax,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Too many authentication attempts. Try again later.' },
  });
  const paymentLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });

  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/payments/razorpay/webhook', express.raw({ type: 'application/json', limit: '20kb' }));
  app.use('/api/payments', paymentLimiter, paymentRoutes);
  app.use('/api', vendorRoutes);
  app.use('/api/admin', adminRoutes);
  app.use((req, res) => res.status(404).json({ message: 'Route not found.', requestId: req.id }));
  app.use(errorHandler);

  return app;
}

module.exports = createApp;