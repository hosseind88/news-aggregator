import { createArticle } from './createArticle';
import { authorKey, normalizeAuthorName, normalizeAuthors } from './authors';
import { normalizeCategory } from './category';
import {
  endOfLocalDay,
  isValidDay,
  isWithinDateRange,
  normalizeDate,
  startOfLocalDay,
} from './date';
import { cleanText, decodeEntities, stripPublisherSuffix, titleKey, truncate } from './text';
import { canonicalUrl, normalizeUrl, stableId } from './url';

describe('normalizeAuthors', () => {
  it.each([
    ['By Jane Doe', ['Jane Doe']],
    ['By Ann Author and Bob Coauthor', ['Ann Author', 'Bob Coauthor']],
    ['By Ann Author, Bob Coauthor and Cy Third', ['Ann Author', 'Bob Coauthor', 'Cy Third']],
    ['Ann Author & Bob Coauthor', ['Ann Author', 'Bob Coauthor']],
    ['JANE DOE', ['Jane Doe']],
    ['jane doe', ['Jane Doe']],
    ['MARY SMITH', ['Mary Smith']],
    ['Ryan McDonald', ['Ryan McDonald']],
    ['Jane Doe in Washington', ['Jane Doe']],
    ['Jane Doe (Reuters)', ['Jane Doe']],
    ['  Jane   Doe ', ['Jane Doe']],
    ['Jane Doe, jane doe', ['Jane Doe']],
  ])('%j -> %j', (raw, expected) => {
    expect(normalizeAuthors(raw)).toEqual(expected);
  });

  it.each([
    'https://www.facebook.com/bbcnews',
    'www.example.com',
    'newsdesk@example.com',
    '[Removed]',
    'Staff',
    'Reuters',
    'The Associated Press',
    'The New York Times',
    'Unknown',
    '',
  ])('drops junk %j', (raw) => {
    expect(normalizeAuthors(raw)).toEqual([]);
  });

  it('handles null, undefined and arrays', () => {
    expect(normalizeAuthors(null)).toEqual([]);
    expect(normalizeAuthors(undefined)).toEqual([]);
    expect(normalizeAuthors(['By Jane Doe', 'JOHN ROE'])).toEqual(['Jane Doe', 'John Roe']);
  });

  it('drops the publisher name used as a byline', () => {
    expect(normalizeAuthors('BBC News', ['BBC News'])).toEqual([]);
    expect(normalizeAuthors('Jane Doe, Wire', ['wire'])).toEqual(['Jane Doe']);
  });

  it('normalises user-typed names and compares case-insensitively', () => {
    expect(normalizeAuthorName('  by jane DOE ')).toBe('Jane Doe');
    expect(normalizeAuthorName('???')).toBeUndefined();
    expect(authorKey('Jane  Doe')).toBe(authorKey('jane doe'));
  });
});

describe('normalizeCategory', () => {
  it.each([
    ['business', 'business'],
    ['Business Day', 'business'],
    ['us-news', 'world'],
    ['World news', 'world'],
    ['Arts', 'entertainment'],
    ['artanddesign', 'entertainment'],
    ['sport', 'sports'],
    ['Sports', 'sports'],
    ['society', 'health'],
    ['Well', 'health'],
    ['uk-news', 'world'],
    ['U.S.', 'world'],
    ['Technology', 'technology'],
  ])('%j -> %j', (raw, expected) => {
    expect(normalizeCategory(raw)).toBe(expected);
  });

  it('returns undefined for unknown, empty or missing sections', () => {
    expect(normalizeCategory('Food')).toBeUndefined();
    expect(normalizeCategory('Opinion', '')).toBeUndefined();
    expect(normalizeCategory(null, undefined)).toBeUndefined();
    expect(normalizeCategory()).toBeUndefined();
  });

  it('uses the first candidate that maps', () => {
    expect(normalizeCategory('Food', 'technology')).toBe('technology');
    expect(normalizeCategory('Business Day', 'Sports')).toBe('business');
  });
});

