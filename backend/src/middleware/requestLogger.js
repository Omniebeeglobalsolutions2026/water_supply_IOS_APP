const { randomUUID } = require('node:crypto');
const pinoHttp = require('pino-http');
const logger = require('../config/logger');

module.exports = pinoHttp({
  logger,
  genReqId(req, res) {
    const incomingId = req.headers['x-request-id'];
    const requestId = typeof incomingId === 'string' && /^[\w.-]{1,100}$/.test(incomingId)
      ? incomingId
      : randomUUID();
    res.setHeader('x-request-id', requestId);
    return requestId;
  },
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
  customLogLevel(req, res, error) {
    if (error || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
});