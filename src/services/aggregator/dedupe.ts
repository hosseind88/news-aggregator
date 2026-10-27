import type { Article } from '@/domain/news';
import { canonicalUrl, titleKey } from '@/services/normalize';

/** Keeps the first occurrence of each story, matched by canonical URL or normalised title. */
export const dedupeArticles = (articles: Article[]): Article[] => {
  const urls = new Set<string>();
  const titles = new Set<string>();
  return articles.filter((article) => {
    const url = canonicalUrl(article.url);
    const title = titleKey(article.title);
    if (urls.has(url) || titles.has(title)) return false;
    urls.add(url);
    titles.add(title);
    return true;
  });
};

/** Newest first; equal timestamps fall back to id so the order is fully deterministic. */
export const compareNewest = (a: Article, b: Article): number =>
  Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || a.id.localeCompare(b.id);
