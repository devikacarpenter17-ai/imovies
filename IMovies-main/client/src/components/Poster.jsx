import { useEffect, useState } from 'react';

// Shows the real poster when there is one. If the image cannot load, it falls back to
// generated art built from the movie's theme colours, so a card is never empty.
export default function Poster({ movie, size = 'md', className = '' }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [movie.posterUrl]);
  const t = movie.theme || {};
  const style = { '--p-from': t.from, '--p-to': t.to, '--p-accent': t.accent };
  const showImage = movie.posterUrl && !broken;
  return (
    <div
      className={`poster ${size === 'xs' ? 'poster-xs' : ''} ${className}`}
      style={style}
      role="img"
      aria-label={`Poster for ${movie.title}`}
    >
      {showImage ? (
        <img src={movie.posterUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      ) : (
        <>
          {movie.certificate && <span className="poster-cert">{movie.certificate}</span>}
          <span className="poster-title">{movie.title}</span>
          {movie.genres?.[0] && <span className="poster-tag">{movie.genres[0]}</span>}
        </>
      )}
    </div>
  );
}
