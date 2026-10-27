import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="container page">
      <div className="empty">
        <h3>This page is not showing</h3>
        <p>The link may be old or mistyped.</p>
        <Link to="/" className="btn btn-brand">Back to home</Link>
      </div>
    </div>
  );
}
