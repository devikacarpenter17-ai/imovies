// Usage: npm run import:movies
// Loads real movies and posters, removes the fictional placeholders and rebuilds the show schedule.
// Tries TMDB first (needs TMDB_API_KEY), then falls back to Apple iTunes, which needs no key.
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { importFromTmdb, removeDemoMovies } = require('../utils/tmdb');
const { importFromItunes } = require('../utils/itunes');
const { refreshShows } = require('../utils/showGenerator');

(async () => {
  await connectDB();

  let saved = 0;
  let source = '';
  if ((process.env.TMDB_API_KEY || '').trim()) {
    try {
      console.log('Importing movies from TMDB...');
      saved = await importFromTmdb();
      source = 'TMDB';
    } catch (e) {
      console.log(`\nTMDB did not work: ${e.message}\n`);
    }
  }
  if (!saved) {
    console.log('Importing movies from Apple iTunes (no key needed)...');
    saved = await importFromItunes();
    source = 'Apple iTunes';
  }
  if (!saved) throw new Error('No usable movies were returned.');

  const removed = await removeDemoMovies();
  const shows = await refreshShows();
  console.log(`\nDone: ${saved} real movies imported from ${source}, ${removed} placeholder movies removed, ${shows} shows scheduled.`);
  await mongoose.disconnect();
})().catch(async (e) => {
  console.error(`\nImport failed: ${e.message}`);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
