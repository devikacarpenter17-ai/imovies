const mongoose = require('mongoose');
const Show = require('../models/Show');
const Seat = require('../models/Seat');
const Theatre = require('../models/Theatre');
const Movie = require('../models/Movie');
const { asyncHandler, httpError, buildSeats, holdMinutes } = require('../utils/helpers');
const { emitSeats } = require('../utils/realtime');

const MAX_SEATS = 8;

// GET /api/shows?movie=&city=&date=YYYY-MM-DD
exports.list = asyncHandler(async (req, res) => {
  const { movie, city, date, theatre } = req.query;
  const filter = {};
  if (movie) filter.movie = new mongoose.Types.ObjectId(movie);
  if (theatre) filter.theatre = new mongoose.Types.ObjectId(theatre);
  if (city) filter.theatre = { $in: await Theatre.find({ city }).distinct('_id') };

  if (date) {
    const start = new Date(`${date}T00:00:00`);
    filter.startTime = { $gte: start, $lt: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
  } else {
    filter.startTime = { $gte: new Date() };
  }

  const shows = await Show.find(filter)
    .sort({ startTime: 1 })
    .populate('theatre', 'name city address amenities')
    .populate('movie', 'title language durationMins theme')
    .lean();

  // Seat availability per show in one aggregation
  const counts = await Seat.aggregate([
    { $match: { show: { $in: shows.map((s) => s._id) } } },
    {
      $group: {
        _id: '$show',
        total: { $sum: 1 },
        available: { $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] } },
      },
    },
  ]);
  const byShow = Object.fromEntries(counts.map((c) => [String(c._id), c]));
  shows.forEach((s) => {
    const c = byShow[String(s._id)] || { total: 0, available: 0 };
    s.seatsTotal = c.total;
    s.seatsAvailable = c.available;
  });

  res.json(shows);
});

// GET /api/shows/:id  -> show, movie, theatre and the full seat map
exports.get = asyncHandler(async (req, res) => {
  const show = await Show.findById(req.params.id)
    .populate('theatre', 'name city address amenities')
    .populate('movie')
    .lean();
  if (!show) throw httpError(404, 'Show not found.');

  const seats = await Seat.find({ show: show._id })
    .select('label row number tier price status lockedBy lockedUntil')
    .sort({ row: 1, number: 1 })
    .lean();

  const now = new Date();
  const out = seats.map((s) => {
    // An expired hold is shown as available even before the cleanup job runs
    const expired = s.status === 'locked' && s.lockedUntil && s.lockedUntil < now;
    return {
      _id: s._id,
      label: s.label,
      row: s.row,
      number: s.number,
      tier: s.tier,
      price: s.price,
      status: expired ? 'available' : s.status,
      // Only the holder learns a hold is theirs; everyone else just sees "locked"
      mine: Boolean(req.user && !expired && s.status === 'locked' && String(s.lockedBy) === String(req.user._id)),
      lockedUntil:
        req.user && !expired && s.status === 'locked' && String(s.lockedBy) === String(req.user._id) ? s.lockedUntil : null,
    };
  });

  res.json({ show, seats: out, maxSeats: MAX_SEATS, holdMinutes: holdMinutes() });
});

exports.create = asyncHandler(async (req, res) => {
  const { movie, theatre, screenName, startTime, language, format, prices } = req.body;
  const [m, t] = await Promise.all([Movie.findById(movie), Theatre.findById(theatre)]);
  if (!m) throw httpError(404, 'Movie not found.');
  if (!t) throw httpError(404, 'Theatre not found.');

  const screen = t.screens.find((s) => s.name === screenName);
  if (!screen) throw httpError(400, 'That screen does not exist in this theatre.');

  const start = new Date(startTime);
  if (Number.isNaN(start.getTime())) throw httpError(400, 'Enter a valid start time.');
  const end = new Date(start.getTime() + (m.durationMins + 15) * 60 * 1000);

  const clash = await Show.findOne({
    theatre,
    screenName,
    startTime: { $lt: end },
    endTime: { $gt: start },
  });
  if (clash) throw httpError(409, 'Another show already runs on this screen at that time.');

  const show = await Show.create({
    movie,
    theatre,
    screenName,
    startTime: start,
    endTime: end,
    language: language || m.language,
    format,
    rows: screen.rows,
    seatsPerRow: screen.seatsPerRow,
    prices,
  });
  await Seat.insertMany(buildSeats(show));
  res.status(201).json(show);
});

