import { cleanText } from './text';

/** Organisations and placeholders that APIs put in the byline instead of a person. */
const NOT_A_PERSON = new Set([
  'ap',
  'afp',
  'reuters',
  'associated press',
  'the associated press',
  'the new york times',
  'unknown',
  'n/a',
]);

const GENERIC_ROLE = /(^|\s)(staff|agencies|agency|editorial|editors?|desk|newsroom|team)(\s|$)/i;
const toAuthorKey = (name: string) => collapseWhitespace(name).toLowerCase();
const collapseWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

/** "JANE DOE" / "jane doe" -> "Jane Doe"; words with intentional inner caps ("McDonald") are kept. */
const toTitleCase = (name: string): string =>
  name
    .split(' ')
    .map((word) =>
      word === word.toLowerCase() || word === word.toUpperCase()
        ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        : word,
    )
    .join(' ');

const cleanPerson = (part: string): string | undefined => {
  const name = collapseWhitespace(
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

/** Canonical authors from a raw byline; `extraBlocklist` holds names to drop (the publisher's own). */
export const normalizeAuthors = (
  raw: string | readonly string[] | null | undefined,
  extraBlocklist: readonly (string | null | undefined)[] = [],
): string[] => {
  const blocked = new Set([
    ...NOT_A_PERSON,
    ...extraBlocklist.filter(Boolean).map((blockedName) => toAuthorKey(blockedName!)),
  ]);
  const parts = (Array.isArray(raw) ? raw : [raw])
    .map((value) => cleanText(value as string | null | undefined))
    .flatMap((text) => (text ? text.split(/\s*(?:,|;|\||&|\band\b)\s*/i) : []));

  const seen = new Map<string, string>();
  for (const part of parts) {
    const person = cleanPerson(part);
    if (!person || blocked.has(toAuthorKey(person))) continue;
    const name = toTitleCase(person);
    seen.set(toAuthorKey(name), seen.get(toAuthorKey(name)) ?? name);
  }
  return [...seen.values()];
};

export const normalizeAuthorName = (raw: string): string | undefined => normalizeAuthors(raw)[0];

export const authorKey = toAuthorKey;

export const hasAnyAuthor = (articleAuthors: readonly string[], followed: readonly string[]) => {
  const followedKeys = new Set(followed.map(toAuthorKey));
  return articleAuthors.some((name) => followedKeys.has(toAuthorKey(name)));
};
