import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Category, SourceId } from '@/domain/news';

export interface PreferencesData {
  sources: SourceId[];
  categories: Category[];
  authors: string[];
}

interface PreferencesActions {
  setSources: (sources: SourceId[]) => void;
  setCategories: (categories: Category[]) => void;
  addAuthor: (author: string) => void;
  removeAuthor: (author: string) => void;
  reset: () => void;
}

export type PreferencesState = PreferencesData & PreferencesActions;

const EMPTY: PreferencesData = { sources: [], categories: [], authors: [] };

export const PREFERENCES_STORAGE_KEY = 'news-aggregator:preferences';

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      ...EMPTY,
      setSources: (sources) => set({ sources }),
      setCategories: (categories) => set({ categories }),
      addAuthor: (author) =>
        set((state) => {
          const name = author.trim();
          const exists = state.authors.some((a) => a.toLowerCase() === name.toLowerCase());
          return name && !exists ? { authors: [...state.authors, name] } : state;
        }),
      removeAuthor: (author) =>
        set((state) => ({ authors: state.authors.filter((a) => a !== author) })),
      reset: () => set(EMPTY),
    }),
    {
      name: PREFERENCES_STORAGE_KEY,
      version: 1,
      // Persist data only, never the action functions.
      partialize: ({ sources, categories, authors }): PreferencesData => ({
        sources,
        categories,
        authors,
      }),
    },
  ),
);