describe('normalizeDate', () => {
  it.each([
    ['2024-05-02T10:00:00+0000', '2024-05-02T10:00:00.000Z'], // NYT
    ['2024-05-02T09:15:00Z', '2024-05-02T09:15:00.000Z'], // Guardian / NewsAPI
    ['2024-04-30T12:00:00+01:00', '2024-04-30T11:00:00.000Z'],
    ['2024-04-30T12:00:00-0500', '2024-04-30T17:00:00.000Z'],
    ['2024-05-02T08:30:00.123Z', '2024-05-02T08:30:00.123Z'],
  ])('%j -> %j', (raw, expected) => {
    expect(normalizeDate(raw)).toBe(expected);
  });

  it('returns undefined for invalid input', () => {
    expect(normalizeDate('not a date')).toBeUndefined();
    expect(normalizeDate('')).toBeUndefined();
    expect(normalizeDate(null)).toBeUndefined();
  });

  it('range checks are inclusive on UTC day bounds', () => {
    expect(isWithinDateRange('2024-05-03T23:59:00.000Z', '2024-05-01', '2024-05-03')).toBe(true);
    expect(isWithinDateRange('2024-05-04T00:00:00.000Z', '2024-05-01', '2024-05-03')).toBe(false);
    expect(isWithinDateRange('2024-04-30T23:59:59.000Z', '2024-05-01')).toBe(false);
    expect(isWithinDateRange('2024-05-01T00:00:00.000Z')).toBe(true);
  });
});

describe('text helpers', () => {
  it('decodes named, decimal and hex entities', () => {
    expect(decodeEntities('Tom &amp; Jerry &#8217;s &#x2014; &quot;ok&quot; &nbsp;x')).toBe(
      'Tom & Jerry ’s — "ok"  x',
    );
    expect(decodeEntities('&unknown; &#0;')).toBe('&unknown; &#0;');
  });

  it('strips tags, decodes, and collapses whitespace', () => {
    expect(cleanText('<p>Shares &amp; bonds</p>\n\n<p>rose   <b>sharply</b></p>')).toBe(
      'Shares & bonds rose sharply',
    );
    expect(cleanText('Rates fell &lt;b&gt;fast&lt;/b&gt;')).toBe('Rates fell fast');
    expect(cleanText('5 < 6 and 7 > 3')).toBe('5 < 6 and 7 > 3');
  });

  it('returns undefined for empty values and placeholders', () => {
    expect(cleanText('')).toBeUndefined();
    expect(cleanText('   <br/> ')).toBeUndefined();
    expect(cleanText('[Removed]')).toBeUndefined();
    expect(cleanText(null)).toBeUndefined();
  });

  it('caps length at a word boundary with an ellipsis', () => {
    const text = 'word '.repeat(100);
    const out = cleanText(text, { maxLength: 40 });
    expect(out?.length).toBeLessThanOrEqual(40);
    expect(out?.endsWith('…')).toBe(true);
    expect(truncate('short', 40)).toBe('short');
  });

  it('strips " - Publisher" title suffixes only for the matching publisher', () => {
    expect(stripPublisherSuffix('Chips rally - BBC News', 'BBC News')).toBe('Chips rally');
    expect(stripPublisherSuffix('Chips rally | bbc news', 'BBC News')).toBe('Chips rally');
    expect(stripPublisherSuffix('Chips rally - Reuters', 'BBC News')).toBe('Chips rally - Reuters');
    expect(stripPublisherSuffix('BBC News', 'BBC News')).toBe('BBC News');
  });

  it('titleKey ignores case and punctuation', () => {
    expect(titleKey('Markets: Edge Higher!')).toBe(titleKey('markets edge  higher'));
  });
});

