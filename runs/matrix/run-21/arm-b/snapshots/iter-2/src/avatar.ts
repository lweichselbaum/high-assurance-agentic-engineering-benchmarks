/**
 * Avatar URLs. `img.src` is not a script sink, but a stored string still decides what the browser
 * fetches, so the scheme is checked before it is assigned: http(s) or an inline image, nothing else.
 */

/** `data:image/svg+xml;utf8,…` and friends. SVG loaded through `<img>` cannot run script. */
const DATA_IMAGE = /^data:image\/[a-z0-9.+-]+[,;]/i;

/** The URL to use for `img.src`, or `null` when there is nothing safe to show. */
export function safeAvatarUrl(raw: string): string | null {
  const value = raw.trim();
  if (value === '') return null;
  if (DATA_IMAGE.test(value)) return value;

  let url: URL;
  try {
    url = new URL(value, document.baseURI);
  } catch {
    return null;
  }
  return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
}
