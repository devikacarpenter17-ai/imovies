const User = require('../models/User');
const { asyncHandler, signToken, httpError } = require('../utils/helpers');

const emailRe = /^\S+@\S+\.\S+$/;

const payload = (user) => ({
  token: signToken(user),
  user: { id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone },
});

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || name.trim().length < 2) throw httpError(400, 'Enter your full name.');
  if (!emailRe.test(email || '')) throw httpError(400, 'Enter a valid email address.');
  if (!password || password.length < 6) throw httpError(400, 'Password must be at least 6 characters.');

  // Role is never taken from the request: public signups are always "user"
  const user = await User.create({ name, email, password, phone });
  res.status(201).json(payload(user));
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw httpError(400, 'Enter your email and password.');

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    throw httpError(401, 'Email or password is incorrect.');
  }
  res.json(payload(user));
});

exports.me = asyncHandler(async (req, res) => {
  const u = req.user;
  res.json({ user: { id: u._id, name: u.name, email: u.email, role: u.role, phone: u.phone } });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, phone } = req.body;
  if (name) req.user.name = name;
  if (phone !== undefined) req.user.phone = phone;
  await req.user.save();
  res.json({ user: { id: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role, phone: req.user.phone } });
});
