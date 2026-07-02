import { create } from 'zustand';

interface SearchState {
  query: string;
  setQuery: (q: string) => void;
  clear: () => void;
}

/** Shared search query for the active page's toolbar filter. */
export const useSearch = create<SearchState>((set) => ({
  query: '',
  setQuery: (query) => set({ query }),
  clear: () => set({ query: '' }),
}));

/** Case-insensitive match of a query against any of the given fields. */
export function matchesQuery(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => f?.toLowerCase().includes(q));
}
