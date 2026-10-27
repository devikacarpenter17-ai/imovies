const mongoose = require('mongoose');

const showSchema = new mongoose.Schema(
  {
    movie: { type: mongoose.Schema.Types.ObjectId, ref: 'Movie', required: true },
    theatre: { type: mongoose.Schema.Types.ObjectId, ref: 'Theatre', required: true },
    screenName: { type: String, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    language: { type: String, required: true },
    format: { type: String, enum: ['2D', '3D', 'IMAX', '4DX'], default: '2D' },
    rows: { type: Number, default: 10 },
    seatsPerRow: { type: Number, default: 12 },
    prices: {
      standard: { type: Number, required: true },
      premium: { type: Number, required: true },
      recliner: { type: Number, required: true },
    },
  },
  { timestamps: true }
);

showSchema.index({ movie: 1, startTime: 1 });
showSchema.index({ theatre: 1, startTime: 1 });

module.exports = mongoose.model('Show', showSchema);
