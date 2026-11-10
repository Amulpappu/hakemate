// States, union territories and their districts (from the AISHE list), plus the college search call.
import PLACES from './india-places.json';

export const STATES = Object.keys(PLACES);
export const districtsOf = (state) => PLACES[state] || [];

// Popular cities that are not district names, so they show up when typed
const EXTRA_CITIES = {
  'Tamil Nadu': ['Pollachi', 'Hosur', 'Mettupalayam', 'Udumalpet', 'Gobichettipalayam', 'Kumbakonam', 'Rajapalayam', 'Sivakasi', 'Ooty', 'Kodaikanal'],
  Karnataka: ['Bengaluru', 'Manipal'],
  Kerala: ['Kochi'],
  Telangana: ['Secunderabad'],
};
export const citiesOf = (state) => [...new Set([...districtsOf(state), ...(EXTRA_CITIES[state] || [])])].sort();

export async function findColleges(q, { state, city } = {}) {
  const p = new URLSearchParams({ q });
  if (state) p.set('state', state);
  if (city) p.set('city', city);
  const res = await fetch(`/api/colleges?${p}`);
  if (!res.ok) throw new Error('College search is unavailable');
  const { results } = await res.json();
  return results.map((r) => ({ value: r.name, meta: [r.district, r.state].filter(Boolean).join(', '), state: r.state, district: r.district }));
}
