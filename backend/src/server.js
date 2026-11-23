const http = require('node:http');
const mongoose = require('mongoose');
const config = require('./config/env');
const logger = require('./config/logger');
const connectDatabase = require('./config/database');
const createApp = require('./app');
const assignmentService = require('./services/vendorAssignmentService');
const paymentService = require('./controllers/paymentController').paymentService;

let server;
let shutdownPromise;
let bookingWorker;
let bookingWorkerRunning = false;

async function processBookingBackgroundJobs() {
  if (bookingWorkerRunning) return;
  bookingWorkerRunning = true;
  try {
    await assignmentService.processPendingAssignments();
    await paymentService.processPendingRefunds();
  } catch (error) {
    logger.error({ err: error }, 'Booking background processing failed');
  } finally {
    bookingWorkerRunning = false;
  }
}

async function start() {
  await connectDatabase();
  server = http.createServer(createApp());
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  server.requestTimeout = 30000;

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, config.host, () => {
      server.removeListener('error', reject);
      logger.info({ host: config.host, port: config.port }, 'WaterFlow API listening');
      resolve();
    });
  });

  bookingWorker = setInterval(processBookingBackgroundJobs, 15000);
  bookingWorker.unref();
  processBookingBackgroundJobs();
  return server;
}

function shutdown(signal = 'shutdown') {
  if (shutdownPromise) return shutdownPromise;

  shutdownPromise = (async () => {
    logger.info({ signal }, 'Graceful shutdown started');
    if (bookingWorker) clearInterval(bookingWorker);
    const forceTimer = setTimeout(() => {
      logger.error('Graceful shutdown timed out; closing active connections');
      server?.closeAllConnections?.();
    }, config.gracefulShutdownTimeoutMs);
    forceTimer.unref();

    if (server?.listening) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }

    await mongoose.disconnect();
    clearTimeout(forceTimer);
    logger.info('Graceful shutdown complete');
  })();

  return shutdownPromise;
}

function registerProcessHandlers() {
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      shutdown(signal).catch((error) => {
        logger.error({ err: error }, 'Graceful shutdown failed');
        process.exitCode = 1;
      });
    });
  }

  process.once('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'Unhandled promise rejection');
    shutdown('unhandledRejection').finally(() => { process.exitCode = 1; });
  });

  process.once('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught exception');
    shutdown('uncaughtException').finally(() => { process.exitCode = 1; });
  });
}

if (require.main === module) {
  start().then(registerProcessHandlers).catch(async (error) => {
    logger.fatal({ err: error }, 'API startup failed');
    await mongoose.disconnect().catch(() => {});
    process.exitCode = 1;
  });
}

module.exports = { start, shutdown, processBookingBackgroundJobs };