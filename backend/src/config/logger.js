const pino = require('pino');
const config = require('./env');

const logger = pino({
  level: config.logLevel,
  base: { service: 'waterflow-api', environment: config.nodeEnv },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'req.body.password', 'req.body.passwordHash'],
    censor: '[REDACTED]',
  },
});

module.exports = logger;