describe('url helpers', () => {
  it('normalizeUrl accepts only absolute https URLs', () => {
    expect(normalizeUrl('https://example.com/a.jpg')).toBe('https://example.com/a.jpg');
    expect(normalizeUrl('http://example.com/a.jpg')).toBe('https://example.com/a.jpg');
    expect(normalizeUrl('images/a.jpg', 'https://www.nytimes.com/')).toBe(
      'https://www.nytimes.com/images/a.jpg',
    );
    expect(normalizeUrl('//cdn.example.com/a.jpg', 'https://www.nytimes.com/')).toBe(
      'https://cdn.example.com/a.jpg',
    );
    expect(normalizeUrl('images/a.jpg')).toBeUndefined();
    expect(normalizeUrl('javascript:alert(1)')).toBeUndefined();
    expect(normalizeUrl('data:image/png;base64,AAAA')).toBeUndefined();
    expect(normalizeUrl('ftp://example.com/a')).toBeUndefined();
    expect(normalizeUrl('')).toBeUndefined();
    expect(normalizeUrl(null)).toBeUndefined();
  });

  it('canonicalUrl ignores scheme, www, query, hash and trailing slash', () => {
    const base = canonicalUrl('https://www.bbc.co.uk/news/chips');
    expect(canonicalUrl('http://bbc.co.uk/news/chips/?utm_source=x#top')).toBe(base);
    expect(canonicalUrl('https://BBC.co.uk/News/Chips')).toBe(base);
  });

  it('stableId is deterministic and URL-derived', () => {
    expect(stableId('nyt', 'https://a.com/x?y=1')).toBe(stableId('nyt', 'https://www.a.com/x/'));
    expect(stableId('nyt', 'https://a.com/x')).not.toBe(stableId('nyt', 'https://a.com/y'));
    expect(stableId('nyt', 'https://a.com/x')).toMatch(/^nyt-/);
  });
});

describe('createArticle', () => {
  const raw = {
    source: 'newsapi' as const,
    title: 'Chips rally &amp; surge - BBC News',
    url: 'http://www.bbc.co.uk/news/chips?at=1',
    publishedAt: '2024-05-02T10:00:00+0000',
    publisher: 'BBC News',
    author: 'BBC News',
  };

  it('builds a normalised article', () => {
    expect(createArticle(raw)).toMatchObject({
      title: 'Chips rally & surge',
      url: 'https://www.bbc.co.uk/news/chips?at=1',
      authors: [],
      source: 'newsapi',
      sourceName: 'NewsAPI',
      publisher: 'BBC News',
      publishedAt: '2024-05-02T10:00:00.000Z',
    });
  });

  it.each([
    { title: '[Removed]' },
    { title: '' },
    { url: 'not-a-url' },
    { url: 'javascript:alert(1)' },
    { publishedAt: 'garbage' },
  ])('drops unusable records %j', (override) => {
    expect(createArticle({ ...raw, ...override })).toBeUndefined();
  });
});

describe('local-day semantics', () => {
  it('accepts only real calendar days', () => {
    expect(isValidDay('2024-02-29')).toBe(true);
    expect(isValidDay('2023-02-29')).toBe(false);
    expect(isValidDay('2024-13-01')).toBe(false);
    expect(isValidDay('garbage')).toBe(false);
    expect(isValidDay(undefined)).toBe(false);
  });

  it('treats the day as the viewer sees it, not as UTC', () => {
    process.env.TZ = 'Pacific/Auckland'; // UTC+13 on 2026-10-27
    expect(startOfLocalDay('2026-10-27')?.toISOString()).toBe('2026-10-26T11:00:00.000Z');
    expect(endOfLocalDay('2026-10-27')?.toISOString()).toBe('2026-10-27T10:59:59.999Z');
    // 01:00 local on the 27th is still the 26th in UTC; "Today" must include it.
    expect(isWithinDateRange('2026-10-26T12:00:00.000Z', '2026-10-27', '2026-10-27')).toBe(true);
    expect(isWithinDateRange('2026-10-27T11:00:00.000Z', '2026-10-27', '2026-10-27')).toBe(false);
  });

  it('handles zones behind UTC', () => {
    process.env.TZ = 'America/Los_Angeles';
    expect(isWithinDateRange('2024-05-02T06:30:00.000Z', '2024-05-01', '2024-05-01')).toBe(true);
    expect(isWithinDateRange('2024-05-02T07:30:00.000Z', '2024-05-01', '2024-05-01')).toBe(false);
  });
});
