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
    addAuthor('  By JANE DOE ');
    addAuthor('jane doe');
    addAuthor('   ');
    addAuthor('https://example.com/jane');

    expect(usePreferencesStore.getState().authors).toEqual(['Jane Doe']);
  });

  it('removes an author', () => {
    usePreferencesStore.getState().addAuthor('Ann Author');
    usePreferencesStore.getState().addAuthor('Bob Roe');
    usePreferencesStore.getState().removeAuthor('Ann Author');

    expect(usePreferencesStore.getState().authors).toEqual(['Bob Roe']);
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
        state: { sources: ['guardian'], categories: ['health'], authors: ['Jane Doe'] },
        version: 1,
      }),
    );

    await usePreferencesStore.persist.rehydrate();

    const state = usePreferencesStore.getState();
    expect(state.sources).toEqual(['guardian']);
    expect(state.categories).toEqual(['health']);
    expect(state.authors).toEqual(['Jane Doe']);
    expect(typeof state.setSources).toBe('function');
  });

  it('ignores corrupt or hand-edited storage instead of crashing', async () => {
    localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        state: {
          sources: ['nyt', 'bogus', 7],
          categories: 'oops',
          authors: ['Jane Doe', 'jane  doe', 42, '', null],
        },
        version: 1,
      }),
    );

    await usePreferencesStore.persist.rehydrate();

    const state = usePreferencesStore.getState();
    expect(state.sources).toEqual(['nyt']);
    expect(state.categories).toEqual([]);
    expect(state.authors).toEqual(['Jane Doe']);
  });

  it('falls back to empty preferences when the stored state is not an object', async () => {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify({ state: 'nope', version: 1 }));
    await usePreferencesStore.persist.rehydrate();
    expect(usePreferencesStore.getState()).toMatchObject({
      sources: [],
      categories: [],
      authors: [],
    });
  });
});
