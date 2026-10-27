import { Link } from 'react-router-dom';
import Poster from './Poster';

export default function MovieCard({ movie }) {
  return (
    <Link to={`/movies/${movie._id}`} className="mcard" aria-label={`${movie.title}, ${movie.language}`}>
      <Poster movie={movie} />
      <div className="mcard-title">{movie.title}</div>
      <div className="mcard-meta">
        <span>{movie.language}</span>
        {movie.status === 'upcoming' ? <span>Coming soon</span> : movie.score > 0 ? <span className="score">★ {movie.score.toFixed(1)}</span> : <span>New</span>}
      </div>
    </Link>
  );
}

export function MovieGridSkeleton({ count = 8 }) {
  return (
    <div className="movie-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <div className="skeleton sk-poster" />
          <div className="skeleton mt-2" style={{ height: 16, width: '80%' }} />
        </div>
      ))}
    </div>
  );
}
