import type { Category } from '@/domain/news';

/**
 * Raw section / desk names from every source, keyed by slug (lower-case alphanumerics only),
 * mapped onto our Category union. Anything not listed (opinion, food, travel, "us-news"
 * sub-pages, …) is deliberately left uncategorised rather than shown as a raw string.
 */
const ALIASES: Record<string, Category> = {
  // world / general news
  world: 'world',
  worldnews: 'world',
  foreign: 'world',
  international: 'world',
  us: 'world',
  usnews: 'world',
  uknews: 'world',
  australianews: 'world',
  national: 'world',
  washington: 'world',
  americas: 'world',
  europe: 'world',
  asia: 'world',
  africa: 'world',
  middleeast: 'world',
  // politics
  politics: 'politics',
  uspolitics: 'politics',
  ukpolitics: 'politics',
  // business
  business: 'business',
  businessday: 'business',
  money: 'business',
  yourmoney: 'business',
  economy: 'business',
  dealbook: 'business',
  markets: 'business',
  // technology
  technology: 'technology',
  tech: 'technology',
  // science
  science: 'science',
  climate: 'science',
  environment: 'science',
  space: 'science',
  // health ("society" is the Guardian's health/social-care section)
  health: 'health',
  well: 'health',
  society: 'health',
  // sports
  sports: 'sports',
  sport: 'sports',
  football: 'sports',
  soccer: 'sports',
  cricket: 'sports',
  rugbyunion: 'sports',
  tennis: 'sports',
  golf: 'sports',
  // entertainment
  entertainment: 'entertainment',
  culture: 'entertainment',
  arts: 'entertainment',
  artanddesign: 'entertainment',
  artsleisure: 'entertainment',
  film: 'entertainment',
  movies: 'entertainment',
  music: 'entertainment',
  tvandradio: 'entertainment',
  television: 'entertainment',
  stage: 'entertainment',
  theater: 'entertainment',
  books: 'entertainment',
  games: 'entertainment',
};

const toSlug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

/** First candidate (e.g. sectionId, then sectionName) that maps to a known Category. */
export const normalizeCategory = (
  ...candidates: (string | null | undefined)[]
): Category | undefined => {
  for (const candidate of candidates) {
    const category = candidate ? ALIASES[toSlug(candidate)] : undefined;
    if (category) return category;
  }
  return undefined;
};
