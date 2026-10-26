import { cleanText } from './text';

/** Organisations and placeholders that APIs put in the byline instead of a person. */
const NOT_A_PERSON = new Set([
  'ap',
  'afp',
  'pa',
  'pa media',
  'reuters',
  'bloomberg',
  'associated press',
  'the associated press',
  'press association',
  'the new york times',
  'new york times',
  'nyt',
  'the guardian',
  'guardian',
  'bbc',
  'bbc news',
  'cnn',
  'unknown',
  'admin',
  'anonymous',
  'n/a',
  'none',
  'null',
]);

const GENERIC_ROLE = /(^|\s)(staff|agencies|agency|editorial|editors?|desk|newsroom|team)(\s|$)/i;
const LOWERCASE_PARTICLES = new Set([
  'de',
  'del',
  'della',
  'di',
  'da',
  'van',
  'von',
  'der',
  'la',
  'le',
  'bin',
]);

const key = (name: string) => collapse(name).toLowerCase();
const collapse = (value: string) => value.replace(/\s+/g, ' ').trim();

const capitalise = (word: string) =>
  word
    .toLowerCase()
    .replace(/(^|[-'’])(\p{L})/gu, (_, sep: string, letter: string) => sep + letter.toUpperCase());

/** "JANE DOE" / "jane doe" -> "Jane Doe"; words with intentional inner caps ("McDonald") are kept. */
export const toTitleCase = (name: string): string =>
  name
    .split(' ')
    .map((word, index) => {
      if (index > 0 && LOWERCASE_PARTICLES.has(word.toLowerCase())) return word.toLowerCase();
      return word === word.toLowerCase() || word === word.toUpperCase() ? capitalise(word) : word;
    })
    .join(' ');

const cleanPerson = (part: string): string | undefined => {
  const name = collapse(
    part
      .replace(/\([^)]*\)/g, ' ') // "(Reuters)"
      .replace(/^(written\s+)?by[:\s]+/i, '')
      .replace(/\s+in\s+[A-Z].*$/, '') // Guardian: "Jane Doe in Washington"
      .replace(/^[\s"'.,;:-]+|[\s"'.,;:-]+$/g, ''),
  );
  if (name.length < 2 || name.length > 60) return undefined;
  if (/https?:|www\.|@|\d|\.com\b/i.test(name)) return undefined;
  if (!/\p{L}/u.test(name) || GENERIC_ROLE.test(name)) return undefined;
  return name;
};

/**
 * Canonical author list from a raw byline: strips "By ", splits "A and B" / "A, B",
 * drops URLs, emails, organisations and `extraBlocklist` (e.g. the publisher's own name),
 * title-cases and de-duplicates (case-insensitive).
 */
export const normalizeAuthors = (
  raw: string | readonly string[] | null | undefined,
  extraBlocklist: readonly (string | null | undefined)[] = [],
): string[] => {
  const blocked = new Set([...NOT_A_PERSON, ...extraBlocklist.filter(Boolean).map((n) => key(n!))]);
  const parts = (Array.isArray(raw) ? raw : [raw])
    .map((value) => cleanText(value as string | null | undefined))
    .flatMap((text) => (text ? text.split(/\s*(?:,|;|\||&|\band\b)\s*/i) : []));

  const seen = new Map<string, string>();
  for (const part of parts) {
    const person = cleanPerson(part);
    if (!person || blocked.has(key(person))) continue;
    const name = toTitleCase(person);
    seen.set(key(name), seen.get(key(name)) ?? name);
  }
  return [...seen.values()];
};

/** Normalises a single user-typed author name; undefined when it is not a usable name. */
export const normalizeAuthorName = (raw: string): string | undefined => normalizeAuthors(raw)[0];

/** Comparison key for matching preferences against article authors. */
export const authorKey = key;
