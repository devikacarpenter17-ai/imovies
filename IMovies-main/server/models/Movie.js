const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    tmdbId: { type: Number }, // set for movies imported from TMDB
    itunesId: { type: Number }, // set for movies imported from Apple iTunes
    source: { type: String, enum: ['tmdb', 'itunes', 'demo', 'admin'], default: 'admin' },
    tagline: { type: String, trim: true },
    description: { type: String, required: true },
    genres: [{ type: String, trim: true }],
    language: { type: String, required: true, trim: true },
    durationMins: { type: Number, required: true, min: 1 },
    certificate: { type: String, default: 'UA' },
    score: { type: Number, min: 0, max: 10, default: 0 },
    releaseDate: { type: Date, required: true },
    status: { type: String, enum: ['now_showing', 'upcoming'], default: 'now_showing' },
    director: String,
    cast: [String],
    posterUrl: String,
    backdropUrl: String,
    trailerUrl: String,
    // Used to render generated poster art when no posterUrl is set
    theme: {
      from: { type: String, default: '#3b2a5c' },
      to: { type: String, default: '#12101a' },
      accent: { type: String, default: '#ffb020' },
    },
  },
  { timestamps: true }
);

movieSchema.index({ tmdbId: 1 }, { unique: true, partialFilterExpression: { tmdbId: { $type: 'number' } } });
movieSchema.index({ itunesId: 1 }, { unique: true, partialFilterExpression: { itunesId: { $type: 'number' } } });
// language_override and default_language are set so the 'language' field (Hindi, Tamil...)
// is not mistaken for a text-search language by MongoDB.
movieSchema.index({ title: 'text', description: 'text' }, { language_override: 'searchLang', default_language: 'none' });
movieSchema.index({ status: 1, releaseDate: -1 });
movieSchema.index({ genres: 1, language: 1 });

module.exports = mongoose.model('Movie', movieSchema);
