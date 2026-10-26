import { act, render } from '@testing-library/react';
import { useInfiniteScroll } from './useInfiniteScroll';

let observers: MockObserver[] = [];

class MockObserver {
  disconnect = vi.fn();
  observe = vi.fn();
  constructor(
    private callback: (entries: Partial<IntersectionObserverEntry>[]) => void,
    public options: IntersectionObserverInit,
  ) {
    observers.push(this);
  }
  trigger(isIntersecting = true) {
    this.callback([{ isIntersecting }]);
  }
}

function Harness(props: Parameters<typeof useInfiniteScroll>[0]) {
  const ref = useInfiniteScroll(props);
  return <div ref={ref} data-testid="sentinel" />;
}

const props = (over: Partial<Parameters<typeof useInfiniteScroll>[0]> = {}) => ({
  onLoadMore: vi.fn(),
  hasNextPage: true,
  isFetching: false,
  ...over,
});

const firstObserver = () => {
  const [observer] = observers;
  if (!observer) throw new Error('no observer created');
  return observer;
};

beforeEach(() => {
  observers = [];
  vi.stubGlobal('IntersectionObserver', MockObserver);
});
afterEach(() => vi.unstubAllGlobals());

describe('useInfiniteScroll', () => {
  it('observes the sentinel with a 400px margin and loads when it intersects', () => {
    const p = props();
    render(<Harness {...p} />);

    expect(observers).toHaveLength(1);
    expect(firstObserver().options.rootMargin).toBe('400px');
    act(() => firstObserver().trigger());
    expect(p.onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('ignores non-intersecting entries', () => {
    const p = props();
    render(<Harness {...p} />);
    act(() => firstObserver().trigger(false));
    expect(p.onLoadMore).not.toHaveBeenCalled();
  });

  it('does not observe while fetching, and re-observes afterwards', () => {
    const p = props({ isFetching: true });
    const { rerender } = render(<Harness {...p} />);
    expect(observers).toHaveLength(0);

    rerender(<Harness {...p} isFetching={false} />);
    expect(observers).toHaveLength(1);
  });

  it('disconnects when there are no more pages', () => {
    const p = props();
    const { rerender } = render(<Harness {...p} />);
    rerender(<Harness {...p} hasNextPage={false} />);
    expect(firstObserver().disconnect).toHaveBeenCalled();
    expect(observers).toHaveLength(1);
  });

  it('does not observe while disabled', () => {
    render(<Harness {...props({ disabled: true })} />);
    expect(observers).toHaveLength(0);
  });

  it('disconnects on unmount', () => {
    const { unmount } = render(<Harness {...props()} />);
    unmount();
    expect(firstObserver().disconnect).toHaveBeenCalled();
  });
});
