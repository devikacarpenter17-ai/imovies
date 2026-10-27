import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { login, register } from '../features/authSlice';

function AuthShell({ title, lead, children }) {
  return (
    <div className="auth">
      <div className="auth-art">
        <h1>{title}</h1>
        <p>{lead}</p>
      </div>
      <div className="auth-form">{children}</div>
    </div>
  );
}

function useAfterAuth() {
  const loc = useLocation();
  const user = useSelector((s) => s.auth.user);
  const to = loc.state?.from || '/';
  return { user, to };
}

export function Login() {
  const dispatch = useDispatch();
  const nav = useNavigate();
  const loading = useSelector((s) => s.auth.loading);
  const { user, to } = useAfterAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  if (user) return <Navigate to={to} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const res = await dispatch(login(form));
    if (login.fulfilled.match(res)) {
      toast.success(`Welcome back, ${res.payload.user.name.split(' ')[0]}`);
      // Admins land on the admin panel unless they were sent here from another page
      nav(res.payload.user.role === 'admin' && to === '/' ? '/admin' : to, { replace: true });
    } else {
      setError(res.payload);
    }
  };

  return (
    <AuthShell title="Your seat is waiting." lead="Sign in to hold seats, pay and keep every ticket in one place.">
      <form onSubmit={submit} noValidate>
        <h2 className="h3 mb-4">Sign in</h2>
        <div className="mb-3">
          <label className="form-label" htmlFor="email">Email</label>
          <input id="email" type="email" className="form-control" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="pw">Password</label>
          <input id="pw" type="password" className="form-control" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        </div>
        {error && <div className="alert-err mb-3" role="alert">{error}</div>}
        <button className="btn btn-brand w-100 btn-lg" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
        <button type="button" className="btn btn-ghost w-100 mt-2" onClick={() => setForm({ email: 'user@imovies.com', password: 'User@123' })}>
          Fill demo account
        </button>
        <p className="text-muted-2 mt-4 mb-0">New here? <Link to="/register" state={{ from: to }}>Create an account</Link></p>
      </form>
    </AuthShell>
  );
}

export function Register() {
  const dispatch = useDispatch();
  const nav = useNavigate();
  const loading = useSelector((s) => s.auth.loading);
  const { user, to } = useAfterAuth();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');

  if (user) return <Navigate to={to} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.name.trim().length < 2) return setError('Enter your full name.');
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setError('Enter a valid email address.');
    if (form.password.length < 6) return setError('Password must be at least 6 characters.');
    const res = await dispatch(register(form));
    if (register.fulfilled.match(res)) {
      toast.success('Account created. Welcome to IMovies.');
      nav(to, { replace: true });
    } else {
      setError(res.payload);
    }
    return undefined;
  };

  const f = (k) => ({ value: form[k], onChange: (e) => setForm({ ...form, [k]: e.target.value }) });
  return (
    <AuthShell title="Skip the queue. Pick your row." lead="Create a free account to book seats and manage your tickets.">
      <form onSubmit={submit} noValidate>
        <h2 className="h3 mb-4">Create account</h2>
        <div className="mb-3"><label className="form-label" htmlFor="name">Full name</label><input id="name" className="form-control" autoComplete="name" {...f('name')} /></div>
        <div className="mb-3"><label className="form-label" htmlFor="remail">Email</label><input id="remail" type="email" className="form-control" autoComplete="email" {...f('email')} /></div>
        <div className="mb-3"><label className="form-label" htmlFor="phone">Phone (optional)</label><input id="phone" type="tel" className="form-control" autoComplete="tel" {...f('phone')} /></div>
        <div className="mb-3"><label className="form-label" htmlFor="rpw">Password</label><input id="rpw" type="password" className="form-control" autoComplete="new-password" {...f('password')} /><div className="hint mt-1">At least 6 characters.</div></div>
        {error && <div className="alert-err mb-3" role="alert">{error}</div>}
        <button className="btn btn-brand w-100 btn-lg" disabled={loading}>{loading ? 'Creating account…' : 'Create account'}</button>
        <p className="text-muted-2 mt-4 mb-0">Already have an account? <Link to="/login" state={{ from: to }}>Sign in</Link></p>
      </form>
    </AuthShell>
  );
}
