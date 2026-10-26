import type { Article } from '@/domain/news';
import { authorKey, hasAnyAuthor } from '@/services/normalize';

/** Unique author names across articles (already normalised by the adapters), sorted. */
export const collectAuthors = (articles: Article[], limit = 30): string[] => {
  const seen = new Map<string, string>();
  articles.forEach((article) =>
    article.authors.forEach((name) => seen.set(authorKey(name), seen.get(authorKey(name)) ?? name)),
  );
  return [...seen.values()].sort((a, b) => a.localeCompare(b)).slice(0, limit);
};

/** Case-insensitive match of followed authors against the article's normalised authors. */
export const isByAuthor = (article: Article, followed: string[]): boolean =>
  hasAnyAuthor(article.authors, followed);

/** Stable partition: followed authors first, original order preserved otherwise. */
export const prioritiseAuthors = (articles: Article[], followed: string[]): Article[] => {
  if (followed.length === 0) return articles;
  const mine = articles.filter((a) => isByAuthor(a, followed));
  const rest = articles.filter((a) => !isByAuthor(a, followed));
  return [...mine, ...rest];
};
