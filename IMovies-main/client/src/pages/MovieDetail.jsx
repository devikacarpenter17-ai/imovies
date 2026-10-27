import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { errMsg } from '../api';
import Poster from '../components/Poster';
import DateStrip from '../components/DateStrip';
import { useSelector } from 'react-redux';
import { useCity } from '../context/CityContext';
import { dayKey, duration, fmtDate, fmtTime, rupee } from '../utils/format';

export default function MovieDetail() {
  const { id } = useParams();
  const { city, setCity, cities } = useCity();
  const user = useSelector((s) => s.auth.user);
  const [movie, setMovie] = useState(null);
  const [shows, setShows] = useState([]);
  const [day, setDay] = useState(dayKey(new Date()));
  const [error, setError] = useState('');
  const [loadingShows, setLoadingShows] = useState(true);

  useEffect(() => {
    setMovie(null);
    api.get(`/movies/${id}`).then((r) => setMovie(r.data)).catch((e) => setError(errMsg(e)));
  }, [id]);

  useEffect(() => {
    setLoadingShows(true);
    api.get('/shows', { params: { movie: id, city: city || undefined, date: day } })
      .then((r) => setShows(r.data))
      .catch(() => setShows([]))
      .finally(() => setLoadingShows(false));
  }, [id, city, day]);

  // Group the day's shows by theatre
  const grouped = useMemo(() => {
    const map = new Map();
    shows.forEach((s) => {
      const k = s.theatre._id;
      if (!map.has(k)) map.set(k, { theatre: s.theatre, shows: [] });
      map.get(k).shows.push(s);
    });
    return [...map.values()];
  }, [shows]);

  if (error) return <div className="container page"><div className="alert-err">{error}</div></div>;
  if (!movie) return <div className="container page"><div className="skeleton" style={{ height: 380 }} /></div>;

  const t = movie.theme || {};
  const upcoming = movie.status === 'upcoming';
  const now = new Date();

  return (
    <>
      <section className="detail-hero" id="details">
        <div
          className="hero-bg"
          style={{
            background: movie.backdropUrl
              ? `url("${movie.backdropUrl}") center / cover no-repeat, linear-gradient(150deg, ${t.from}, ${t.to})`
              : `radial-gradient(70% 90% at 80% 20%, color-mix(in srgb, ${t.accent} 28%, transparent), transparent 65%), linear-gradient(150deg, ${t.from}, ${t.to})`,
          }}
        />
        <div className="container detail-grid">
          <Poster movie={movie} />
          <div>
            <div className="chips">
              <span className="chip cert">{movie.certificate}</span>
              <span className="chip">{movie.language}</span>
              <span className="chip">{duration(movie.durationMins)}</span>
              {movie.genres.map((g) => <span key={g} className="chip">{g}</span>)}
            </div>
            <h1 className="detail-title">{movie.title}</h1>
            {movie.tagline && <p className="hero-tagline mb-2">{movie.tagline}</p>}
            {movie.score > 0 && <div className="score fs-5 mb-2">★ {movie.score.toFixed(1)} <span className="text-muted-2 fs-6 fw-normal">audience score</span></div>}
            <p style={{ maxWidth: '62ch', color: '#d4cbe0' }}>{movie.description}</p>
            {movie.trailerUrl && (
              <a href={movie.trailerUrl} target="_blank" rel="noreferrer" className="btn btn-ghost mt-1">Watch trailer</a>
            )}
            <dl className="facts">
              {movie.director && <div><dt>Director</dt><dd>{movie.director}</dd></div>}
              {movie.cast?.length > 0 && <div><dt>Cast</dt><dd>{movie.cast.join(', ')}</dd></div>}
              <div><dt>{upcoming ? 'Releases' : 'Released'}</dt><dd>{fmtDate(movie.releaseDate)}</dd></div>
            </dl>
          </div>
        </div>
      </section>

      <div className="container page">
        {user?.role === 'admin' && (
          <div className="admin-bar no-print">
            <span className="fw-bold">Admin tools</span>
            <Link to="/admin?tab=Movies" className="btn btn-brass btn-sm">Edit movies</Link>
            <Link to="/admin?tab=Shows" className="btn btn-ghost btn-sm">Schedule a show</Link>
            <Link to="/admin?tab=Bookings" className="btn btn-ghost btn-sm">View bookings</Link>
          </div>
        )}
        {upcoming ? (
          <div className="empty">
            <h3>Bookings open closer to release</h3>
            <p>This movie arrives on {fmtDate(movie.releaseDate)}. Check back then to pick your seats.</p>
            <Link to="/movies" className="btn btn-ghost">Browse movies showing now</Link>
          </div>
        ) : (
          <>
            <div className="section-head">
              <h2 className="h3 mb-0">Pick a showtime</h2>
              <select className="form-select" style={{ width: 180 }} value={city} onChange={(e) => setCity(e.target.value)} aria-label="City">
                <option value="">All cities</option>
                {cities.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <DateStrip value={day} onChange={setDay} />

            <div className="mt-4">
              {loadingShows ? <div className="skeleton" style={{ height: 120 }} /> : grouped.length === 0 ? (
                <div className="empty">
                  <h3>No shows on this day{city ? ` in ${city}` : ''}</h3>
                  <p>Try another date or switch to all cities.</p>
                </div>
              ) : grouped.map(({ theatre, shows: list }) => (
                <div className="theatre-card" key={theatre._id}>
                  <div>
                    <h3>{theatre.name}</h3>
                    <div className="text-muted-2 small">{theatre.address}, {theatre.city}</div>
                    <div className="chips mt-2">{theatre.amenities?.map((a) => <span key={a} className="chip">{a}</span>)}</div>
                  </div>
                  <div className="slots">
                    {list.map((s) => {
                      const started = new Date(s.startTime) < now;
                      const soldOut = s.seatsAvailable === 0;
                      const few = s.seatsTotal && s.seatsAvailable / s.seatsTotal < 0.2;
                      const off = started || soldOut;
                      const cls = `slot ${off ? 'off' : few ? 'few' : ''}`;
                      const inner = (
                        <>
                          <b>{fmtTime(s.startTime)}</b>
                          <small>{s.format}, from {rupee(s.prices.standard)}</small>
                          <small className="d-block">{started ? 'Started' : soldOut ? 'Sold out' : few ? 'Filling fast' : `${s.seatsAvailable} seats left`}</small>
                        </>
                      );
                      return off ? (
                        <span key={s._id} className={cls} aria-disabled="true">{inner}</span>
                      ) : (
                        <Link key={s._id} to={`/shows/${s._id}/seats`} className={cls}>{inner}</Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
