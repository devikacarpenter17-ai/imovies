const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    show: { type: mongoose.Schema.Types.ObjectId, ref: 'Show' },
    amount: { type: Number, required: true },
    method: { type: String, enum: ['card', 'upi', 'wallet'], required: true },
    status: { type: String, enum: ['success', 'failed', 'refunded'], required: true },
    transactionId: { type: String, required: true },
    last4: String,
    failureReason: String,
  },
  { timestamps: true }
);

paymentSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
