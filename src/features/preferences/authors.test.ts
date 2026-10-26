import { makeArticle } from '@/test/factories';
import { collectAuthors, isByAuthor, prioritiseAuthors, splitAuthors } from './authors';

describe('authors helpers', () => {
  it('splits multi-author bylines and drops URLs', () => {
    expect(splitAuthors('Ann Author and Bob Coauthor, Cy Third')).toEqual([
      'Ann Author',
      'Bob Coauthor',
      'Cy Third',
    ]);
    expect(splitAuthors('https://example.com/someone')).toEqual([]);
  });

  it('collects unique sorted authors', () => {
    const articles = [
      makeArticle({ author: 'Zed' }),
      makeArticle({ author: 'Amy and zed' }),
      makeArticle({ author: undefined }),
    ];
    expect(collectAuthors(articles)).toEqual(['Amy', 'zed']);
  });

  it('matches followed authors case-insensitively inside a byline', () => {
    expect(isByAuthor(makeArticle({ author: 'Ann Author and Bob' }), ['bob'])).toBe(true);
    expect(isByAuthor(makeArticle({ author: undefined }), ['bob'])).toBe(false);
  });

  it('moves followed authors first and keeps the rest in order', () => {
    const a = makeArticle({ id: 'a', author: 'X' });
    const b = makeArticle({ id: 'b', author: 'Y' });
    const c = makeArticle({ id: 'c', author: 'Z' });
    expect(prioritiseAuthors([a, b, c], ['Z']).map((x) => x.id)).toEqual(['c', 'a', 'b']);
    expect(prioritiseAuthors([a, b, c], [])).toEqual([a, b, c]);
  });
});
