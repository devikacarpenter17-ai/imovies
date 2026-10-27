const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Seat = require('../models/Seat');
const Show = require('../models/Show');
const Payment = require('../models/Payment');
const Notification = require('../models/Notification');
const { asyncHandler, httpError, bookingCode, txnId } = require('../utils/helpers');
const { emitSeats } = require('../utils/realtime');

const CANCEL_CUTOFF_MS = 2 * 60 * 60 * 1000; // no cancellations within 2 hours of showtime

// Simulated gateway. Test rules (documented in the README):
//   card ending 0000 -> declined, UPI id starting "fail" -> declined
function simulateGateway({ method, cardNumber, upiId }) {
  if (method === 'card') {
    const digits = String(cardNumber || '').replace(/\s+/g, '');
    if (!/^\d{16}$/.test(digits)) return { error: 'Enter a valid 16-digit card number.', invalid: true };
    if (digits.endsWith('0000')) return { ok: false, reason: 'The card was declined by the bank.', last4: digits.slice(-4) };
    return { ok: true, last4: digits.slice(-4) };
  }
  if (method === 'upi') {
    if (!/^[\w.-]{2,}@[\w]{2,}$/.test(upiId || '')) return { error: 'Enter a valid UPI ID, like name@bank.', invalid: true };
    if (upiId.toLowerCase().startsWith('fail')) return { ok: false, reason: 'The UPI request was declined.' };
    return { ok: true };
  }
  if (method === 'wallet') return { ok: true };
  return { error: 'Choose a payment method.', invalid: true };
}

// POST /api/bookings { showId, seatIds, method, cardNumber?, upiId? }
exports.create = asyncHandler(async (req, res) => {
  const { showId, seatIds, method } = req.body;
  if (!Array.isArray(seatIds) || seatIds.length === 0) throw httpError(400, 'Pick at least one seat.');

  const show = await Show.findById(showId);
  if (!show) throw httpError(404, 'Show not found.');
  if (show.startTime < new Date()) throw httpError(400, 'This show has already started.');

  const now = new Date();
  const seats = await Seat.find({
    _id: { $in: seatIds },
    show: show._id,
    status: 'locked',
    lockedBy: req.user._id,
    lockedUntil: { $gt: now },
  });
  if (seats.length !== seatIds.length) {
    throw httpError(409, 'Your seat hold has expired. Pick your seats again.');
  }

  const subtotal = seats.reduce((sum, s) => sum + s.price, 0);
  const convenienceFee = Math.round(subtotal * 0.05);
  const total = subtotal + convenienceFee;

  const gateway = simulateGateway({ method, cardNumber: req.body.cardNumber, upiId: req.body.upiId });
  if (gateway.invalid) throw httpError(400, gateway.error);

  const transactionId = txnId();

  if (!gateway.ok) {
    await Payment.create({
      user: req.user._id, show: show._id, amount: total, method, status: 'failed',
      transactionId, last4: gateway.last4, failureReason: gateway.reason,
    });
    await Notification.create({
      user: req.user._id, type: 'payment', title: 'Payment failed',
      message: `${gateway.reason} Your seats are held until the timer runs out, so you can try again.`,
    });
    throw httpError(402, `${gateway.reason} Try a different payment method.`);
  }

  // Payment ok: convert holds into permanent bookings, but only if they are still ours
  const bookingId = new mongoose.Types.ObjectId();
  const converted = await Seat.updateMany(
    { _id: { $in: seatIds }, status: 'locked', lockedBy: req.user._id },
    { status: 'booked', booking: bookingId, lockedBy: null, lockedUntil: null }
  );
  if (converted.modifiedCount !== seatIds.length) {
    throw httpError(409, 'Your seat hold changed while paying. No money was taken. Pick your seats again.');
  }

  const payment = await Payment.create({
    user: req.user._id, show: show._id, amount: total, method, status: 'success',
    transactionId, last4: gateway.last4,
  });

  const booking = await Booking.create({
    _id: bookingId,
    code: bookingCode(),
    user: req.user._id,
    show: show._id,
    movie: show.movie,
    theatre: show.theatre,
    seats: seats.map((s) => ({ seat: s._id, label: s.label, tier: s.tier, price: s.price })),
    subtotal,
    convenienceFee,
    total,
    payment: payment._id,
  });
  payment.booking = booking._id;
  await payment.save();

  emitSeats(show._id, seatIds, 'booked');

  await Notification.create({
    user: req.user._id, type: 'booking', title: 'Booking confirmed',
    message: `Booking ${booking.code} is confirmed for ${seats.map((s) => s.label).sort().join(', ')}.`,
  });

  res.status(201).json(await populate(Booking.findById(booking._id)));
});

