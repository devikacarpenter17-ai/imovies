import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api, { errMsg } from '../api';
import Poster from '../components/Poster';
import Pager from '../components/Pager';
import Modal from '../components/Modal';
import { fmtDate, fmtTime, rupee } from '../utils/format';

const TABS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
  { id: 'cancelled', label: 'Cancelled' },
];

const EMPTY = {
  upcoming: ['No upcoming bookings', 'Pick a movie and your tickets will show up here.'],
  past: ['No past bookings yet', 'Movies you have watched will be listed here.'],
  cancelled: ['No cancelled bookings', 'Anything you cancel will appear here.'],
};

export default function MyBookings() {
  const [tab, setTab] = useState('upcoming');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], pages: 1 });
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/bookings/mine', { params: { when: tab, page, limit: 6 } })
      .then((r) => setData(r.data))
      .catch((e) => toast.error(errMsg(e)))
      .finally(() => setLoading(false));
  };
  useEffect(load, [tab, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancel = async () => {
    setBusy(true);
    try {
      await api.put(`/bookings/${target._id}/cancel`);
      toast.success('Booking cancelled. Your refund is on its way.');
      setTarget(null);
      load();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container page" style={{ maxWidth: 940 }}>
      <h1 className="page-title">My bookings</h1>
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" className="tab" aria-selected={tab === t.id} onClick={() => { setTab(t.id); setPage(1); }}>{t.label}</button>
        ))}
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 110 }} />
      ) : data.items.length === 0 ? (
        <div className="empty">
          <h3>{EMPTY[tab][0]}</h3>
          <p>{EMPTY[tab][1]}</p>
          {tab === 'upcoming' && <Link to="/movies" className="btn btn-brand">Browse movies</Link>}
        </div>
      ) : data.items.map((b) => (
        <article className="bk" key={b._id}>
          <Poster movie={b.movie} />
          <div>
            <div className="d-flex flex-wrap align-items-center gap-2">
              <h3>{b.movie.title}</h3>
              <span className={`status ${b.status}`}>{b.status === 'confirmed' ? 'Confirmed' : 'Cancelled'}</span>
            </div>
            <div className="text-muted-2 small">{b.theatre.name}, {b.theatre.city}</div>
            <div className="mt-1">{fmtDate(b.show.startTime)} at {fmtTime(b.show.startTime)}</div>
            <div className="chips mt-2">
              {b.seats.map((s) => s.label).sort().map((l) => <span className="chip" key={l}>{l}</span>)}
              <span className="chip brass">{rupee(b.total)}</span>
            </div>
          </div>
          <div className="acts">
            <Link to={`/booking/${b._id}`} className="btn btn-ghost btn-sm">View ticket</Link>
            {b.canCancel && <button className="btn btn-ghost btn-sm" onClick={() => setTarget(b)}>Cancel</button>}
          </div>
        </article>
      ))}

      <Pager page={page} pages={data.pages} onChange={setPage} />

      {target && (
        <Modal title="Cancel this booking?" onClose={() => setTarget(null)}>
          <p>{target.movie.title} on {fmtDate(target.show.startTime)}, {fmtTime(target.show.startTime)}. {rupee(target.total)} will be refunded and your seats released.</p>
          <div className="d-flex gap-2 justify-content-end">
            <button className="btn btn-ghost" onClick={() => setTarget(null)}>Keep booking</button>
            <button className="btn btn-brand" disabled={busy} onClick={cancel}>{busy ? 'Cancelling…' : 'Cancel booking'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
