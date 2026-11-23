const jwt = require('jsonwebtoken');
const config = require('../config/env');
const userRepository = require('../repositories/userRepository');

async function authenticate(req, res, next) {
  const authorization = req.get('authorization') || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    const user = await userRepository.findById(payload.sub);

    if (!user) {
      return res.status(401).json({ message: 'Account no longer exists.' });
    }

    if (user.role === 'vendor' && user.approvalStatus !== 'approved') {
      return res.status(403).json({ message: 'Vendor approval is required to access this resource.' });
    }

    req.user = user;
    return next();
  } catch (error) {
    if (error.name !== 'JsonWebTokenError' && error.name !== 'TokenExpiredError' && error.name !== 'NotBeforeError') {
      return next(error);
    }
    return res.status(401).json({ message: 'Session is invalid or expired.' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to access this resource.' });
    }
    return next();
  };
}

authenticate.requireRole = requireRole;

module.exports = authenticate;