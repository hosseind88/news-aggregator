/**
 * Absolute https URL, or undefined. Resolves relative paths against `base`, upgrades http,
 * and rejects other schemes (javascript:, data:, …).
 */
export const normalizeUrl = (raw: string | null | undefined, base?: string): string | undefined => {
  const value = raw?.trim();
  if (!value) return undefined;
  try {
    const url = new URL(value, base);
    if (url.protocol === 'http:') url.protocol = 'https:';
    return url.protocol === 'https:' && url.hostname.includes('.') ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};

/** Identity of a page for de-duplication: no scheme, `www.`, query, hash or trailing slash. */
export const canonicalUrl = (url: string): string => {
  try {
    const { hostname, pathname } = new URL(url);
    return `${hostname.replace(/^www\./, '')}${pathname.replace(/\/+$/, '')}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
};

/** Stable, URL-derived id so the same story keeps the same React key across fetches. */
export const stableId = (prefix: string, url: string): string => {
  const value = canonicalUrl(url);
  let hash = 5381;
  for (let i = 0; i < value.length; i++) hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0;
  return `${prefix}-${(hash >>> 0).toString(36)}`;
};
