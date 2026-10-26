import { render, screen } from '@testing-library/react';
import { LinearProgress } from './LinearProgress';

describe('LinearProgress', () => {
  it('exposes an accessible progressbar while active', () => {
    render(<LinearProgress active label="Loading more articles" />);
    const bar = screen.getByRole('progressbar', { name: 'Loading more articles' });
    expect(bar).toHaveClass('opacity-100');
  });

  it('fades out and hides from assistive tech when inactive', () => {
    render(<LinearProgress active={false} />);
    const bar = screen.getByRole('progressbar', { hidden: true });
    expect(bar).toHaveClass('opacity-0');
    expect(bar).toHaveAttribute('aria-hidden', 'true');
  });
});
