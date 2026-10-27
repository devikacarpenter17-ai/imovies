import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import api, { errMsg } from '../api';
import { socket } from '../socket';
import { fmtLong, fmtTime, rupee } from '../utils/format';

const TIER_NAMES = { standard: 'Standard', premium: 'Premium', recliner: 'Recliner' };

export default function SeatSelection() {
  const { id } = useParams();
  const nav = useNavigate();
  const user = useSelector((s) => s.auth.user);

  const [data, setData] = useState(null);
  const [seats, setSeats] = useState([]);
  const [sel, setSel] = useState([]); // selected seat ids
  const [live, setLive] = useState(socket.connected);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const selRef = useRef([]);
  selRef.current = sel;
  const lockingRef = useRef(false); // ignore our own lock broadcasts while locking

  const load = () =>
    api.get(`/shows/${id}`)
      .then(({ data: d }) => {
        setData(d);
        setSeats(d.seats);
        // Seats we already hold (e.g. user pressed Back from checkout) start selected
        setSel(d.seats.filter((s) => s.mine).map((s) => s._id));
      })
      .catch((e) => setError(errMsg(e)));

  useEffect(() => {
    load();
  }, [id, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live seat updates from other people booking at the same time
  useEffect(() => {
    const onUpdate = ({ showId, seats: ids, status }) => {
      if (showId !== id) return;
      setSeats((prev) => prev.map((s) => (ids.includes(s._id) ? { ...s, status, mine: false } : s)));
      if (status !== 'available' && !lockingRef.current) {
        const lost = selRef.current.filter((x) => ids.includes(x));
        if (lost.length) {
          setSel((p) => p.filter((x) => !lost.includes(x)));
          toast.warn('A seat you picked was just taken. Choose another.');
        }
      }
    };
    const onConnect = () => {
      setLive(true);
      socket.emit('show:join', id);
      load(); // resync after a reconnect so nothing is stale
    };
    const onDisconnect = () => setLive(false);

    socket.on('seats:update', onUpdate);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.connect();
    if (socket.connected) socket.emit('show:join', id);

    return () => {
      socket.emit('show:leave', id);
      socket.off('seats:update', onUpdate);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => {
    const map = new Map();
    seats.forEach((s) => {
      if (!map.has(s.row)) map.set(s.row, []);
      map.get(s.row).push(s);
    });
    return [...map.entries()].map(([name, list]) => ({ name, list, tier: list[0].tier, price: list[0].price }));
  }, [seats]);

  const maxSeats = data?.maxSeats || 8;
  const chosen = seats.filter((s) => sel.includes(s._id)).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  const subtotal = chosen.reduce((n, s) => n + s.price, 0);
  const fee = Math.round(subtotal * 0.05);

  const toggle = (seat) => {
    if (seat.status === 'booked' || (seat.status === 'locked' && !seat.mine)) return;
    setSel((prev) => {
      if (prev.includes(seat._id)) return prev.filter((x) => x !== seat._id);
      if (prev.length >= maxSeats) {
        toast.info(`You can book up to ${maxSeats} seats at a time.`);
        return prev;
      }
      return [...prev, seat._id];
    });
  };

  const proceed = async () => {
    if (!user) {
      toast.info('Sign in to hold your seats.');
      return nav('/login', { state: { from: `/shows/${id}/seats` } });
    }
    setBusy(true);
    lockingRef.current = true;
    try {
      await api.post(`/shows/${id}/lock`, { seatIds: sel });
      nav(`/checkout/${id}`);
    } catch (e) {
      toast.error(errMsg(e));
      lockingRef.current = false;
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="container page"><div className="alert-err" role="alert">{error}</div></div>;
  if (!data) return <div className="container page"><div className="skeleton" style={{ height: 520 }} /></div>;

  const { show } = data;
  const started = new Date(show.startTime) < new Date();
  const half = Math.floor(show.seatsPerRow / 2);

  const seatState = (s) => {
    if (sel.includes(s._id)) return 'is-selected';
    if (s.status === 'booked') return 'is-booked';
    if (s.status === 'locked' && !s.mine) return 'is-held';
    return '';
  };
  const seatLabel = (s) => {
    const base = `Seat ${s.label}, ${TIER_NAMES[s.tier]}, ${rupee(s.price)}`;
    if (sel.includes(s._id)) return `${base}, selected`;
    if (s.status === 'booked') return `${base}, booked`;
    if (s.status === 'locked' && !s.mine) return `${base}, held by someone else`;
    return `${base}, available`;
  };

  return (
    <div className="container page">
      <div className="show-bar">
        <div>
          <Link to={`/movies/${show.movie._id}`} className="small text-muted-2">‹ All showtimes</Link>
          <h1 className="h2 mb-1">{show.movie.title}</h1>
          <div className="text-muted-2">
            {show.theatre.name}, {show.theatre.city}. {show.screenName}
          </div>
        </div>
        <div className="text-md-end">
          <div className="fw-bold fs-5">{fmtLong(show.startTime)}</div>
          <div className="d-flex gap-2 justify-content-md-end align-items-center mt-1">
            <span className="chip brass">{fmtTime(show.startTime)}</span>
            <span className="chip">{show.format}</span>
            <span className={`live ${live ? '' : 'off'}`}>{live ? 'Live availability' : 'Reconnecting…'}</span>
          </div>
        </div>
      </div>

      {started && <div className="alert-err mt-3">This show has already started, so seats can no longer be booked.</div>}

      <div className="seat-layout">
        <section aria-label="Seat map">
          <div className="screen-wrap"><div className="screen" /></div>
          <div className="screen-label">Screen this way</div>

          <div className="seatmap">
            <div className="seatmap-inner" role="group" aria-label="Seats">
              {rows.map((r, idx) => (
                <div key={r.name} className="d-contents">
                  {(idx === 0 || rows[idx - 1].tier !== r.tier) && (
                    <div className="tier-label"><span><b>{TIER_NAMES[r.tier]}</b> {rupee(r.price)}</span></div>
                  )}
                  <div className="seat-row">
                    <span className="row-name" aria-hidden="true">{r.name}</span>
                    {r.list.map((s) => (
                      <button
                        key={s._id}
                        type="button"
                        className={`seat tier-${s.tier} ${seatState(s)} ${s.number === half ? 'gap-after' : ''}`}
                        onClick={() => toggle(s)}
                        disabled={started || s.status === 'booked' || (s.status === 'locked' && !s.mine)}
                        aria-label={seatLabel(s)}
                        aria-pressed={sel.includes(s._id)}
                        title={`${s.label}, ${rupee(s.price)}`}
                      >
                        {s.status === 'booked' ? '' : s.number}
                      </button>
                    ))}
                    <span className="row-name" aria-hidden="true">{r.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="legend" aria-label="Legend">
            <span><i className="seat tier-standard" /> Available</span>
            <span><i className="seat is-selected" /> Your pick</span>
            <span><i className="seat is-held tier-standard" /> Held by someone</span>
            <span><i className="seat is-booked tier-standard" /> Booked</span>
          </div>
        </section>

        <aside className="summary" aria-label="Booking summary">
          <h3>Your seats</h3>
          <div className="sel-seats" aria-live="polite">
            {chosen.length === 0 ? <span className="text-muted-2">Pick up to {maxSeats} seats on the map.</span> : chosen.map((s) => <span className="chip" key={s._id}>{s.label}</span>)}
          </div>
          {chosen.length > 0 && (
            <>
              <div className="sum-row"><span>{chosen.length} {chosen.length === 1 ? 'ticket' : 'tickets'}</span><span>{rupee(subtotal)}</span></div>
              <div className="sum-row"><span>Convenience fee</span><span>{rupee(fee)}</span></div>
              <div className="sum-row total"><span>Total</span><span>{rupee(subtotal + fee)}</span></div>
            </>
          )}
          <button className="btn btn-brand w-100 mt-3 btn-lg" disabled={!chosen.length || busy || started} onClick={proceed}>
            {busy ? 'Holding seats…' : user ? 'Continue to payment' : 'Sign in to continue'}
          </button>
          <p className="hint mt-3 mb-0">We hold your seats for {data.holdMinutes} minutes once you continue, so nobody else can take them while you pay.</p>
        </aside>
      </div>
    </div>
  );
}
