import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { errMsg } from '../api';
import MovieCard, { MovieGridSkeleton } from '../components/MovieCard';
import Pager from '../components/Pager';
import DateStrip from '../components/DateStrip';
import { useCity } from '../context/CityContext';

export default function Movies() {
  const [params, setParams] = useSearchParams();
  const { genres, languages, cities, city, setCity } = useCity();
  const [data, setData] = useState({ items: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchText, setSearchText] = useState(params.get('search') || '');

  const get = (k) => params.get(k) || '';
  const set = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };

  // Keep the box in sync when the navbar search changes the URL
  useEffect(() => {
    setSearchText(get('search'));
  }, [params.get('search')]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce typing so we do not query on every keystroke
  useEffect(() => {
    const t = setTimeout(() => searchText !== get('search') && set({ search: searchText.trim() }), 350);
    return () => clearTimeout(t);
  }, [searchText]); // eslint-disable-line react-hooks/exhaustive-deps

  const query = params.toString();
  useEffect(() => {
    setLoading(true);
    setError('');
    api.get('/movies', {
      params: {
        search: get('search') || undefined,
        genre: get('genre') || undefined,
        language: get('language') || undefined,
        status: get('status') || undefined,
        date: get('date') || undefined,
        sort: get('sort') || 'newest',
        city: city || undefined,
        page: get('page') || 1,
        limit: 12,
      },
    })
      .then((r) => setData(r.data))
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, [query, city]); // eslint-disable-line react-hooks/exhaustive-deps

  const status = get('status');
  const active = ['search', 'genre', 'language', 'date'].some((k) => get(k)) || city;

  return (
    <div className="container page">
      <h1 className="page-title">{status === 'upcoming' ? 'Coming soon' : 'Movies'}</h1>
      <p className="text-muted-2">
        {loading ? 'Loading…' : `${data.total} ${data.total === 1 ? 'movie' : 'movies'}`}
        {city ? ` with shows in ${city}` : ''}
      </p>

      <div className="filter-bar">
        <div className="search">
          <label className="form-label" htmlFor="f-search">Search</label>
          <input id="f-search" className="form-control" placeholder="Movie title" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
        </div>
        <div>
          <label className="form-label" htmlFor="f-genre">Genre</label>
          <select id="f-genre" className="form-select" value={get('genre')} onChange={(e) => set({ genre: e.target.value })}>
            <option value="">All genres</option>
            {genres.map((g) => <option key={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label" htmlFor="f-lang">Language</label>
          <select id="f-lang" className="form-select" value={get('language')} onChange={(e) => set({ language: e.target.value })}>
            <option value="">All languages</option>
            {languages.map((l) => <option key={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label" htmlFor="f-city">City</label>
          <select id="f-city" className="form-select" value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="">All cities</option>
            {cities.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label" htmlFor="f-sort">Sort by</label>
          <select id="f-sort" className="form-select" value={get('sort') || 'newest'} onChange={(e) => set({ sort: e.target.value })}>
            <option value="newest">Newest</option>
            <option value="rating">Top rated</option>
            <option value="title">Title A–Z</option>
          </select>
        </div>
      </div>

      <div className="mb-4">
        <div className="form-label">Shows on</div>
        <DateStrip value={get('date')} onChange={(d) => set({ date: d })} allowAny />
      </div>

      {error && <div className="alert-err mb-3" role="alert">{error}</div>}

      {loading ? <MovieGridSkeleton count={12} /> : data.items.length ? (
        <div className="movie-grid">{data.items.map((m) => <MovieCard key={m._id} movie={m} />)}</div>
      ) : (
        <div className="empty">
          <h3>No movies match these filters</h3>
          <p>Try a different date, city or genre.</p>
          {active && (
            <button className="btn btn-ghost" onClick={() => { setParams({}, { replace: true }); setCity(''); }}>
              Clear all filters
            </button>
          )}
        </div>
      )}

      <Pager page={Number(get('page') || 1)} pages={data.pages} onChange={(p) => set({ page: String(p) })} />
    </div>
  );
}
