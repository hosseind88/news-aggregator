import { normalizeFilters } from './filters';

describe('normalizeFilters', () => {
  it('trims, collapses whitespace and lower-cases the keyword', () => {
    expect(normalizeFilters({ keyword: '  Markets   RALLY ' }).keyword).toBe('markets rally');
    expect(normalizeFilters({ keyword: '   ' }).keyword).toBeUndefined();
  });

  it('drops invalid days and swaps a reversed range', () => {
    expect(normalizeFilters({ from: 'garbage', to: '2999-99-99' })).toMatchObject({
      from: undefined,
      to: undefined,
    });
    expect(normalizeFilters({ from: '2024-02-31' }).from).toBeUndefined();
    expect(normalizeFilters({ from: '2024-05-10', to: '2024-05-01' })).toMatchObject({
      from: '2024-05-01',
      to: '2024-05-10',
    });
  });

  it('de-duplicates and orders list filters so equivalent filters share a cache key', () => {
    const unsorted = normalizeFilters({ categories: ['health', 'business', 'business'] });
    const sorted = normalizeFilters({ categories: ['business', 'health'] });
    expect(unsorted).toEqual(sorted);
    expect(unsorted.categories).toEqual(['business', 'health']);
  });

  it('treats an empty list and "every source" as no filter', () => {
    expect(normalizeFilters({ categories: [], sources: [] })).toMatchObject({
      categories: undefined,
      sources: undefined,
    });
    expect(normalizeFilters({ sources: ['nyt', 'guardian', 'newsapi'] }).sources).toBeUndefined();
    expect(normalizeFilters({ sources: ['nyt'] }).sources).toEqual(['nyt']);
  });

  it('trims and de-duplicates authors (case-insensitively) and treats none as no filter', () => {
    expect(normalizeFilters({ authors: [' Jane Doe ', 'jane doe', 'Sam'] }).authors).toEqual([
      'Jane Doe',
      'Sam',
    ]);
    expect(normalizeFilters({ authors: [] }).authors).toBeUndefined();
  });
});
