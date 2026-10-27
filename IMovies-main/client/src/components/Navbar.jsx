import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../features/authSlice';
import { useCity } from '../context/CityContext';
import api from '../api';

const Logo = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <rect width="64" height="64" rx="14" fill="#c0264a" />
    <rect x="14" y="16" width="36" height="32" rx="4" fill="none" stroke="#f3e9d7" strokeWidth="4" />
    <path d="M28 25l12 7-12 7z" fill="#e6b457" />
  </svg>
);

export default function Navbar() {
  const user = useSelector((s) => s.auth.user);
  const dispatch = useDispatch();
  const nav = useNavigate();
  const loc = useLocation();
  const { city, setCity, cities } = useCity();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [bell, setBell] = useState(false);
  const [q, setQ] = useState('');
  const [notes, setNotes] = useState({ items: [], unread: 0 });
  const wrap = useRef(null);

  // Close everything on navigation
  useEffect(() => {
    setOpen(false);
    setMenu(false);
    setBell(false);
  }, [loc.pathname]);

  // Close popovers on outside click
  useEffect(() => {
    const h = (e) => {
      if (wrap.current && !wrap.current.contains(e.target)) {
        setMenu(false);
        setBell(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Notifications: load on sign-in and refresh every minute
  useEffect(() => {
    if (!user) return undefined;
    const load = () => api.get('/notifications').then((r) => setNotes(r.data)).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [user, loc.pathname]);

  const openBell = () => {
    setBell((b) => !b);
    setMenu(false);
    if (notes.unread > 0) {
      api.put('/notifications/read').then(() => setNotes((n) => ({ ...n, unread: 0 }))).catch(() => {});
    }
  };

  const submit = (e) => {
    e.preventDefault();
    nav(`/movies${q.trim() ? `?search=${encodeURIComponent(q.trim())}` : ''}`);
    setQ('');
  };

  return (
    <header className={`site-nav ${open ? 'open' : ''}`}>
      <div className="container">
        <div className="bar">
          <Link to="/" className="brand" aria-label="IMovies home">
            <Logo /> IMovies
          </Link>
          <button className="icon-btn nav-toggle" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu" aria-expanded={open}>
            ☰
          </button>

          <nav className="nav-links" aria-label="Main">
            <NavLink to="/" end>Home</NavLink>
            <NavLink to="/movies">Movies</NavLink>
            <NavLink to="/movies?status=upcoming">Coming soon</NavLink>
            {user?.role === 'admin' && <NavLink to="/admin" className="admin-link">Admin panel</NavLink>}
          </nav>

          <div className="nav-tools" ref={wrap}>
            <form className="nav-search" onSubmit={submit} role="search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
              <input className="form-control" placeholder="Search movies" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search movies" />
            </form>

            <select className="form-select city-select" value={city} onChange={(e) => setCity(e.target.value)} aria-label="Choose your city">
              <option value="">All cities</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            {user ? (
              <>
                <div className="menu-wrap">
                  <button className="icon-btn" onClick={openBell} aria-label={`Notifications, ${notes.unread} unread`}>
                    🔔
                    {notes.unread > 0 && <span className="dot">{notes.unread}</span>}
                  </button>
                  {bell && (
                    <div className="menu-pop notif-pop">
                      {notes.items.length === 0 && <p className="text-muted-2 p-3 mb-0">No notifications yet. Booking updates show up here.</p>}
                      {notes.items.map((n) => (
                        <div key={n._id} className={`notif ${n.read ? '' : 'unread'}`}>
                          <b>{n.title}</b>
                          <span className="text-muted-2">{n.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="menu-wrap">
                  <button className="avatar" onClick={() => { setMenu((m) => !m); setBell(false); }} aria-label="Account menu" aria-expanded={menu}>
                    {user.name?.[0]?.toUpperCase()}
                  </button>
                  {menu && (
                    <div className="menu-pop">
                      <div className="who"><b>{user.name}</b><div className="text-muted-2 small">{user.email}</div></div>
                      <Link to="/bookings">My bookings</Link>
                      {user.role === 'admin' && <Link to="/admin">Admin panel</Link>}
                      <button className="item" onClick={() => { dispatch(logout()); nav('/'); }}>Sign out</button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost">Sign in</Link>
                <Link to="/register" className="btn btn-brand">Create account</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
