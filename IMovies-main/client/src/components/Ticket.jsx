import { fmtLong, fmtTime, rupee } from '../utils/format';

// Decorative, deterministic QR-style pattern generated from the booking code (not a scannable QR).
function Pattern({ code }) {
  const N = 21;
  let seed = [...code].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const inFinder = (x, y) => [[0, 0], [N - 7, 0], [0, N - 7]].some(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7);
  const cells = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!inFinder(x, y) && rnd() > 0.52) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />);
  const finder = (fx, fy) => (
    <g key={`${fx}${fy}`}>
      <rect x={fx} y={fy} width="7" height="7" />
      <rect x={fx + 1} y={fy + 1} width="5" height="5" fill="var(--paper)" />
      <rect x={fx + 2} y={fy + 2} width="3" height="3" />
    </g>
  );
  return (
    <svg viewBox={`0 0 ${N} ${N}`} fill="#2a2118" role="img" aria-label="Decorative ticket pattern" shapeRendering="crispEdges">
      {cells}
      {finder(0, 0)}{finder(N - 7, 0)}{finder(0, N - 7)}
    </svg>
  );
}

export default function Ticket({ booking }) {
  const { movie, theatre, show } = booking;
  const seats = booking.seats.map((s) => s.label).sort();
  return (
    <article className={`ticket ${booking.status === 'cancelled' ? 'cancelled' : ''}`} aria-label={`Ticket ${booking.code}`}>
      <div className="ticket-main">
        <div className="ticket-kicker">{booking.status === 'cancelled' ? 'Cancelled' : `${show.format}, ${show.language}`}</div>
        <h2>{movie.title}</h2>
        <dl className="ticket-grid">
          <div><dt>Date</dt><dd>{fmtLong(show.startTime)}</dd></div>
          <div><dt>Time</dt><dd>{fmtTime(show.startTime)}</dd></div>
          <div><dt>Theatre</dt><dd>{theatre.name}, {theatre.city}</dd></div>
          <div><dt>Screen</dt><dd>{show.screenName}</dd></div>
          <div><dt>Seats</dt><dd>{seats.join(', ')}</dd></div>
          <div><dt>Amount paid</dt><dd>{rupee(booking.total)}</dd></div>
        </dl>
      </div>
      <div className="ticket-stub">
        <Pattern code={booking.code} />
        <div className="ticket-code">{booking.code}</div>
        <small>{seats.length} {seats.length === 1 ? 'seat' : 'seats'}</small>
      </div>
    </article>
  );
}
