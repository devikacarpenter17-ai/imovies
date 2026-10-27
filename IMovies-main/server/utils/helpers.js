const jwt = require('jsonwebtoken');
const crypto = require('crypto');

exports.asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

exports.signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

exports.httpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

exports.bookingCode = () => 'IM' + crypto.randomBytes(4).toString('hex').toUpperCase();
exports.txnId = () => 'TXN' + crypto.randomBytes(6).toString('hex').toUpperCase();

exports.holdMinutes = () => Number(process.env.SEAT_HOLD_MINUTES || 5);

// Row tiers: first 3 rows standard, next 4 premium, rest recliner
exports.tierForRow = (rowIndex, totalRows) => {
  if (rowIndex < 3) return 'standard';
  if (rowIndex < Math.max(7, totalRows - 3)) return 'premium';
  return 'recliner';
};

exports.buildSeats = (show) => {
  const seats = [];
  for (let r = 0; r < show.rows; r++) {
    const row = String.fromCharCode(65 + r);
    const tier = exports.tierForRow(r, show.rows);
    for (let n = 1; n <= show.seatsPerRow; n++) {
      seats.push({
        show: show._id,
        label: `${row}${n}`,
        row,
        number: n,
        tier,
        price: show.prices[tier],
      });
    }
  }
  return seats;
};
