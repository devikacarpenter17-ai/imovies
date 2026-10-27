import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container d-flex flex-wrap justify-content-between gap-3">
        <span style={{ maxWidth: '62ch' }}>
          Movie details and posters come from public movie catalogues (TMDB and Apple iTunes). This product uses the TMDB API but is
          not endorsed or certified by TMDB. Showtimes, theatres and payments are simulated.
        </span>
        <span className="d-flex gap-3">
          <Link to="/movies">Browse movies</Link>
          <Link to="/bookings">My bookings</Link>
        </span>
      </div>
    </footer>
  );
}
