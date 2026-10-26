const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
};

export const DESCRIPTION_MAX_LENGTH = 240;

/** Placeholders some APIs return for deleted/unavailable content. */
const PLACEHOLDER = /^\[(removed|deleted)\]$/i;

export const decodeEntities = (value: string): string =>
  value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#')) {
      const hex = entity[1]?.toLowerCase() === 'x';
      const code = parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });

/** Removes real tags only (`<p>`, `</a>`), not stray "a < b" comparisons. */
export const stripTags = (value: string): string => value.replace(/<\/?[a-z][^>]*>/gi, ' ');

export const collapseWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

/** Cuts at a word boundary and appends an ellipsis. */
export const truncate = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) return value;
  const cut = value.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${base.replace(/[\s,;:.\-–—]+$/, '')}…`;
};

/**
 * Plain text from API-provided markup: decode entities, strip tags, collapse whitespace.
 * Returns undefined for empty values and "[Removed]" placeholders.
 */
export const cleanText = (
  raw: string | null | undefined,
  { maxLength }: { maxLength?: number } = {},
): string | undefined => {
  if (!raw) return undefined;
  const text = collapseWhitespace(stripTags(decodeEntities(raw)));
  if (!text || PLACEHOLDER.test(text)) return undefined;
  return maxLength ? truncate(text, maxLength) : text;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** NewsAPI titles often end with " - BBC News"; the publisher is shown separately. */
export const stripPublisherSuffix = (title: string, publisher?: string | null): string => {
  if (!publisher) return title;
  const stripped = title.replace(
    new RegExp(`\\s+[-–—|]\\s+${escapeRegExp(publisher)}\\s*$`, 'i'),
    '',
  );
  return stripped || title;
};

/** Identity of a headline for de-duplication: case, punctuation and spacing ignored. */
export const titleKey = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
