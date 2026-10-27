export default function Pager({ page, pages, onChange }) {
  if (pages <= 1) return null;
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === pages || Math.abs(n - page) <= 1
  );
  return (
    <nav className="pager" aria-label="Pagination">
      <button disabled={page === 1} onClick={() => onChange(page - 1)} aria-label="Previous page">‹</button>
      {nums.map((n, i) => (
        <span key={n} className="d-contents">
          {i > 0 && n - nums[i - 1] > 1 && <span className="text-muted-2 px-1 align-self-center">…</span>}
          <button className={n === page ? 'on' : ''} aria-current={n === page ? 'page' : undefined} onClick={() => onChange(n)}>
            {n}
          </button>
        </span>
      ))}
      <button disabled={page === pages} onClick={() => onChange(page + 1)} aria-label="Next page">›</button>
    </nav>
  );
}
