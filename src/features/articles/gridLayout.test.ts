import { GRID_CLASS, trimToFullRows } from './gridLayout';

const items = (count: number) => Array.from({ length: count }, (_, i) => i);

describe('trimToFullRows', () => {
  it('keeps exact multiples untouched', () => {
    expect(trimToFullRows(items(9), 3, true)).toHaveLength(9);
  });

  it('drops the trailing partial row while more pages exist', () => {
    expect(trimToFullRows(items(11), 3, true)).toEqual(items(9));
    expect(trimToFullRows(items(7), 2, true)).toEqual(items(6));
  });

  it('renders everything on the last page', () => {
    expect(trimToFullRows(items(11), 3, false)).toHaveLength(11);
  });

  it('never hides the only partial row', () => {
    expect(trimToFullRows(items(2), 3, true)).toEqual(items(2));
  });

  it('handles an empty list', () => {
    expect(trimToFullRows([], 3, true)).toEqual([]);
  });

  it('keeps everything with one column', () => {
    expect(trimToFullRows(items(5), 1, true)).toHaveLength(5);
  });
});

describe('GRID_CLASS', () => {
  it('lists every responsive column class', () => {
    expect(GRID_CLASS).toContain('sm:grid-cols-2');
    expect(GRID_CLASS).toContain('lg:grid-cols-3');
  });
});
