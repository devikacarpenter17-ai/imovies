const mongoose = require('mongoose');

const theatreSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    amenities: [String],
    screens: [
      {
        name: { type: String, required: true },
        rows: { type: Number, default: 10 },
        seatsPerRow: { type: Number, default: 12 },
      },
    ],
  },
  { timestamps: true }
);

theatreSchema.index({ city: 1 });

module.exports = mongoose.model('Theatre', theatreSchema);
