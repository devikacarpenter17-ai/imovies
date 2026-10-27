import { dayKey, nextDays } from '../utils/format';

export default function DateStrip({ value, onChange, allowAny = false }) {
  return (
    <div className="date-strip" role="group" aria-label="Pick a date">
      {allowAny && (
        <button className={`day ${value === '' ? 'on' : ''}`} onClick={() => onChange('')}>
          <b>Any</b>
          <small>date</small>
        </button>
      )}
      {nextDays(7).map((d, i) => {
        const k = dayKey(d);
        return (
          <button key={k} className={`day ${value === k ? 'on' : ''}`} onClick={() => onChange(k)} aria-pressed={value === k}>
            <small>{i === 0 ? 'Today' : d.toLocaleDateString('en-IN', { weekday: 'short' })}</small>
            <b>{d.getDate()}</b>
            <small>{d.toLocaleDateString('en-IN', { month: 'short' })}</small>
          </button>
        );
      })}
    </div>
  );
}
