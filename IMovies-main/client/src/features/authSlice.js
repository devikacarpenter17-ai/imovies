import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../api';

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem('imovies_user'));
  } catch {
    return null;
  }
};

const persist = (state, { token, user }) => {
  state.token = token;
  state.user = user;
  localStorage.setItem('imovies_token', token);
  localStorage.setItem('imovies_user', JSON.stringify(user));
};

const call = (type, url) =>
  createAsyncThunk(type, async (body, { rejectWithValue }) => {
    try {
      const { data } = await api.post(url, body);
      return data;
    } catch (e) {
      return rejectWithValue(e.friendly || 'Something went wrong.');
    }
  });

export const login = call('auth/login', '/auth/login');
export const register = call('auth/register', '/auth/register');

// Re-validates a stored token on app start so stale sessions are cleared
export const refreshUser = createAsyncThunk('auth/refresh', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/auth/me');
    return data.user;
  } catch (e) {
    return rejectWithValue(e.response?.status);
  }
});

const slice = createSlice({
  name: 'auth',
  initialState: { token: localStorage.getItem('imovies_token'), user: readUser(), loading: false },
  reducers: {
    logout(state) {
      state.token = null;
      state.user = null;
      localStorage.removeItem('imovies_token');
      localStorage.removeItem('imovies_user');
    },
  },
  extraReducers: (b) => {
    [login, register].forEach((thunk) => {
      b.addCase(thunk.pending, (s) => {
        s.loading = true;
      });
      b.addCase(thunk.fulfilled, (s, a) => {
        s.loading = false;
        persist(s, a.payload);
      });
      b.addCase(thunk.rejected, (s) => {
        s.loading = false;
      });
    });
    b.addCase(refreshUser.fulfilled, (s, a) => {
      s.user = a.payload;
      localStorage.setItem('imovies_user', JSON.stringify(a.payload));
    });
    b.addCase(refreshUser.rejected, (s, a) => {
      if (a.payload === 401) {
        s.token = null;
        s.user = null;
        localStorage.removeItem('imovies_token');
        localStorage.removeItem('imovies_user');
      }
    });
  },
});

export const { logout } = slice.actions;
export default slice.reducer;
