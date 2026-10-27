// Sets up the database. Safe to run on every start: it only adds what is missing.
//   npm run seed         creates accounts and theatres, loads movies if there are none, and tops up shows
//   npm run seed:reset   wipes everything first
//
// Movies: with TMDB_API_KEY set in .env you get real movies and posters from TMDB.
// Without a key, fictional placeholder movies are added so the site still works.
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const Movie = require('./models/Movie');
const Theatre = require('./models/Theatre');
const Show = require('./models/Show');
const Seat = require('./models/Seat');
const Booking = require('./models/Booking');
const Payment = require('./models/Payment');
const Notification = require('./models/Notification');
const demoMovies = require('./utils/demoMovies');
const { importFromTmdb } = require('./utils/tmdb');
const { importFromItunes } = require('./utils/itunes');
const { refreshShows } = require('./utils/showGenerator');

const screenSet = (names) => names.map((name) => ({ name, rows: 10, seatsPerRow: 12 }));
const theatres = [
  { name: 'Regal Pavilion', city: 'Indore', address: 'MG Road', amenities: ['Dolby Atmos', 'Recliners', 'Food court'], screens: screenSet(['Screen 1', 'Screen 2', 'Screen 3']) },
  { name: 'Starlight Cinemas', city: 'Indore', address: 'Vijay Nagar', amenities: ['4K Laser', 'Parking'], screens: screenSet(['Audi 1', 'Audi 2']) },
  { name: 'Lakeview Multiplex', city: 'Bhopal', address: 'Upper Lake Road', amenities: ['Dolby Atmos', 'Recliners'], screens: screenSet(['Screen A', 'Screen B']) },
  { name: 'Marine Drive Talkies', city: 'Mumbai', address: 'Marine Lines', amenities: ['IMAX', 'Lounge'], screens: screenSet(['IMAX', 'Hall 2', 'Hall 3']) },
];

async function run() {
  await connectDB();

  if (process.argv.includes('--reset')) {
    await Promise.all([User, Movie, Theatre, Show, Seat, Booking, Payment, Notification].map((m) => m.deleteMany({})));
    console.log('Database cleared.');
  }

  // Accounts
  const accounts = [
    { name: 'IMovies Admin', email: 'admin@imovies.com', password: 'Admin@123', role: 'admin' },
    { name: 'Demo User', email: 'user@imovies.com', password: 'User@123', role: 'user' },
  ];
  for (const a of accounts) {
    if (!(await User.findOne({ email: a.email }))) await User.create(a);
  }

  // Theatres
  if (!(await Theatre.countDocuments())) await Theatre.insertMany(theatres);

  // Movies
  if (!(await Movie.countDocuments())) {
    if ((process.env.TMDB_API_KEY || '').trim()) {
      try {
        console.log('Importing real movies from TMDB...');
        const n = await importFromTmdb();
        console.log(`Imported ${n} real movies.`);
      } catch (e) {
        console.error(`Could not import real movies: ${e.message}`);
      }
    }
    if (!(await Movie.countDocuments())) {
      try {
        console.log('Importing real movies from Apple iTunes...');
        const n = await importFromItunes();
        console.log(`Imported ${n} real movies.`);
      } catch (e) {
        console.error(`Could not import real movies: ${e.message}`);
      }
    }
    if (!(await Movie.countDocuments())) {
      await Movie.insertMany(
        demoMovies.map(({ daysAgo, ...m }) => ({
          ...m,
          source: 'demo',
          status: m.status || 'now_showing',
          releaseDate: new Date(Date.now() - daysAgo * 86400000),
        }))
      );
      console.log('Added placeholder movies. For real movies and posters, add TMDB_API_KEY to server/.env and run: npm run import:movies');
    }
  }

  // Shows: build a fresh week if there are none, or if the schedule is about to run out
  const last = await Show.findOne().sort({ startTime: -1 }).select('startTime').lean();
  if (!last || last.startTime < new Date(Date.now() + 2 * 86400000)) {
    const n = await refreshShows();
    console.log(`Scheduled ${n} shows for the next 7 days.`);
  }

  console.log('Admin: admin@imovies.com / Admin@123');
  console.log('User:  user@imovies.com  / User@123');
  await mongoose.disconnect();
}

run().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
