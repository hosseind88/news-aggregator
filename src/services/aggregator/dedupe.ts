import type { Article } from '@/domain/news';

const normaliseUrl = (url: string): string => {
  try {
    const { hostname, pathname } = new URL(url);
    return `${hostname.replace(/^www\./, '')}${pathname.replace(/\/+$/, '')}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
};

const normaliseTitle = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** Keeps the first occurrence of each story, matched by canonical URL or normalised title. */
export const dedupeArticles = (articles: Article[]): Article[] => {
  const urls = new Set<string>();
  const titles = new Set<string>();
  return articles.filter((article) => {
    const url = normaliseUrl(article.url);
    const title = normaliseTitle(article.title);
    if (urls.has(url) || titles.has(title)) return false;
    urls.add(url);
    titles.add(title);
    return true;
  });
};

export const sortByNewest = (articles: Article[]): Article[] =>
  [...articles].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
