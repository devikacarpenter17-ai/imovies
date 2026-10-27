import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api';

const Ctx = createContext(null);

// Holds the chosen city plus the filter lists (genres, languages, cities) fetched once.
export function CityProvider({ children }) {
  const [city, setCityState] = useState(() => localStorage.getItem('imovies_city') || '');
  const [filters, setFilters] = useState({ genres: [], languages: [], cities: [] });

  useEffect(() => {
    api.get('/movies/filters').then((r) => setFilters(r.data)).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({
      city,
      setCity: (c) => {
        setCityState(c);
        try {
          localStorage.setItem('imovies_city', c);
        } catch {
          /* storage unavailable: choice just won't persist */
        }
      },
      ...filters,
    }),
    [city, filters]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useCity = () => useContext(Ctx);
