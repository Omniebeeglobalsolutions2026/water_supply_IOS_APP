const mongoose = require('mongoose');
const config = require('./env');
const logger = require('./logger');
const userRepository = require('../repositories/userRepository');

async function connectDatabase() {
  mongoose.set('bufferCommands', false);
  mongoose.set('strictQuery', true);
  mongoose.connection.on('error', (error) => logger.error({ err: error }, 'MongoDB connection error'));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));

  await mongoose.connect(config.mongo.uri, {
    minPoolSize: config.mongo.minPoolSize,
    maxPoolSize: config.mongo.maxPoolSize,
    maxIdleTimeMS: config.mongo.maxIdleTimeMS,
    serverSelectionTimeoutMS: config.mongo.serverSelectionTimeoutMS,
    connectTimeoutMS: config.mongo.connectTimeoutMS,
    autoIndex: false,
  });

  await userRepository.ensureIndexes();
  logger.info({ database: mongoose.connection.name, maxPoolSize: config.mongo.maxPoolSize }, 'MongoDB connected and indexes verified');
}

module.exports = connectDatabase;