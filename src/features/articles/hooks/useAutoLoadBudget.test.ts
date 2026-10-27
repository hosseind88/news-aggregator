import { renderHook } from '@testing-library/react';
import { MAX_FRUITLESS_PAGES, useAutoLoadBudget } from './useAutoLoadBudget';

type Props = { resetKey: string; count: number; minGain: number; pages: number };
const start: Props = { resetKey: 'a', count: 0, minGain: 3, pages: 1 };

const setup = (initial: Props = start) =>
  renderHook((props: Props) => useAutoLoadBudget(props), { initialProps: initial });

describe('useAutoLoadBudget', () => {
  it('is not exhausted by the first page, even if it shows nothing', () => {
    const { result } = setup();
    expect(result.current.isBudgetExhausted).toBe(false);
  });

  it(`gives up after ${MAX_FRUITLESS_PAGES} pages that add less than a row`, () => {
    const { result, rerender } = setup();
    rerender({ ...start, pages: 2 });
    expect(result.current.isBudgetExhausted).toBe(false);
    rerender({ ...start, pages: 3, count: 1 });
    expect(result.current.isBudgetExhausted).toBe(true);
  });

  it('a fruitful page starts the budget over', () => {
    const { result, rerender } = setup();
    rerender({ ...start, pages: 2 });
    rerender({ ...start, pages: 3, count: 6 });
    rerender({ ...start, pages: 4, count: 6 });
    expect(result.current.isBudgetExhausted).toBe(false);
  });

  it('does not count re-renders or refetches that land no new page', () => {
    const { result, rerender } = setup();
    for (let i = 0; i < 5; i += 1) rerender({ ...start });
    expect(result.current.isBudgetExhausted).toBe(false);
  });

  it('starts over when the search changes', () => {
    const { result, rerender } = setup();
    rerender({ ...start, pages: 2 });
    rerender({ ...start, pages: 3 });
    expect(result.current.isBudgetExhausted).toBe(true);
    rerender({ ...start, resetKey: 'b', pages: 1 });
    expect(result.current.isBudgetExhausted).toBe(false);
  });
});
