import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import api, { errMsg } from '../api';
import Ticket from '../components/Ticket';
import Modal from '../components/Modal';
import { rupee } from '../utils/format';

export default function BookingView() {
  const { id } = useParams();
  const [b, setB] = useState(null);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/bookings/${id}`).then((r) => setB(r.data)).catch((e) => setError(errMsg(e)));
  }, [id]);

  const cancel = async () => {
    setBusy(true);
    try {
      const { data } = await api.put(`/bookings/${id}/cancel`);
      setB({ ...b, ...data, canCancel: false });
      toast.success('Booking cancelled. Your refund is on its way.');
      setConfirm(false);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="container page"><div className="alert-err">{error}</div></div>;
  if (!b) return <div className="container page"><div className="skeleton" style={{ height: 260 }} /></div>;

  const cancelled = b.status === 'cancelled';
  return (
    <div className="container page" style={{ maxWidth: 860 }}>
      <div className="mb-4">
        <h1 className="page-title">{cancelled ? 'Booking cancelled' : 'You are booked in'}</h1>
        <p className="text-muted-2 mb-0">
          {cancelled ? `${rupee(b.total)} will be refunded to your original payment method.` : 'Show this ticket at the entrance. We also saved it in My bookings.'}
        </p>
      </div>

      <Ticket booking={b} />

      <div className="panel mt-4">
        <div className="sum-row"><span>Tickets</span><span>{rupee(b.subtotal)}</span></div>
        <div className="sum-row"><span>Convenience fee</span><span>{rupee(b.convenienceFee)}</span></div>
        <div className="sum-row total"><span>Total paid</span><span>{rupee(b.total)}</span></div>
        {b.payment && (
          <div className="hint mt-2">
            Paid by {b.payment.method}{b.payment.last4 ? ` ending ${b.payment.last4}` : ''}. Transaction {b.payment.transactionId}.
          </div>
        )}
      </div>

      <div className="d-flex flex-wrap gap-2 mt-4 no-print">
        <Link to="/bookings" className="btn btn-ghost">My bookings</Link>
        {!cancelled && <button className="btn btn-ghost" onClick={() => window.print()}>Print ticket</button>}
        {b.canCancel && <button className="btn btn-ghost" onClick={() => setConfirm(true)}>Cancel booking</button>}
        <Link to="/movies" className="btn btn-brand ms-auto">Book another movie</Link>
      </div>
      {!cancelled && !b.canCancel && <p className="hint mt-3">Cancellation closes 2 hours before the show.</p>}

      {confirm && (
        <Modal title="Cancel this booking?" onClose={() => setConfirm(false)}>
          <p>Your {b.seats.length} {b.seats.length === 1 ? 'seat' : 'seats'} will be released and {rupee(b.total)} refunded. This cannot be undone.</p>
          <div className="d-flex gap-2 justify-content-end">
            <button className="btn btn-ghost" onClick={() => setConfirm(false)}>Keep booking</button>
            <button className="btn btn-brand" disabled={busy} onClick={cancel}>{busy ? 'Cancelling…' : 'Cancel booking'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
