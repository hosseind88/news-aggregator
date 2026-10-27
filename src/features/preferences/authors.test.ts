import { makeArticle } from '@/test/factories';
import { collectAuthors, isByAuthor, prioritiseAuthors } from './authors';

describe('authors helpers', () => {
  it('collects unique sorted authors case-insensitively', () => {
    const articles = [
      makeArticle({ authors: ['Zed Zee'] }),
      makeArticle({ authors: ['Amy Ames', 'zed zee'] }),
      makeArticle({ authors: [] }),
    ];
    expect(collectAuthors(articles)).toEqual(['Amy Ames', 'Zed Zee']);
  });

  it('matches followed authors exactly but case-insensitively', () => {
    const article = makeArticle({ authors: ['Ann Author', 'Bob Roe'] });
    expect(isByAuthor(article, ['bob roe'])).toBe(true);
    expect(isByAuthor(article, ['Bob'])).toBe(false);
    expect(isByAuthor(makeArticle({ authors: [] }), ['bob roe'])).toBe(false);
  });

  it('moves followed authors first and keeps the rest in order', () => {
    const first = makeArticle({ id: 'a', authors: ['X Xu'] });
    const second = makeArticle({ id: 'b', authors: ['Y Yu'] });
    const third = makeArticle({ id: 'c', authors: ['Z Zu'] });
    expect(
      prioritiseAuthors([first, second, third], ['Z Zu']).map((article) => article.id),
    ).toEqual(['c', 'a', 'b']);
    expect(prioritiseAuthors([first, second, third], [])).toEqual([first, second, third]);
  });
});
