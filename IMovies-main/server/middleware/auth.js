const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { asyncHandler, httpError } = require('../utils/helpers');

exports.protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw httpError(401, 'Please sign in to continue.');

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw httpError(401, 'Your session has expired. Sign in again.');
  }

  const user = await User.findById(decoded.id);
  if (!user) throw httpError(401, 'This account no longer exists.');
  req.user = user;
  next();
});

// Sets req.user when a valid token is sent, but never blocks the request
exports.optionalAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id);
    } catch {
      /* ignore: treated as signed out */
    }
  }
  next();
});

exports.adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return next(httpError(403, 'Only admins can do this.'));
  }
  next();
};
