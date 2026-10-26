import { act, renderHook } from '@testing-library/react';
import { useGridColumns } from './useGridColumns';

type Listener = () => void;

function mockViewport(initialWidth: number) {
  let width = initialWidth;
  const listeners = new Set<Listener>();
  const matchMedia = vi.fn((query: string) => ({
    get matches() {
      return width >= Number(/min-width: (\d+)px/.exec(query)?.[1]);
    },
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
  }));
  vi.stubGlobal('matchMedia', matchMedia);
  return {
    listeners,
    resize(next: number) {
      width = next;
      listeners.forEach((l) => l());
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('useGridColumns', () => {
  it.each([
    [500, 1],
    [700, 2],
    [1200, 3],
  ])('returns the column count for a %ipx viewport', (width, columns) => {
    mockViewport(width);
    expect(renderHook(() => useGridColumns()).result.current).toBe(columns);
  });

  it('updates when the viewport crosses a breakpoint', () => {
    const viewport = mockViewport(500);
    const { result } = renderHook(() => useGridColumns());

    act(() => viewport.resize(800));
    expect(result.current).toBe(2);
    act(() => viewport.resize(1100));
    expect(result.current).toBe(3);
    act(() => viewport.resize(400));
    expect(result.current).toBe(1);
  });

  it('removes its listeners on unmount', () => {
    const viewport = mockViewport(500);
    const { unmount } = renderHook(() => useGridColumns());
    expect(viewport.listeners.size).toBeGreaterThan(0);
    unmount();
    expect(viewport.listeners.size).toBe(0);
  });

  it('falls back to one column without matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(renderHook(() => useGridColumns()).result.current).toBe(1);
  });
});
