import { fireEvent, render, screen } from '@testing-library/react';
import { ArticleImage } from './ArticleImage';

const URL_OK = 'https://img.example.com/a.jpg';

const sized = (img: HTMLElement, w: number, h: number) => {
  Object.defineProperty(img, 'complete', { value: true, configurable: true });
  Object.defineProperty(img, 'naturalWidth', { value: w, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: h, configurable: true });
};

describe('ArticleImage', () => {
  it('renders a lazy, no-referrer image with the title as alt and a skeleton until loaded', () => {
    render(<ArticleImage src={URL_OK} alt="Headline" source="guardian" />);
    const img = screen.getByRole('img', { name: 'Headline' });
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
    expect(img).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(screen.getByTestId('image-skeleton')).toBeInTheDocument();

    sized(img, 800, 450);
    fireEvent.load(img);
    expect(screen.queryByTestId('image-skeleton')).not.toBeInTheDocument();
    expect(img).toHaveClass('opacity-100');
  });

  it('shows the placeholder on error and does not retry', () => {
    const { container } = render(
      <ArticleImage src={URL_OK} alt="Headline" source="nyt" label="Science" />,
    );
    fireEvent.error(screen.getByRole('img', { name: 'Headline' }));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('Science').closest('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('treats 1x1 tracking pixels and zero-width loads as failures', () => {
    for (const [w, h] of [
      [1, 1],
      [0, 0],
    ] as const) {
      const { container, unmount } = render(<ArticleImage src={URL_OK} alt="x" source="nyt" />);
      const img = container.querySelector('img') as HTMLImageElement;
      sized(img, w, h);
      fireEvent.load(img);
      expect(container.querySelector('img')).toBeNull();
      unmount();
    }
  });

  it.each([undefined, '', 'not a url', 'javascript:alert(1)'])(
    'shows the placeholder immediately for %p',
    (src) => {
      const { container } = render(<ArticleImage src={src} alt="Headline" source="nyt" />);
      expect(container.querySelector('img')).toBeNull();
      expect(container.querySelector('[data-source="nyt"]')).toHaveAttribute('aria-hidden', 'true');
    },
  );

  it('tints the placeholder per source', () => {
    const classes = (['guardian', 'nyt', 'newsapi'] as const).map((source) => {
      const { container, unmount } = render(<ArticleImage alt="x" source={source} />);
      const cls = container.querySelector(`[data-source="${source}"]`)?.className;
      unmount();
      return cls;
    });
    expect(new Set(classes).size).toBe(3);
    expect(classes[0]).toContain('blue');
  });
});
