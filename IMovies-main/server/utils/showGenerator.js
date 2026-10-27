// Creates a week of shows for the movies that are now showing.
// Real cinema schedules are not available from any free public source, so showtimes and seat
// occupancy are generated. Shows that already have customer bookings are always kept.
const { buildSeats } = require('./helpers');

const SLOT_HOURS = [10, 13, 16, 19, 22];
const FORMATS = ['2D', '2D', '3D'];
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function refreshShows({ days = 7 } = {}) {
  const Theatre = require('../models/Theatre');
  const Show = require('../models/Show');
  const Seat = require('../models/Seat');
  const Booking = require('../models/Booking');
  const Movie = require('../models/Movie');

  const now = new Date();

  // Clear future shows nobody has booked, so the new schedule matches the current movie list
  const bookedShows = await Booking.distinct('show');
  const stale = await Show.find({ startTime: { $gte: now }, _id: { $nin: bookedShows } }).distinct('_id');
  if (stale.length) {
    await Seat.deleteMany({ show: { $in: stale } });
    await Show.deleteMany({ _id: { $in: stale } });
  }

  const movies = await Movie.find({ status: 'now_showing' }).sort({ score: -1, releaseDate: -1 }).lean();
  const theatres = await Theatre.find().lean();
  if (!movies.length || !theatres.length) return 0;

  // Everything already on the calendar, used to avoid two shows overlapping on one screen
  const taken = await Show.find({ startTime: { $gte: now } }).select('theatre screenName startTime endTime').lean();
  const clashes = (theatre, screen, start, end) =>
    taken.some((t) => String(t.theatre) === String(theatre) && t.screenName === screen && t.startTime < end && t.endTime > start);

  let created = 0;
  let seatBuffer = [];

  for (let day = 0; day < days; day++) {
    let cursor = day;
    for (const theatre of theatres) {
      for (const screen of theatre.screens) {
        for (let i = 0; i < SLOT_HOURS.length; i++) {
          if (i === 4 && Math.random() < 0.4) continue; // not every screen runs a late show
          const movie = movies[(cursor + i) % movies.length];
          const start = new Date();
          start.setDate(start.getDate() + day);
          start.setHours(SLOT_HOURS[i], 0, 0, 0);
          if (start <= now) continue;
          const end = new Date(start.getTime() + (movie.durationMins + 15) * 60000);
          if (clashes(theatre._id, screen.name, start, end)) continue;

          const isImax = theatre.name.includes('Marine') && screen.name === 'IMAX';
          const format = isImax ? 'IMAX' : FORMATS[rand(0, FORMATS.length - 1)];
          const bump = format === 'IMAX' ? 120 : format === '3D' ? 50 : 0;

          const show = await Show.create({
            movie: movie._id,
            theatre: theatre._id,
            screenName: screen.name,
            startTime: start,
            endTime: end,
            language: movie.language,
            format,
            rows: screen.rows,
            seatsPerRow: screen.seatsPerRow,
            prices: { standard: 150 + bump, premium: 250 + bump, recliner: 400 + bump },
          });
          taken.push({ theatre: theatre._id, screenName: screen.name, startTime: start, endTime: end });

          // Evening shows and higher-rated movies fill up more, so the seat maps look lived-in
          const fill = (SLOT_HOURS[i] >= 19 ? 0.3 : 0.12) + (movie.score >= 7.5 ? 0.1 : 0);
          seatBuffer.push(...buildSeats(show).map((s) => (Math.random() < fill ? { ...s, status: 'booked' } : s)));
          created++;
          if (seatBuffer.length > 4000) {
            await Seat.insertMany(seatBuffer);
            seatBuffer = [];
          }
        }
        cursor += 2;
      }
    }
  }
  if (seatBuffer.length) await Seat.insertMany(seatBuffer);
  return created;
}

module.exports = { refreshShows };
