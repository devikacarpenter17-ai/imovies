// Imports real, currently playing and upcoming movies for India from TMDB (https://www.themoviedb.org).
// Needs a free API key in server/.env as TMDB_API_KEY (the v3 "API Key" or the "API Read Access Token").
const { getJson } = require('./http');

const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';

const LANGS = {
  hi: 'Hindi', en: 'English', ta: 'Tamil', te: 'Telugu', ml: 'Malayalam', kn: 'Kannada', bn: 'Bengali',
  mr: 'Marathi', pa: 'Punjabi', gu: 'Gujarati', ja: 'Japanese', ko: 'Korean', fr: 'French', es: 'Spanish', zh: 'Chinese',
};

// Colours used behind a poster while it loads, and as a fallback if the image cannot be reached
const PALETTES = [
  ['#5b2a86', '#120d1c', '#ffb020'], ['#0f5c63', '#0a1418', '#ff7a59'], ['#e0a458', '#2b1d3a', '#fff3d6'],
  ['#27405a', '#0b0f14', '#9ad1d4'], ['#b4441f', '#2a1109', '#ffd36e'], ['#1c2a6b', '#07080f', '#7fd6ff'],
  ['#c2410c', '#1b0b12', '#ffe08a'], ['#7c2d5c', '#14081a', '#ffc2e0'], ['#134e4a', '#06120f', '#b9f5d0'],
];

async function request(path, params = {}) {
  const key = (process.env.TMDB_API_KEY || '').trim();
  if (!key) throw new Error('TMDB_API_KEY is not set in server/.env');
  const url = new URL(BASE + path);
  const headers = { accept: 'application/json' };
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`; // v4 read access token
  else url.searchParams.set('api_key', key); // v3 key
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  let res;
  try {
    res = await getJson(url, headers);
  } catch (e) {
    const why = e.code || e.message;
    throw new Error(
      `Could not reach TMDB (${why}). Your internet connection may be blocking api.themoviedb.org. ` +
        'Connect to your phone hotspot or a VPN, then run update-movies.bat again.'
    );
  }
  if (res.status === 401) throw new Error('TMDB rejected the key (401). Check TMDB_API_KEY in server/.env.');
  if (res.status < 200 || res.status >= 300) throw new Error(`TMDB returned ${res.status} for ${path}`);
  return JSON.parse(res.body);
}

function certificate(d) {
  const india = d.release_dates?.results?.find((r) => r.iso_3166_1 === 'IN');
  const raw = india?.release_dates?.map((x) => x.certification).find(Boolean) || '';
  const c = raw.toUpperCase().replace(/[^A-Z]/g, '');
  if (c.startsWith('UA')) return 'UA';
  if (c.startsWith('U')) return 'U';
  if (c.startsWith('A') || c.startsWith('S')) return 'A';
  return 'UA';
}

// Pure function: TMDB movie details in, one IMovies movie out (or null if it lacks the basics)
function mapMovie(d) {
  if (!d.poster_path || !d.release_date || !d.overview) return null;
  const release = new Date(`${d.release_date}T00:00:00`);
  const videos = (d.videos?.results || []).filter((v) => v.site === 'YouTube');
  const trailer = videos.find((v) => v.type === 'Trailer') || videos[0];
  const [from, to, accent] = PALETTES[d.id % PALETTES.length];
  return {
    tmdbId: d.id,
    source: 'tmdb',
    title: d.title,
    tagline: d.tagline || undefined,
    description: d.overview,
    genres: (d.genres || []).map((g) => g.name),
    language: LANGS[d.original_language] || d.spoken_languages?.[0]?.english_name || 'English',
    durationMins: d.runtime || 120,
    certificate: certificate(d),
    score: d.vote_count >= 10 ? Math.round(d.vote_average * 10) / 10 : 0,
    releaseDate: release,
    status: release > new Date() ? 'upcoming' : 'now_showing',
    director: (d.credits?.crew || []).find((c) => c.job === 'Director')?.name,
    cast: (d.credits?.cast || []).slice(0, 5).map((c) => c.name),
    posterUrl: `${IMG}/w500${d.poster_path}`,
    backdropUrl: d.backdrop_path ? `${IMG}/w1280${d.backdrop_path}` : undefined,
    trailerUrl: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : undefined,
    theme: { from, to, accent },
  };
}

async function list(kind, pages) {
  const out = [];
  for (let page = 1; page <= pages; page++) {
    const d = await request(`/movie/${kind}`, { region: 'IN', language: 'en-US', page });
    out.push(...d.results);
    if (page >= d.total_pages) break;
  }
  return out;
}

async function importFromTmdb({ nowPlaying = 18, upcoming = 6 } = {}) {
  const Movie = require('../models/Movie');
  const byPopularity = (a, b) => b.popularity - a.popularity;

  const [np, up] = await Promise.all([list('now_playing', 2), list('upcoming', 1)]);
  const seen = new Set();
  const pick = (arr, n) =>
    arr
      .filter((m) => m.poster_path && !seen.has(m.id))
      .sort(byPopularity)
      .slice(0, n)
      .map((m) => (seen.add(m.id), m.id));
  const ids = [...pick(np, nowPlaying), ...pick(up, upcoming)];

  let saved = 0;
  for (const id of ids) {
    const d = await request(`/movie/${id}`, { language: 'en-US', append_to_response: 'credits,videos,release_dates' });
    const doc = mapMovie(d);
    if (!doc) continue;
    const { theme, ...rest } = doc;
    await Movie.findOneAndUpdate(
      { tmdbId: doc.tmdbId },
      { $set: rest, $setOnInsert: { theme } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    saved++;
    process.stdout.write(`  ${doc.title}\n`);
  }
  return saved;
}

// Removes the fictional placeholder movies (and their shows) once real ones exist.
// Anything a customer has already booked is left alone.
async function removeDemoMovies() {
  const Movie = require('../models/Movie');
  const Show = require('../models/Show');
  const Seat = require('../models/Seat');
  const Booking = require('../models/Booking');
  const titles = require('./demoMovies').map((m) => m.title);

  const bookedMovies = await Booking.distinct('movie');
  const ids = await Movie.find({
    _id: { $nin: bookedMovies },
    $or: [{ source: 'demo' }, { tmdbId: { $exists: false }, title: { $in: titles } }],
  }).distinct('_id');
  if (!ids.length) return 0;

  const shows = await Show.find({ movie: { $in: ids } }).distinct('_id');
  await Seat.deleteMany({ show: { $in: shows } });
  await Show.deleteMany({ _id: { $in: shows } });
  await Movie.deleteMany({ _id: { $in: ids } });
  return ids.length;
}

module.exports = { importFromTmdb, removeDemoMovies, mapMovie };
