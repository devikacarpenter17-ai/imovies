import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../api';
import Poster from '../components/Poster';
import MovieCard, { MovieGridSkeleton } from '../components/MovieCard';
import { useCity } from '../context/CityContext';
import { duration, fmtDate } from '../utils/format';

function Hero({ movies }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  // Auto-advance, unless paused by the user or they prefer reduced motion
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (paused || reduce || movies.length < 2) return undefined;
    const t = setInterval(() => setI((x) => (x + 1) % movies.length), 7000);
    return () => clearInterval(t);
  }, [paused, movies.length]);

  const m = movies[i];
  const t = m.theme || {};
  return (
    <section className="hero" aria-label="Featured movies" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div
        key={`bg-${m._id}`}
        className="hero-bg"
        style={{
          background: m.backdropUrl
            ? `url("${m.backdropUrl}") center / cover no-repeat, linear-gradient(150deg, ${t.from}, ${t.to})`
            : `radial-gradient(70% 90% at 75% 30%, color-mix(in srgb, ${t.accent} 30%, transparent), transparent 65%), linear-gradient(150deg, ${t.from}, ${t.to})`,
        }}
      />
      <div className="container hero-inner">
        <div key={`copy-${m._id}`} className="hero-copy" aria-live="polite">
          <div className="chips">
            <span className="chip cert">{m.certificate}</span>
            <span className="chip">{m.language}</span>
            <span className="chip">{duration(m.durationMins)}</span>
            {m.genres.slice(0, 2).map((g) => <span key={g} className="chip">{g}</span>)}
          </div>
          <h1 className="hero-title">{m.title}</h1>
          {m.tagline && <p className="hero-tagline">{m.tagline}</p>}
          <p className="hero-desc">{m.description}</p>
          <div className="d-flex flex-wrap align-items-center gap-3 mt-4">
            <Link to={`/movies/${m._id}`} className="btn btn-brand btn-lg px-4">Book tickets</Link>
            {m.trailerUrl && <a href={m.trailerUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-lg">Watch trailer</a>}
            <Link to={`/movies/${m._id}#details`} className="btn btn-ghost btn-lg">Details</Link>
            {m.score > 0 && <span className="score fs-5">★ {m.score.toFixed(1)}</span>}
          </div>
        </div>
        <div key={`poster-${m._id}`} className="hero-poster"><Poster movie={m} /></div>
      </div>
      <div className="container hero-picker" role="tablist" aria-label="Choose a featured movie">
        {movies.map((x, idx) => (
          <button key={x._id} role="tab" aria-selected={idx === i} className="pick" onClick={() => setI(idx)}>
            <Poster movie={x} size="xs" />
            <span>{x.title}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  const { genres } = useCity();
  const [featured, setFeatured] = useState([]);
  const [genre, setGenre] = useState('');
  const [list, setList] = useState([]);
  const [soon, setSoon] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/movies', { params: { status: 'now_showing', sort: 'rating', limit: 5 } })
      .then((r) => setFeatured(r.data.items))
      .catch((e) => setError(errMsg(e)));
    api.get('/movies', { params: { status: 'upcoming', sort: 'newest', limit: 6 } })
      .then((r) => setSoon(r.data.items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    api.get('/movies', { params: { status: 'now_showing', genre: genre || undefined, limit: 12, sort: 'newest' } })
      .then((r) => setList(r.data.items))
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, [genre]);

  return (
    <>
      {featured.length > 0 && <Hero movies={featured} />}
      {error && (
        <div className="container mt-4">
          <div className="alert-err" role="alert">{error} If this is your first run, start the API and run <code>npm run seed</code> in the server folder.</div>
        </div>
      )}

      <div className="container">
        <section className="section" id="now-showing">
          <div className="section-head">
            <h2>Now showing</h2>
            <Link to="/movies" className="btn btn-ghost btn-sm">See all movies</Link>
          </div>
          <div className="chips mb-4" role="group" aria-label="Filter by genre">
            <button className={`filter-chip ${genre === '' ? 'on' : ''}`} onClick={() => setGenre('')}>All</button>
            {genres.map((g) => (
              <button key={g} className={`filter-chip ${genre === g ? 'on' : ''}`} onClick={() => setGenre(g)} aria-pressed={genre === g}>{g}</button>
            ))}
          </div>
          {loading ? <MovieGridSkeleton /> : list.length ? (
            <div className="movie-grid">{list.map((m) => <MovieCard key={m._id} movie={m} />)}</div>
          ) : (
            <div className="empty"><h3>No {genre} movies showing</h3><p>Try another genre.</p></div>
          )}
        </section>

        {soon.length > 0 && (
          <section className="section">
            <div className="section-head"><h2>Coming soon</h2></div>
            <div className="soon-list">
              {soon.map((m) => (
                <Link key={m._id} to={`/movies/${m._id}`} className="soon">
                  <Poster movie={m} />
                  <div>
                    <h3>{m.title}</h3>
                    <div className="when">Releases {fmtDate(m.releaseDate)}</div>
                    <p className="text-muted-2 small mb-0 mt-1">{m.genres.join(', ')}, {m.language}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
