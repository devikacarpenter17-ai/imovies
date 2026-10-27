const User = require('../models/User');
const Movie = require('../models/Movie');
const Show = require('../models/Show');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const { asyncHandler, httpError } = require('../utils/helpers');

exports.stats = asyncHandler(async (req, res) => {
  const since = new Date();
  since.setDate(since.getDate() - 6);
  since.setHours(0, 0, 0, 0);

  const [users, movies, upcomingShows, confirmed, revenueAgg, perDay, topMovies] = await Promise.all([
    User.countDocuments(),
    Movie.countDocuments(),
    Show.countDocuments({ startTime: { $gte: new Date() } }),
    Booking.countDocuments({ status: 'confirmed' }),
    Booking.aggregate([{ $match: { status: 'confirmed' } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
    Booking.aggregate([
      { $match: { status: 'confirmed', createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, bookings: { $sum: 1 }, revenue: { $sum: '$total' } } },
      { $sort: { _id: 1 } },
    ]),
    Booking.aggregate([
      { $match: { status: 'confirmed' } },
      { $group: { _id: '$movie', revenue: { $sum: '$total' }, tickets: { $sum: { $size: '$seats' } } } },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'movies', localField: '_id', foreignField: '_id', as: 'movie' } },
      { $unwind: '$movie' },
      { $project: { title: '$movie.title', revenue: 1, tickets: 1 } },
    ]),
  ]);

  res.json({
    users,
    movies,
    upcomingShows,
    bookings: confirmed,
    revenue: revenueAgg[0]?.total || 0,
    perDay,
    topMovies,
  });
});

exports.bookings = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, parseInt(req.query.limit, 10) || 15);
  const [items, total] = await Promise.all([
    Booking.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user', 'name email')
      .populate('movie', 'title')
      .populate('theatre', 'name city')
      .populate('show', 'startTime'),
    Booking.countDocuments(),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) || 1 });
});

// ---- Users ----
exports.users = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, parseInt(req.query.limit, 10) || 15);
  const [items, total, stats] = await Promise.all([
    User.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(),
    Booking.aggregate([
      { $match: { status: 'confirmed' } },
      { $group: { _id: '$user', bookings: { $sum: 1 }, spent: { $sum: '$total' } } },
    ]),
  ]);
  const byUser = Object.fromEntries(stats.map((s) => [String(s._id), s]));
  res.json({
    items: items.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      bookings: byUser[String(u._id)]?.bookings || 0,
      spent: byUser[String(u._id)]?.spent || 0,
    })),
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
  });
});

exports.setUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!['user', 'admin'].includes(role)) throw httpError(400, 'Role must be user or admin.');
  if (String(req.params.id) === String(req.user._id)) throw httpError(400, 'You cannot change your own role.');
  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
  if (!user) throw httpError(404, 'User not found.');
  res.json({ _id: user._id, role: user.role });
});

// ---- Notifications (any signed-in user) ----
exports.notifications = asyncHandler(async (req, res) => {
  const items = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(30);
  res.json({ items, unread: items.filter((n) => !n.read).length });
});

exports.markNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
  res.json({ message: 'All caught up.' });
});
