const Movie = require('../models/Movie');
const Show = require('../models/Show');
const Theatre = require('../models/Theatre');
const { asyncHandler, httpError } = require('../utils/helpers');

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/movies?search=&genre=&language=&status=&city=&date=&page=&limit=
exports.list = asyncHandler(async (req, res) => {
  const { search, genre, language, status, city, date, sort } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(48, Math.max(1, parseInt(req.query.limit, 10) || 12));

  const filter = {};
  if (search) filter.title = new RegExp(escapeRe(search), 'i');
  if (genre) filter.genres = genre;
  if (language) filter.language = language;
  if (status) filter.status = status;

  // City / date filters narrow to movies that actually have upcoming shows
  if (city || date) {
    const showFilter = {};
    if (city) {
      const theatreIds = await Theatre.find({ city }).distinct('_id');
      showFilter.theatre = { $in: theatreIds };
    }
    if (date) {
      const start = new Date(`${date}T00:00:00`);
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      showFilter.startTime = { $gte: start, $lt: end };
    } else {
      showFilter.startTime = { $gte: new Date() };
    }
    filter._id = { $in: await Show.find(showFilter).distinct('movie') };
  }

  const sortMap = {
    rating: { score: -1, releaseDate: -1 },
    newest: { releaseDate: -1 },
    title: { title: 1 },
    added: { createdAt: -1 },
  };

  const [items, total] = await Promise.all([
    Movie.find(filter)
      .sort(sortMap[sort] || { releaseDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Movie.countDocuments(filter),
  ]);

  res.json({ items, total, page, pages: Math.ceil(total / limit) || 1 });
});

exports.filters = asyncHandler(async (req, res) => {
  const [genres, languages, cities] = await Promise.all([
    Movie.distinct('genres'),
    Movie.distinct('language'),
    Theatre.distinct('city'),
  ]);
  res.json({ genres: genres.sort(), languages: languages.sort(), cities: cities.sort() });
});

exports.get = asyncHandler(async (req, res) => {
  const movie = await Movie.findById(req.params.id);
  if (!movie) throw httpError(404, 'Movie not found.');
  res.json(movie);
});

exports.create = asyncHandler(async (req, res) => {
  const movie = await Movie.create(req.body);
  res.status(201).json(movie);
});

exports.update = asyncHandler(async (req, res) => {
  const movie = await Movie.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!movie) throw httpError(404, 'Movie not found.');
  res.json(movie);
});

exports.remove = asyncHandler(async (req, res) => {
  const movie = await Movie.findById(req.params.id);
  if (!movie) throw httpError(404, 'Movie not found.');
  const Seat = require('../models/Seat');
  const Booking = require('../models/Booking');
  const shows = await Show.find({ movie: movie._id }).select('_id');
  const showIds = shows.map((x) => x._id);
  const bookings = await Booking.countDocuments({ show: { $in: showIds } });
  if (bookings > 0) {
    throw httpError(409, `This movie has ${bookings} booking(s), so it cannot be deleted. Edit it and set it to Upcoming instead.`);
  }
  await Seat.deleteMany({ show: { $in: showIds } });
  await Show.deleteMany({ movie: movie._id });
  await movie.deleteOne();
  res.json({ message: 'Movie deleted.' });
});
