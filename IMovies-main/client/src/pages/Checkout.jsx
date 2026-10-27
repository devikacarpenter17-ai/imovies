import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import api, { errMsg } from '../api';
import { fmtLong, fmtTime, rupee } from '../utils/format';

const METHODS = [
  { id: 'card', label: 'Card' },
  { id: 'upi', label: 'UPI' },
  { id: 'wallet', label: 'Wallet' },
];

const pad = (n) => String(n).padStart(2, '0');

export default function Checkout() {
  const { id } = useParams();
  const nav = useNavigate();
  const [show, setShow] = useState(null);
  const [mine, setMine] = useState([]);
  const [expiresAt, setExpiresAt] = useState(null);
  const [left, setLeft] = useState(null);
  const [method, setMethod] = useState('card');
  const [card, setCard] = useState({ number: '', name: '', expiry: '', cvv: '' });
  const [upi, setUpi] = useState('');
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [fieldErr, setFieldErr] = useState('');
  const paidRef = useRef(false);

  // The server is the source of truth for which seats this user holds
  useEffect(() => {
    api.get(`/shows/${id}`)
      .then(({ data }) => {
        const held = data.seats.filter((s) => s.mine);
        if (!held.length) {
          toast.info('Your seat hold has expired. Pick your seats again.');
          return nav(`/shows/${id}/seats`, { replace: true });
        }
        setShow(data.show);
        setMine(held);
        setExpiresAt(new Date(Math.min(...held.map((s) => new Date(s.lockedUntil).getTime()))));
        return undefined;
      })
      .catch((e) => setError(errMsg(e)));
    // No unmount cleanup on purpose: if the user leaves, the server releases the hold when the
    // timer ends, and going Back to the seat map keeps their seats selected.
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!expiresAt) return undefined;
    const tick = () => {
      const s = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      setLeft(s);
      if (s === 0 && !paidRef.current) {
        toast.warn('Time ran out and your seats were released.');
        nav(`/shows/${id}/seats`, { replace: true });
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const subtotal = mine.reduce((n, s) => n + s.price, 0);
  const fee = Math.round(subtotal * 0.05);
  const total = subtotal + fee;

  const validate = () => {
    if (method === 'card') {
      if (card.number.replace(/\s/g, '').length !== 16) return 'Enter a 16-digit card number.';
      if (card.name.trim().length < 2) return 'Enter the name on the card.';
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(card.expiry)) return 'Enter the expiry as MM/YY.';
      if (!/^\d{3,4}$/.test(card.cvv)) return 'Enter the 3 or 4 digit CVV.';
    }
    if (method === 'upi' && !/^[\w.-]{2,}@\w{2,}$/.test(upi)) return 'Enter a valid UPI ID, like name@bank.';
    return '';
  };

  const pay = async (e) => {
    e.preventDefault();
    setError('');
    const v = validate();
    setFieldErr(v);
    if (v) return;
    setPaying(true);
    try {
      const { data } = await api.post('/bookings', {
        showId: id,
        seatIds: mine.map((s) => s._id),
        method,
        cardNumber: card.number,
        upiId: upi,
      });
      paidRef.current = true;
      toast.success('Booking confirmed');
      nav(`/booking/${data._id}`, { replace: true });
    } catch (err) {
      setError(errMsg(err));
      if (err.response?.status === 409) {
        paidRef.current = true; // the hold is already gone, nothing to release
        setTimeout(() => nav(`/shows/${id}/seats`, { replace: true }), 1800);
      }
    } finally {
      setPaying(false);
    }
  };

  const fmtCard = (v) => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
  const fmtExpiry = (v) => {
    const d = v.replace(/\D/g, '').slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  if (error && !show) return <div className="container page"><div className="alert-err">{error}</div></div>;
  if (!show) return <div className="container page"><div className="skeleton" style={{ height: 420 }} /></div>;

  return (
    <div className="container page">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
        <div>
          <Link to={`/shows/${id}/seats`} className="small text-muted-2">‹ Change seats</Link>
          <h1 className="page-title mb-0">Payment</h1>
        </div>
        {left !== null && (
          <div className={`timer ${left < 60 ? 'low' : ''}`} role="timer" aria-label="Time left to pay">
            Seats held for {pad(Math.floor(left / 60))}:{pad(left % 60)}
          </div>
        )}
      </div>

      <div className="seat-layout">
        <form className="panel" onSubmit={pay} noValidate>
          <div className="pay-tabs" role="tablist" aria-label="Payment method">
            {METHODS.map((m) => (
              <button type="button" key={m.id} role="tab" className="pay-tab" aria-selected={method === m.id} onClick={() => { setMethod(m.id); setError(''); setFieldErr(''); }}>
                {m.label}
              </button>
            ))}
          </div>

          {method === 'card' && (
            <div className="row g-3">
              <div className="col-12">
                <label className="form-label" htmlFor="cn">Card number</label>
                <input id="cn" className="form-control" inputMode="numeric" autoComplete="cc-number" placeholder="4242 4242 4242 4242" value={card.number} onChange={(e) => setCard({ ...card, number: fmtCard(e.target.value) })} />
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="nm">Name on card</label>
                <input id="nm" className="form-control" autoComplete="cc-name" value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} />
              </div>
              <div className="col-6">
                <label className="form-label" htmlFor="ex">Expiry</label>
                <input id="ex" className="form-control" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" value={card.expiry} onChange={(e) => setCard({ ...card, expiry: fmtExpiry(e.target.value) })} />
              </div>
              <div className="col-6">
                <label className="form-label" htmlFor="cv">CVV</label>
                <input id="cv" className="form-control" inputMode="numeric" autoComplete="cc-csc" type="password" maxLength={4} value={card.cvv} onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, '') })} />
              </div>
            </div>
          )}

          {method === 'upi' && (
            <div>
              <label className="form-label" htmlFor="upi">UPI ID</label>
              <input id="upi" className="form-control" placeholder="name@bank" value={upi} onChange={(e) => setUpi(e.target.value.trim())} />
            </div>
          )}

          {method === 'wallet' && <p className="text-muted-2 mb-0">Pay from your IMovies wallet. This demo wallet always has enough balance.</p>}

          {fieldErr && <p className="form-text-err mt-3 mb-0" role="alert">{fieldErr}</p>}
          {error && <div className="alert-err mt-3" role="alert">{error}</div>}

          <button className="btn btn-brand btn-lg w-100 mt-4" disabled={paying}>
            {paying ? 'Processing payment…' : `Pay ${rupee(total)}`}
          </button>
          <p className="hint mt-3 mb-0">
            Demo payments only, no real money moves. To test a failed payment, use a card ending in 0000 or a UPI ID starting with "fail".
          </p>
        </form>

        <aside className="summary">
          <h3>{show.movie.title}</h3>
          <div className="text-muted-2 small mb-3">
            {show.theatre.name}, {show.theatre.city}
            <br />{fmtLong(show.startTime)} at {fmtTime(show.startTime)}
            <br />{show.screenName}, {show.format}
          </div>
          <div className="sel-seats">{mine.map((s) => <span className="chip" key={s._id}>{s.label}</span>)}</div>
          <div className="sum-row"><span>{mine.length} {mine.length === 1 ? 'ticket' : 'tickets'}</span><span>{rupee(subtotal)}</span></div>
          <div className="sum-row"><span>Convenience fee</span><span>{rupee(fee)}</span></div>
          <div className="sum-row total"><span>Total</span><span>{rupee(total)}</span></div>
        </aside>
      </div>
    </div>
  );
}
