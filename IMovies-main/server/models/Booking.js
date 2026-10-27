const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    show: { type: mongoose.Schema.Types.ObjectId, ref: 'Show', required: true },
    movie: { type: mongoose.Schema.Types.ObjectId, ref: 'Movie', required: true },
    theatre: { type: mongoose.Schema.Types.ObjectId, ref: 'Theatre', required: true },
    seats: [
      {
        seat: { type: mongoose.Schema.Types.ObjectId, ref: 'Seat' },
        label: String,
        tier: String,
        price: Number,
      },
    ],
    subtotal: { type: Number, required: true },
    convenienceFee: { type: Number, default: 0 },
    total: { type: Number, required: true },
    status: { type: String, enum: ['confirmed', 'cancelled'], default: 'confirmed' },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    cancelledAt: Date,
  },
  { timestamps: true }
);

bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ show: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
