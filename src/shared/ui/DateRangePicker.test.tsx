import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { format, subDays } from 'date-fns';
import { DateRangePicker } from './DateRangePicker';

const iso = (date: Date) => format(date, 'yyyy-MM-dd');

describe('DateRangePicker', () => {
  it('shows a placeholder and no clear button without a range', () => {
    render(<DateRangePicker onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Date range.*Any date/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear date range' })).not.toBeInTheDocument();
  });

  it('announces the selected range without shifting the calendar day', () => {
    render(<DateRangePicker from="2024-05-01" to="2024-05-26" onChange={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: /Date range.*May 1 – May 26, 2024/ }),
    ).toBeInTheDocument();
  });

  it('applies a preset as local ISO dates and closes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateRangePicker onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /Date range/ }));
    await user.click(screen.getByRole('button', { name: 'Last 7 days' }));
    const today = new Date();
    expect(onChange).toHaveBeenCalledWith({ from: iso(subDays(today, 6)), to: iso(today) });
    expect(screen.queryByRole('button', { name: 'Last 7 days' })).not.toBeInTheDocument();
  });

  it('selects a range by clicking two days', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <DateRangePicker from="2024-05-01" to="2024-05-02" onChange={onChange} />,
    );
    await user.click(screen.getByRole('button', { name: /Date range/ }));
    await user.click(screen.getByRole('button', { name: /May 10th, 2024/ }));
    expect(onChange).toHaveBeenCalled();
    rerender(<DateRangePicker from="2024-05-10" onChange={onChange} />);
    if (!screen.queryByRole('grid'))
      await user.click(screen.getByRole('button', { name: /Date range/ }));
    await user.click(screen.getByRole('button', { name: /May 15th, 2024/ }));
    expect(onChange).toHaveBeenLastCalledWith({ from: '2024-05-10', to: '2024-05-15' });
  });

  it('does not allow future dates', async () => {
    const user = userEvent.setup();
    render(<DateRangePicker onChange={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /Date range/ }));
    const tomorrow = new Date(Date.now() + 86_400_000);
    if (tomorrow.getMonth() === new Date().getMonth()) {
      expect(
        screen.getByRole('button', { name: new RegExp(format(tomorrow, 'MMMM d')) }),
      ).toBeDisabled();
    }
  });

  it('clears via the × button and the Clear preset', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateRangePicker from="2024-05-01" to="2024-05-26" onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Clear date range' }));
    expect(onChange).toHaveBeenLastCalledWith({});
    await user.click(screen.getByRole('button', { name: /Date range/ }));
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<DateRangePicker onChange={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: /Date range/ });
    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(trigger).toHaveFocus();
  });
});
