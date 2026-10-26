import { PREFERENCES_STORAGE_KEY, usePreferencesStore } from './preferencesStore';

const initial = usePreferencesStore.getState();

beforeEach(() => {
  usePreferencesStore.setState(initial, true);
  usePreferencesStore.getState().reset();
});

describe('preferencesStore', () => {
  it('starts empty', () => {
    const { sources, categories, authors } = usePreferencesStore.getState();
    expect({ sources, categories, authors }).toEqual({ sources: [], categories: [], authors: [] });
  });

  it('sets sources and categories', () => {
    usePreferencesStore.getState().setSources(['guardian', 'nyt']);
    usePreferencesStore.getState().setCategories(['science']);

    expect(usePreferencesStore.getState().sources).toEqual(['guardian', 'nyt']);
    expect(usePreferencesStore.getState().categories).toEqual(['science']);
  });

  it('adds trimmed authors, ignoring blanks and case-insensitive duplicates', () => {
    const { addAuthor } = usePreferencesStore.getState();
    addAuthor('  Jane Doe ');
    addAuthor('jane doe');
    addAuthor('   ');

    expect(usePreferencesStore.getState().authors).toEqual(['Jane Doe']);
  });

  it('removes an author', () => {
    usePreferencesStore.getState().addAuthor('A');
    usePreferencesStore.getState().addAuthor('B');
    usePreferencesStore.getState().removeAuthor('A');

    expect(usePreferencesStore.getState().authors).toEqual(['B']);
  });

  it('persists data (without actions) to localStorage', () => {
    usePreferencesStore.getState().setSources(['nyt']);

    const stored = JSON.parse(localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? '{}');
    expect(stored.state).toEqual({ sources: ['nyt'], categories: [], authors: [] });
  });

  it('rehydrates from localStorage', async () => {
    localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        state: { sources: ['guardian'], categories: ['health'], authors: ['X'] },
        version: 1,
      }),
    );

    await usePreferencesStore.persist.rehydrate();

    const state = usePreferencesStore.getState();
    expect(state.sources).toEqual(['guardian']);
    expect(state.categories).toEqual(['health']);
    expect(state.authors).toEqual(['X']);
    expect(typeof state.setSources).toBe('function');
  });
});
