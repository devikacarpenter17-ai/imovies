import Poster from '../components/Poster';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import api, { errMsg } from '../api';
import Modal from '../components/Modal';
import Pager from '../components/Pager';
import { fmtDate, fmtTime, rupee, toLocalInput } from '../utils/format';

const TABS = ['Overview', 'Movies', 'Shows', 'Theatres', 'Bookings', 'Users'];
const csv = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);

/* ---------- Overview ---------- */
function Overview() {
  const [s, setS] = useState(null);
  useEffect(() => {
    api.get('/admin/stats').then((r) => setS(r.data)).catch((e) => toast.error(errMsg(e)));
  }, []);
  if (!s) return <div className="skeleton" style={{ height: 240 }} />;

  const max = Math.max(1, ...s.perDay.map((d) => d.revenue));
  return (
    <>
      <div className="stat-grid">
        <div className="stat"><small>Revenue</small><b>{rupee(s.revenue)}</b></div>
        <div className="stat"><small>Confirmed bookings</small><b>{s.bookings}</b></div>
        <div className="stat"><small>Upcoming shows</small><b>{s.upcomingShows}</b></div>
        <div className="stat"><small>Movies</small><b>{s.movies}</b></div>
        <div className="stat"><small>Registered users</small><b>{s.users}</b></div>
      </div>
      <div className="row g-3 mt-1">
        <div className="col-lg-7">
          <div className="panel h-100">
            <h3 className="h5">Revenue, last 7 days</h3>
            {s.perDay.length === 0 ? <p className="text-muted-2">No bookings in the last 7 days.</p> : (
              <div className="bars" role="img" aria-label="Bar chart of daily revenue">
                {s.perDay.map((d) => (
                  <div className="bar-col" key={d._id}>
                    <span>{rupee(d.revenue)}</span>
                    <i style={{ height: `${(d.revenue / max) * 100}%` }} />
                    <span>{fmtDate(d._id)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="col-lg-5">
          <div className="panel h-100">
            <h3 className="h5">Top movies by revenue</h3>
            {s.topMovies.length === 0 ? <p className="text-muted-2">Bookings will rank movies here.</p> : s.topMovies.map((m) => (
              <div className="sum-row" key={m._id}><span className="text-body">{m.title}</span><span>{rupee(m.revenue)}, {m.tickets} tickets</span></div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------- Movies ---------- */
const blankMovie = {
  title: '', tagline: '', description: '', genres: '', language: 'English', durationMins: 120, certificate: 'UA', score: 0,
  releaseDate: new Date().toISOString().slice(0, 10), status: 'now_showing', director: '', cast: '', posterUrl: '',
  backdropUrl: '', trailerUrl: '', from: '#3b2a5c', to: '#12101a', accent: '#ffb020',
};

function Movies() {
  const [data, setData] = useState({ items: [], pages: 1 });
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.get('/movies', { params: { page, limit: 8, sort: 'added' } }).then((r) => setData(r.data)).catch((e) => toast.error(errMsg(e)));
  }, [page]);
  useEffect(() => {
    load();
  }, [load]);

  const open = (m) => {
    setEditing(m?._id || null);
    setForm(m ? {
      ...blankMovie, ...m, genres: m.genres.join(', '), cast: (m.cast || []).join(', '),
      releaseDate: m.releaseDate.slice(0, 10), from: m.theme?.from, to: m.theme?.to, accent: m.theme?.accent,
    } : blankMovie);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    const { from, to, accent, genres, cast, ...rest } = form;
    const body = { ...rest, genres: csv(genres), cast: csv(cast), durationMins: Number(rest.durationMins), score: Number(rest.score), theme: { from, to, accent } };
    delete body.tmdbId; delete body.itunesId; delete body.source; delete body._id; delete body.__v; delete body.createdAt; delete body.updatedAt;
    try {
      if (editing) await api.put(`/movies/${editing}`, body); else await api.post('/movies', body);
      toast.success(editing ? 'Movie updated' : 'Movie added. Now add shows for it in the Shows tab so people can book it.');
      if (!editing) setPage(1);
      setForm(null);
      load();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (m) => {
    if (!window.confirm(`Delete "${m.title}"?`)) return;
    try {
      await api.delete(`/movies/${m._id}`);
      toast.success('Movie deleted');
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const f = (k) => ({ value: form[k] ?? '', onChange: (e) => setForm({ ...form, [k]: e.target.value }) });

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="h4 mb-0">Movies</h2>
        <button className="btn btn-brand" onClick={() => open(null)}>Add movie</button>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Title</th><th>Language</th><th>Status</th><th>Release</th><th>Score</th><th /></tr></thead>
          <tbody>
            {data.items.map((m) => (
              <tr key={m._id}>
                <td className="fw-bold">{m.title}</td><td>{m.language}</td>
                <td><span className={`status ${m.status === 'now_showing' ? 'confirmed' : ''}`}>{m.status === 'now_showing' ? 'Now showing' : 'Upcoming'}</span></td>
                <td>{fmtDate(m.releaseDate)}</td><td>{m.score || '-'}</td>
                <td className="text-end text-nowrap">
                  <button className="btn btn-ghost btn-sm me-2" onClick={() => open(m)}>Edit</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => remove(m)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} pages={data.pages} onChange={setPage} />

      {form && (
        <Modal title={editing ? 'Edit movie' : 'Add movie'} onClose={() => setForm(null)} wide>
          <form onSubmit={save}>
            <div className="row g-3">
              <div className="col-md-8"><label className="form-label">Title</label><input className="form-control" required {...f('title')} /></div>
              <div className="col-md-4"><label className="form-label">Status</label>
                <select className="form-select" {...f('status')}><option value="now_showing">Now showing</option><option value="upcoming">Upcoming</option></select></div>
              <div className="col-12"><label className="form-label">Tagline</label><input className="form-control" {...f('tagline')} /></div>
              <div className="col-12"><label className="form-label">Description</label><textarea className="form-control" rows="3" required {...f('description')} /></div>
              <div className="col-md-6"><label className="form-label">Genres (comma separated)</label><input className="form-control" placeholder="Drama, Thriller" {...f('genres')} /></div>
              <div className="col-md-3"><label className="form-label">Language</label><input className="form-control" list="lang-list" placeholder="Pick or type" required {...f('language')} />
                <datalist id="lang-list">{['Hindi', 'English', 'Tamil', 'Telugu', 'Malayalam', 'Kannada', 'Bengali', 'Marathi', 'Gujarati', 'Punjabi', 'Korean', 'Japanese'].map((l) => <option key={l} value={l} />)}</datalist></div>
              <div className="col-md-3"><label className="form-label">Certificate</label><select className="form-select" {...f('certificate')}>{['U', 'UA', 'A'].map((c) => <option key={c}>{c}</option>)}</select></div>
              <div className="col-md-3"><label className="form-label">Duration (min)</label><input type="number" min="1" className="form-control" required {...f('durationMins')} /></div>
              <div className="col-md-3"><label className="form-label">Score (0-10)</label><input type="number" min="0" max="10" step="0.1" className="form-control" {...f('score')} /></div>
              <div className="col-md-3"><label className="form-label">Release date</label><input type="date" className="form-control" required {...f('releaseDate')} /></div>
              <div className="col-md-3"><label className="form-label">Director</label><input className="form-control" {...f('director')} /></div>
              <div className="col-md-6"><label className="form-label">Cast (comma separated)</label><input className="form-control" {...f('cast')} /></div>
              <div className="col-md-6"><label className="form-label">Poster image URL (optional)</label><input className="form-control" placeholder="Paste a direct image link (ends in .jpg or .png)" {...f('posterUrl')} />
                {form.posterUrl && <div style={{ width: 90, marginTop: 8 }}><Poster movie={{ ...form, genres: [], theme: { from: form.from, to: form.to, accent: form.accent } }} /></div>}
                <div className="form-text">Right-click an image on a website, choose Copy image address, and paste it here. Links to a web page will not work.</div></div>
              <div className="col-md-6"><label className="form-label">Wide banner image URL (optional)</label><input className="form-control" {...f('backdropUrl')} /></div>
              <div className="col-md-6"><label className="form-label">Trailer link (optional)</label><input className="form-control" placeholder="https://www.youtube.com/watch?v=..." {...f('trailerUrl')} /></div>
              <div className="col-4"><label className="form-label">Poster top</label><input type="color" className="form-control" {...f('from')} /></div>
              <div className="col-4"><label className="form-label">Poster bottom</label><input type="color" className="form-control" {...f('to')} /></div>
              <div className="col-4"><label className="form-label">Accent</label><input type="color" className="form-control" {...f('accent')} /></div>
            </div>
            <div className="d-flex gap-2 justify-content-end mt-4">
              <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Cancel</button>
              <button className="btn btn-brand" disabled={saving}>{saving ? 'Saving…' : 'Save movie'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

/* ---------- Theatres ---------- */
function Theatres() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState(null); // { id?, name, city, address, amenities, screenCount, rows, seatsPerRow }
  const [saving, setSaving] = useState(false);
  const load = useCallback(() => api.get('/theatres').then((r) => setList(r.data)).catch((e) => toast.error(errMsg(e))), []);
  useEffect(() => {
    load();
  }, [load]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (form.id) {
        // Screens are not edited here, because existing shows already depend on them
        await api.put(`/theatres/${form.id}`, { name: form.name, city: form.city, address: form.address, amenities: csv(form.amenities) });
        toast.success('Theatre updated');
      } else {
        const screens = Array.from({ length: Number(form.screenCount) }, (_, i) => ({ name: `Screen ${i + 1}`, rows: Number(form.rows), seatsPerRow: Number(form.seatsPerRow) }));
        await api.post('/theatres', { name: form.name, city: form.city, address: form.address, amenities: csv(form.amenities), screens });
        toast.success('Theatre added');
      }
      setForm(null);
      load();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t) => {
    if (!window.confirm(`Delete ${t.name}?`)) return;
    try { await api.delete(`/theatres/${t._id}`); toast.success('Theatre deleted'); load(); } catch (err) { toast.error(errMsg(err)); }
  };

  const f = (k) => ({ value: form[k], onChange: (e) => setForm({ ...form, [k]: e.target.value }) });
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="h4 mb-0">Theatres</h2>
        <button className="btn btn-brand" onClick={() => setForm({ name: '', city: '', address: '', amenities: '', screenCount: 2, rows: 10, seatsPerRow: 12 })}>Add theatre</button>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Name</th><th>City</th><th>Screens</th><th>Amenities</th><th /></tr></thead>
          <tbody>
            {list.map((t) => (
              <tr key={t._id}>
                <td className="fw-bold">{t.name}<div className="text-muted-2 small fw-normal">{t.address}</div></td>
                <td>{t.city}</td><td>{t.screens.length}</td><td>{t.amenities?.join(', ')}</td>
                <td className="text-end text-nowrap">
                  <button className="btn btn-ghost btn-sm me-2" onClick={() => setForm({ id: t._id, name: t.name, city: t.city, address: t.address || '', amenities: (t.amenities || []).join(', ') })}>Edit</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => remove(t)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {form && (
        <Modal title={form.id ? 'Edit theatre' : 'Add theatre'} onClose={() => setForm(null)}>
          <form onSubmit={save}>
            <div className="row g-3">
              <div className="col-md-7"><label className="form-label">Name</label><input className="form-control" required {...f('name')} /></div>
              <div className="col-md-5"><label className="form-label">City</label><input className="form-control" required {...f('city')} /></div>
              <div className="col-12"><label className="form-label">Address</label><input className="form-control" {...f('address')} /></div>
              <div className="col-12"><label className="form-label">Amenities (comma separated)</label><input className="form-control" {...f('amenities')} /></div>
              {!form.id && (
                <>
                  <div className="col-4"><label className="form-label">Screens</label><input type="number" min="1" max="12" className="form-control" {...f('screenCount')} /></div>
                  <div className="col-4"><label className="form-label">Rows</label><input type="number" min="3" max="20" className="form-control" {...f('rows')} /></div>
                  <div className="col-4"><label className="form-label">Seats per row</label><input type="number" min="4" max="24" className="form-control" {...f('seatsPerRow')} /></div>
                </>
              )}
            </div>
            <div className="d-flex gap-2 justify-content-end mt-4">
              <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Cancel</button>
              <button className="btn btn-brand" disabled={saving}>{saving ? 'Saving…' : 'Save theatre'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

/* ---------- Shows ---------- */
function Shows() {
  const [shows, setShows] = useState([]);
  const [movies, setMovies] = useState([]);
  const [theatres, setTheatres] = useState([]);
  const [form, setForm] = useState(null);
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => api.get('/shows').then((r) => setShows(r.data)).catch((e) => toast.error(errMsg(e))), []);
  useEffect(() => {
    load();
    api.get('/movies', { params: { status: 'now_showing', limit: 48 } }).then((r) => setMovies(r.data.items));
    api.get('/theatres').then((r) => setTheatres(r.data));
  }, [load]);

  const theatre = theatres.find((t) => t._id === form?.theatre);

  const openForm = () => {
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(18, 0, 0, 0);
    setForm({ movie: movies[0]?._id || '', theatre: theatres[0]?._id || '', screenName: theatres[0]?.screens[0]?.name || '', startTime: toLocalInput(d), format: '2D', standard: 150, premium: 250, recliner: 400 });
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/shows', {
        movie: form.movie, theatre: form.theatre, screenName: form.screenName, startTime: new Date(form.startTime).toISOString(), format: form.format,
        prices: { standard: Number(form.standard), premium: Number(form.premium), recliner: Number(form.recliner) },
      });
      toast.success('Show scheduled');
      setForm(null);
      load();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (s) => setEdit({
    id: s._id, title: s.movie.title, startTime: toLocalInput(s.startTime), format: s.format,
    standard: s.prices.standard, premium: s.prices.premium, recliner: s.prices.recliner,
  });

  const saveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/shows/${edit.id}`, {
        startTime: new Date(edit.startTime).toISOString(),
        format: edit.format,
        prices: { standard: Number(edit.standard), premium: Number(edit.premium), recliner: Number(edit.recliner) },
      });
      toast.success('Show updated');
      setEdit(null);
      load();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s) => {
    if (!window.confirm('Delete this show?')) return;
    try { await api.delete(`/shows/${s._id}`); toast.success('Show deleted'); load(); } catch (err) { toast.error(errMsg(err)); }
  };

  const f = (k) => ({ value: form[k], onChange: (e) => setForm({ ...form, [k]: e.target.value }) });
  const g = (k) => ({ value: edit[k], onChange: (e) => setEdit({ ...edit, [k]: e.target.value }) });
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="h4 mb-0">Upcoming shows</h2>
        <button className="btn btn-brand" onClick={openForm} disabled={!movies.length || !theatres.length}>Schedule show</button>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Movie</th><th>Theatre</th><th>When</th><th>Format</th><th>Seats left</th><th /></tr></thead>
          <tbody>
            {shows.slice(0, 60).map((s) => (
              <tr key={s._id}>
                <td className="fw-bold">{s.movie.title}</td>
                <td>{s.theatre.name}<div className="text-muted-2 small">{s.screenName}, {s.theatre.city}</div></td>
                <td>{fmtDate(s.startTime)}, {fmtTime(s.startTime)}</td><td>{s.format}</td>
                <td>{s.seatsAvailable} of {s.seatsTotal}</td>
                <td className="text-end text-nowrap">
                  <button className="btn btn-ghost btn-sm me-2" onClick={() => openEdit(s)}>Edit</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => remove(s)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shows.length > 60 && <p className="hint mt-2">Showing the next 60 of {shows.length} shows.</p>}

      {form && (
        <Modal title="Schedule a show" onClose={() => setForm(null)}>
          <form onSubmit={save}>
            <div className="row g-3">
              <div className="col-12"><label className="form-label">Movie</label>
                <select className="form-select" {...f('movie')}>{movies.map((m) => <option key={m._id} value={m._id}>{m.title}</option>)}</select></div>
              <div className="col-md-7"><label className="form-label">Theatre</label>
                <select className="form-select" value={form.theatre} onChange={(e) => { const t = theatres.find((x) => x._id === e.target.value); setForm({ ...form, theatre: e.target.value, screenName: t.screens[0]?.name || '' }); }}>
                  {theatres.map((t) => <option key={t._id} value={t._id}>{t.name}, {t.city}</option>)}</select></div>
              <div className="col-md-5"><label className="form-label">Screen</label>
                <select className="form-select" {...f('screenName')}>{theatre?.screens.map((s) => <option key={s.name}>{s.name}</option>)}</select></div>
              <div className="col-md-8"><label className="form-label">Start time</label><input type="datetime-local" className="form-control" required {...f('startTime')} /></div>
              <div className="col-md-4"><label className="form-label">Format</label><select className="form-select" {...f('format')}>{['2D', '3D', 'IMAX', '4DX'].map((x) => <option key={x}>{x}</option>)}</select></div>
              <div className="col-4"><label className="form-label">Standard ₹</label><input type="number" min="1" className="form-control" {...f('standard')} /></div>
              <div className="col-4"><label className="form-label">Premium ₹</label><input type="number" min="1" className="form-control" {...f('premium')} /></div>
              <div className="col-4"><label className="form-label">Recliner ₹</label><input type="number" min="1" className="form-control" {...f('recliner')} /></div>
            </div>
            <div className="d-flex gap-2 justify-content-end mt-4">
              <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Cancel</button>
              <button className="btn btn-brand" disabled={saving}>{saving ? 'Scheduling…' : 'Schedule show'}</button>
            </div>
          </form>
        </Modal>
      )}

      {edit && (
        <Modal title={`Edit show: ${edit.title}`} onClose={() => setEdit(null)}>
          <form onSubmit={saveEdit}>
            <div className="row g-3">
              <div className="col-md-8"><label className="form-label">Start time</label><input type="datetime-local" className="form-control" required {...g('startTime')} /></div>
              <div className="col-md-4"><label className="form-label">Format</label><select className="form-select" {...g('format')}>{['2D', '3D', 'IMAX', '4DX'].map((x) => <option key={x}>{x}</option>)}</select></div>
              <div className="col-4"><label className="form-label">Standard ₹</label><input type="number" min="1" className="form-control" {...g('standard')} /></div>
              <div className="col-4"><label className="form-label">Premium ₹</label><input type="number" min="1" className="form-control" {...g('premium')} /></div>
              <div className="col-4"><label className="form-label">Recliner ₹</label><input type="number" min="1" className="form-control" {...g('recliner')} /></div>
            </div>
            <p className="hint mt-3 mb-0">New prices apply to seats that are not booked yet. Already booked tickets keep the price they were bought at.</p>
            <div className="d-flex gap-2 justify-content-end mt-4">
              <button type="button" className="btn btn-ghost" onClick={() => setEdit(null)}>Cancel</button>
              <button className="btn btn-brand" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

/* ---------- Bookings ---------- */
function Bookings() {
  const [data, setData] = useState({ items: [], pages: 1 });
  const [page, setPage] = useState(1);
  const load = useCallback(() => {
    api.get('/admin/bookings', { params: { page, limit: 12 } }).then((r) => setData(r.data)).catch((e) => toast.error(errMsg(e)));
  }, [page]);
  useEffect(() => {
    load();
  }, [load]);

  const cancel = async (b) => {
    if (!window.confirm(`Cancel booking ${b.code} and refund ${rupee(b.total)}?`)) return;
    try {
      await api.put(`/bookings/${b._id}/cancel`);
      toast.success('Booking cancelled and seats released');
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <>
      <h2 className="h4 mb-3">All bookings</h2>
      {data.items.length === 0 ? <div className="empty"><h3>No bookings yet</h3><p>Bookings made on the site will be listed here.</p></div> : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Code</th><th>Customer</th><th>Movie</th><th>Show</th><th>Seats</th><th>Total</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data.items.map((b) => (
                <tr key={b._id}>
                  <td className="fw-bold">{b.code}</td>
                  <td>{b.user?.name}<div className="text-muted-2 small">{b.user?.email}</div></td>
                  <td>{b.movie?.title}</td>
                  <td>{b.show && `${fmtDate(b.show.startTime)}, ${fmtTime(b.show.startTime)}`}<div className="text-muted-2 small">{b.theatre?.name}</div></td>
                  <td>{b.seats.map((s) => s.label).join(', ')}</td><td>{rupee(b.total)}</td>
                  <td><span className={`status ${b.status}`}>{b.status === 'confirmed' ? 'Confirmed' : 'Cancelled'}</span></td>
                  <td className="text-end">{b.status === 'confirmed' && <button className="btn btn-ghost btn-sm" onClick={() => cancel(b)}>Cancel</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} pages={data.pages} onChange={setPage} />
    </>
  );
}

/* ---------- Users ---------- */
function Users() {
  const me = useSelector((s) => s.auth.user);
  const [data, setData] = useState({ items: [], pages: 1 });
  const [page, setPage] = useState(1);
  const load = useCallback(() => {
    api.get('/admin/users', { params: { page, limit: 12 } }).then((r) => setData(r.data)).catch((e) => toast.error(errMsg(e)));
  }, [page]);
  useEffect(() => {
    load();
  }, [load]);

  const setRole = async (u, role) => {
    if (!window.confirm(role === 'admin' ? `Give ${u.name} admin access?` : `Remove admin access from ${u.name}?`)) return;
    try {
      await api.put(`/admin/users/${u._id}/role`, { role });
      toast.success(`${u.name} is now ${role === 'admin' ? 'an admin' : 'a regular user'}`);
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <>
      <h2 className="h4 mb-3">Users</h2>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Bookings</th><th>Spent</th><th>Joined</th><th /></tr></thead>
          <tbody>
            {data.items.map((u) => (
              <tr key={u._id}>
                <td className="fw-bold">{u.name}</td><td>{u.email}</td>
                <td><span className={`role-chip ${u.role}`}>{u.role === 'admin' ? 'Admin' : 'User'}</span></td>
                <td>{u.bookings}</td><td>{rupee(u.spent)}</td><td>{fmtDate(u.createdAt)}</td>
                <td className="text-end text-nowrap">
                  {u._id === me?.id ? <span className="text-muted-2 small">You</span> : (
                    <button className="btn btn-ghost btn-sm" onClick={() => setRole(u, u.role === 'admin' ? 'user' : 'admin')}>
                      {u.role === 'admin' ? 'Remove admin' : 'Make admin'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} pages={data.pages} onChange={setPage} />
    </>
  );
}

export default function Admin() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.includes(params.get('tab')) ? params.get('tab') : 'Overview';
  const View = { Overview, Movies, Shows, Theatres, Bookings, Users }[tab];
  return (
    <div className="container page">
      <div className="d-flex flex-wrap align-items-center gap-3">
        <h1 className="page-title mb-0">Admin panel</h1>
        <span className="chip brass">Signed in as admin</span>
      </div>
      <p className="text-muted-2 mt-2">Manage movies, shows, theatres, bookings and users.</p>
      <div className="tabs" role="tablist">
        {TABS.map((t) => <button key={t} role="tab" className="tab" aria-selected={tab === t} onClick={() => setParams({ tab: t })}>{t}</button>)}
      </div>
      <View />
    </div>
  );
}
