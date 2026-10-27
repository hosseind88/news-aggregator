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
    const scrollProps = props();
    render(<Harness {...scrollProps} />);

    expect(observers).toHaveLength(1);
    expect(firstObserver().options.rootMargin).toBe('400px');
    act(() => firstObserver().trigger());
    expect(scrollProps.onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('ignores non-intersecting entries', () => {
    const scrollProps = props();
    render(<Harness {...scrollProps} />);
    act(() => firstObserver().trigger(false));
    expect(scrollProps.onLoadMore).not.toHaveBeenCalled();
  });

  it('does not observe while fetching, and re-observes afterwards', () => {
    const scrollProps = props({ isFetching: true });
    const { rerender } = render(<Harness {...scrollProps} />);
    expect(observers).toHaveLength(0);

    rerender(<Harness {...scrollProps} isFetching={false} />);
    expect(observers).toHaveLength(1);
  });

  it('re-observes when new data lands even if isFetching never visibly toggled', () => {
    const scrollProps = props({ revision: 1 });
    const { rerender } = render(<Harness {...scrollProps} />);
    expect(observers).toHaveLength(1);

    rerender(<Harness {...scrollProps} revision={2} />);
    expect(firstObserver().disconnect).toHaveBeenCalled();
    expect(observers).toHaveLength(2);
  });

  it('disconnects when there are no more pages', () => {
    const scrollProps = props();
    const { rerender } = render(<Harness {...scrollProps} />);
    rerender(<Harness {...scrollProps} hasNextPage={false} />);
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
