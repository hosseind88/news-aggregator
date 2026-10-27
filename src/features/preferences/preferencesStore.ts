import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CATEGORIES, SOURCE_IDS, type Category, type SourceId } from '@/domain/news';
import { authorKey, normalizeAuthorName } from '@/services/normalize';

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

const pick = <T extends string>(raw: unknown, allowed: readonly T[]): T[] =>
  Array.isArray(raw) ? allowed.filter((value) => raw.includes(value)) : [];

const pickAuthors = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.flatMap((entry) => {
    const name = typeof entry === 'string' ? normalizeAuthorName(entry) : undefined;
    if (!name || seen.has(authorKey(name))) return [];
    seen.add(authorKey(name));
    return [name];
  });
};

/**
 * localStorage is user-editable and survives app upgrades, so anything read back is untrusted:
 * keep only known sources/categories and well-formed, de-duplicated author names.
 */
const sanitizePreferences = (raw: unknown): PreferencesData => {
  const data = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    sources: pick<SourceId>(data.sources, SOURCE_IDS),
    categories: pick<Category>(data.categories, CATEGORIES),
    authors: pickAuthors(data.authors),
  };
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      ...EMPTY,
      setSources: (sources) => set({ sources }),
      setCategories: (categories) => set({ categories }),
      addAuthor: (author) =>
        set((state) => {
          const name = normalizeAuthorName(author);
          const exists = state.authors.some((a) => authorKey(a) === authorKey(name ?? ''));
          return name && !exists ? { authors: [...state.authors, name] } : state;
        }),
      removeAuthor: (author) =>
        set((state) => ({ authors: state.authors.filter((a) => a !== author) })),
      reset: () => set(EMPTY),
    }),
    {
      name: PREFERENCES_STORAGE_KEY,
      version: 1,
      merge: (persisted, current) => ({ ...current, ...sanitizePreferences(persisted) }),
      // Persist data only, never the action functions.
      partialize: ({ sources, categories, authors }): PreferencesData => ({
        sources,
        categories,
        authors,
      }),
    },
  ),
);