const populate = (q) =>
  q
    .populate('movie', 'title language durationMins theme certificate')
    .populate('theatre', 'name city address')
    .populate('show', 'startTime endTime screenName format language')
    .populate('payment', 'method status transactionId last4');

// GET /api/bookings/mine?when=upcoming|past|cancelled&page=&limit=
exports.mine = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(30, parseInt(req.query.limit, 10) || 10);

  const all = await populate(Booking.find({ user: req.user._id }).sort({ createdAt: -1 })).lean();
  const now = new Date();
  const when = req.query.when;
  let list = all;
  if (when === 'upcoming') list = all.filter((b) => b.status === 'confirmed' && new Date(b.show.startTime) >= now);
  if (when === 'past') list = all.filter((b) => b.status === 'confirmed' && new Date(b.show.startTime) < now);
  if (when === 'cancelled') list = all.filter((b) => b.status === 'cancelled');

  list.forEach((b) => {
    b.canCancel = b.status === 'confirmed' && new Date(b.show.startTime) - now > CANCEL_CUTOFF_MS;
  });

  res.json({
    items: list.slice((page - 1) * limit, page * limit),
    total: list.length,
    page,
    pages: Math.ceil(list.length / limit) || 1,
  });
});

exports.get = asyncHandler(async (req, res) => {
  const booking = await populate(Booking.findById(req.params.id)).lean();
  if (!booking) throw httpError(404, 'Booking not found.');
  if (String(booking.user) !== String(req.user._id) && req.user.role !== 'admin') {
    throw httpError(403, 'This booking belongs to another account.');
  }
  booking.canCancel = booking.status === 'confirmed' && new Date(booking.show.startTime) - new Date() > CANCEL_CUTOFF_MS;
  res.json(booking);
});

// PUT /api/bookings/:id/cancel
exports.cancel = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id).populate('show', 'startTime');
  if (!booking) throw httpError(404, 'Booking not found.');
  if (String(booking.user) !== String(req.user._id) && req.user.role !== 'admin') {
    throw httpError(403, 'This booking belongs to another account.');
  }
  if (booking.status === 'cancelled') throw httpError(400, 'This booking is already cancelled.');
  if (booking.show.startTime - new Date() <= CANCEL_CUTOFF_MS) {
    throw httpError(400, 'Bookings can only be cancelled up to 2 hours before the show.');
  }

  const seatIds = booking.seats.map((s) => s.seat);
  await Seat.updateMany(
    { _id: { $in: seatIds } },
    { status: 'available', booking: null, lockedBy: null, lockedUntil: null }
  );
  booking.status = 'cancelled';
  booking.cancelledAt = new Date();
  await booking.save();
  await Payment.findByIdAndUpdate(booking.payment, { status: 'refunded' });
  emitSeats(booking.show._id, seatIds, 'available');

  await Notification.create({
    user: booking.user, type: 'cancellation', title: 'Booking cancelled',
    message: `Booking ${booking.code} was cancelled. ₹${booking.total} will be refunded to your original payment method.`,
  });

  res.json(await populate(Booking.findById(booking._id)));
});
