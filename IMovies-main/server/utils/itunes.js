// Backup movie source that needs no account or key: Apple's public iTunes catalogue (India store).
// Used when TMDB cannot be reached. It gives real titles, posters, descriptions, runtimes and a preview clip.
const { getJson } = require('./http');

const API = 'https://itunes.apple.com';

// Apple files Indian-language films under their language as the "genre"
const LANGUAGE_BY_GENRE = {
  Bollywood: 'Hindi', Hindi: 'Hindi', Tamil: 'Tamil', Telugu: 'Telugu', Kannada: 'Kannada',
  Malayalam: 'Malayalam', Bengali: 'Bengali', Marathi: 'Marathi', Punjabi: 'Punjabi', Gujarati: 'Gujarati',
};

const PALETTES = [
  ['#5b2a86', '#120d1c', '#ffb020'], ['#0f5c63', '#0a1418', '#ff7a59'], ['#e0a458', '#2b1d3a', '#fff3d6'],
  ['#27405a', '#0b0f14', '#9ad1d4'], ['#b4441f', '#2a1109', '#ffd36e'], ['#1c2a6b', '#07080f', '#7fd6ff'],
  ['#c2410c', '#1b0b12', '#ffe08a'], ['#7c2d5c', '#14081a', '#ffc2e0'], ['#134e4a', '#06120f', '#b9f5d0'],
];

const SEARCH_TERMS = ['bollywood', 'hindi', 'telugu', 'tamil', 'malayalam', 'kannada', 'action', 'thriller', 'comedy', 'romance', 'drama', 'horror'];

async function json(url) {
  const res = await getJson(url, { accept: 'application/json' });
  if (res.status < 200 || res.status >= 300) throw new Error(`Apple returned ${res.status}`);
  return JSON.parse(res.body);
}

// Pure function: one Apple movie record in, one IMovies movie out (or null if it lacks the basics)
function mapItunes(r) {
  const description = r.longDescription || r.shortDescription;
  if (!r.trackName || !r.artworkUrl100 || !description || !r.releaseDate) return null;
  const release = new Date(r.releaseDate);
  const genre = r.primaryGenreName || 'Drama';
  const advisory = (r.contentAdvisoryRating || '').toUpperCase().replace(/[^A-Z]/g, '');
  let certificate = 'UA';
  if (advisory.startsWith('UA')) certificate = 'UA';
  else if (advisory.startsWith('U')) certificate = 'U';
  else if (advisory.startsWith('A') || advisory === 'R' || advisory === 'NC') certificate = 'A';
  const [from, to, accent] = PALETTES[r.trackId % PALETTES.length];
  return {
    itunesId: r.trackId,
    source: 'itunes',
    title: r.trackName,
    description,
    genres: [genre],
    language: LANGUAGE_BY_GENRE[genre] || 'English',
    durationMins: Math.round((r.trackTimeMillis || 0) / 60000) || 120,
    certificate,
    score: 0,
    releaseDate: release,
    status: release > new Date() ? 'upcoming' : 'now_showing',
    director: r.artistName || undefined,
    cast: [],
    // Apple serves any size from the same address: ask for a tall poster instead of the 100px thumbnail
    posterUrl: r.artworkUrl100.replace(/\/\d+x\d+bb\.(jpg|png)$/, '/600x900bb.$1'),
    trailerUrl: r.previewUrl || undefined,
    theme: { from, to, accent },
  };
}

async function chartIds() {
  try {
    const d = await json(`${API}/in/rss/topmovies/limit=60/json`);
    return (d.feed?.entry || []).map((e) => e.id?.attributes?.['im:id']).filter(Boolean);
  } catch {
    return [];
  }
}

async function searchIds() {
  const ids = [];
  for (const term of SEARCH_TERMS) {
    try {
      const d = await json(`${API}/search?term=${encodeURIComponent(term)}&country=in&media=movie&entity=movie&limit=60`);
      ids.push(...d.results.map((r) => String(r.trackId)));
    } catch {
      /* try the next term */
    }
  }
  return ids;
}

async function lookup(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const d = await json(`${API}/lookup?id=${chunk.join(',')}&country=in&entity=movie`);
    out.push(...d.results);
  }
  return out;
}

async function importFromItunes({ count = 24 } = {}) {
  const Movie = require('../models/Movie');

  let ids = await chartIds(); // Apple's own "top movies in India" chart, most popular first
  if (ids.length < 12) ids = ids.concat(await searchIds());
  ids = [...new Set(ids.map(String))];
  if (!ids.length) {
    throw new Error('Could not reach Apple iTunes either. Connect to your phone hotspot or a VPN and run update-movies.bat again.');
  }

  const rank = new Map(ids.map((id, i) => [id, i]));
  const rows = (await lookup(ids)).map(mapItunes).filter(Boolean);

  // Prefer the last 18 months, keep the chart order, and drop duplicate titles
  const recent = rows.filter((m) => m.releaseDate > new Date(Date.now() - 548 * 86400000));
  const pool = recent.length >= 8 ? recent : rows;
  pool.sort((a, b) => rank.get(String(a.itunesId)) - rank.get(String(b.itunesId)));
  const seen = new Set();
  const chosen = pool.filter((m) => {
    const key = m.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, count);

  for (const doc of chosen) {
    const { theme, ...rest } = doc;
    await Movie.findOneAndUpdate(
      { itunesId: doc.itunesId },
      { $set: rest, $setOnInsert: { theme } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    process.stdout.write(`  ${doc.title}\n`);
  }
  return chosen.length;
}

module.exports = { importFromItunes, mapItunes };
