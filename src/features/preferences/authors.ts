import type { Article } from '@/domain/news';

const normalise = (name: string) => name.trim().toLowerCase();

/** Bylines may list several people ("A and B", "A, B"); NewsAPI sometimes returns URLs. */
export const splitAuthors = (byline?: string): string[] =>
  (byline?.includes('http') ? '' : (byline ?? ''))
    .split(/,|&|\band\b|\//i)
    .map((name) => name.trim())
    .filter((name) => name.length > 1 && name.length < 50);

export const collectAuthors = (articles: Article[], limit = 30): string[] => {
  const seen = new Map<string, string>();
  articles.forEach((article) =>
    splitAuthors(article.author).forEach((name) => seen.set(normalise(name), name)),
  );
  return [...seen.values()].sort((a, b) => a.localeCompare(b)).slice(0, limit);
};

export const isByAuthor = (article: Article, authors: string[]): boolean => {
  const byline = normalise(article.author ?? '');
  return !!byline && authors.some((author) => byline.includes(normalise(author)));
};

/** Stable partition: followed authors first, original order preserved otherwise. */
export const prioritiseAuthors = (articles: Article[], authors: string[]): Article[] => {
  if (authors.length === 0) return articles;
  const followed = articles.filter((a) => isByAuthor(a, authors));
  const rest = articles.filter((a) => !isByAuthor(a, authors));
  return [...followed, ...rest];
};