exports.update = asyncHandler(async (req, res) => {
  const show = await Show.findById(req.params.id);
  if (!show) throw httpError(404, 'Show not found.');

  const { startTime, language, format, prices } = req.body;
  if (startTime) {
    const movie = await Movie.findById(show.movie);
    show.startTime = new Date(startTime);
    show.endTime = new Date(show.startTime.getTime() + (movie.durationMins + 15) * 60 * 1000);
  }
  if (language) show.language = language;
  if (format) show.format = format;
  if (prices) {
    show.prices = { ...show.prices.toObject(), ...prices };
    // Only seats nobody has bought yet follow the new price
    await Promise.all(
      ['standard', 'premium', 'recliner'].map((tier) =>
        Seat.updateMany({ show: show._id, tier, status: { $ne: 'booked' } }, { price: show.prices[tier] })
      )
    );
  }
  await show.save();
  res.json(show);
});

exports.remove = asyncHandler(async (req, res) => {
  const booked = await Seat.countDocuments({ show: req.params.id, status: 'booked' });
  if (booked > 0) throw httpError(409, `${booked} seats are already booked. Cancel those bookings first.`);
  await Seat.deleteMany({ show: req.params.id });
  const show = await Show.findByIdAndDelete(req.params.id);
  if (!show) throw httpError(404, 'Show not found.');
  res.json({ message: 'Show deleted.' });
});

// POST /api/shows/:id/lock { seatIds: [] }  -> hold seats for this user
exports.lockSeats = asyncHandler(async (req, res) => {
  const { seatIds } = req.body;
  if (!Array.isArray(seatIds) || seatIds.length === 0) throw httpError(400, 'Pick at least one seat.');
  if (seatIds.length > MAX_SEATS) throw httpError(400, `You can book up to ${MAX_SEATS} seats at a time.`);

  const show = await Show.findById(req.params.id);
  if (!show) throw httpError(404, 'Show not found.');
  if (show.startTime < new Date()) throw httpError(400, 'This show has already started.');

  const now = new Date();
  const until = new Date(now.getTime() + holdMinutes() * 60 * 1000);
  const userId = req.user._id;

  // Free whatever this user was holding in this show, so a new pick replaces the old one
  const previous = await Seat.find({ show: show._id, status: 'locked', lockedBy: userId, _id: { $nin: seatIds } }).distinct('_id');
  if (previous.length) {
    await Seat.updateMany({ _id: { $in: previous } }, { status: 'available', lockedBy: null, lockedUntil: null });
    emitSeats(show._id, previous, 'available');
  }

  // Atomic claim: only seats that are free, expired-held, or already ours
  await Seat.updateMany(
    {
      _id: { $in: seatIds },
      show: show._id,
      $or: [
        { status: 'available' },
        { status: 'locked', lockedUntil: { $lt: now } },
        { status: 'locked', lockedBy: userId },
      ],
    },
    { status: 'locked', lockedBy: userId, lockedUntil: until }
  );

  const mine = await Seat.find({ _id: { $in: seatIds }, show: show._id, status: 'locked', lockedBy: userId }).select('_id label');
  if (mine.length !== seatIds.length) {
    // Someone else got there first: give back what we took and report
    const taken = mine.map((s) => s._id);
    await Seat.updateMany({ _id: { $in: taken } }, { status: 'available', lockedBy: null, lockedUntil: null });
    emitSeats(show._id, taken, 'available');
    throw httpError(409, 'Some of those seats were just taken. Pick different seats.');
  }

  emitSeats(show._id, seatIds, 'locked');
  res.json({ locked: mine.map((s) => s.label), expiresAt: until });
});

// POST /api/shows/:id/unlock { seatIds?: [] } -> release this user's holds
exports.unlockSeats = asyncHandler(async (req, res) => {
  const filter = { show: req.params.id, status: 'locked', lockedBy: req.user._id };
  if (Array.isArray(req.body.seatIds) && req.body.seatIds.length) filter._id = { $in: req.body.seatIds };
  const ids = await Seat.find(filter).distinct('_id');
  if (ids.length) {
    await Seat.updateMany({ _id: { $in: ids } }, { status: 'available', lockedBy: null, lockedUntil: null });
    emitSeats(req.params.id, ids, 'available');
  }
  res.json({ released: ids.length });
});
