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

const EMPTY_PREFERENCES: PreferencesData = { sources: [], categories: [], authors: [] };

export const PREFERENCES_STORAGE_KEY = 'news-aggregator:preferences';

const pickAllowed = <T extends string>(raw: unknown, allowed: readonly T[]): T[] =>
  Array.isArray(raw) ? allowed.filter((value) => raw.includes(value)) : [];

const pickAllowedAuthors = (raw: unknown): string[] => {
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
  const storedPreferences =
    typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    sources: pickAllowed<SourceId>(storedPreferences.sources, SOURCE_IDS),
    categories: pickAllowed<Category>(storedPreferences.categories, CATEGORIES),
    authors: pickAllowedAuthors(storedPreferences.authors),
  };
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      ...EMPTY_PREFERENCES,
      setSources: (sources) => set({ sources }),
      setCategories: (categories) => set({ categories }),
      addAuthor: (author) =>
        set((state) => {
          const name = normalizeAuthorName(author);
          const isAlreadyFollowed = state.authors.some(
            (followedAuthor) => authorKey(followedAuthor) === authorKey(name ?? ''),
          );
          return name && !isAlreadyFollowed ? { authors: [...state.authors, name] } : state;
        }),
      removeAuthor: (author) =>
        set((state) => ({
          authors: state.authors.filter((followedAuthor) => followedAuthor !== author),
        })),
      reset: () => set(EMPTY_PREFERENCES),
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
