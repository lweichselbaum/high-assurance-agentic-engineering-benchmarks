/**
 * URL checks for the two places a note carries one: a link href inside the
 * body, and the author avatar. Both are author-supplied, so both go through a
 * scheme allow-list before they reach an attribute.
 */

/** Control/format characters browsers ignore in URLs; dropping them first stops `java\tscript:`. */
const STRIPPED = /[\u0000-\u0020\u007f\u00a0\u200b-\u200f\u2028\u2029\u3000\ufeff]/g;
const SCHEME = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;
const IMAGE_DATA_URL = /^data:image\/(png|jpeg|jpg|gif|webp|avif|bmp|x-icon|svg\+xml)[;,]/i;

const LINK_SCHEMES = new Set(['http', 'https', 'mailto']);

function normalise(raw: string): string {
  return raw.replace(STRIPPED, '');
}

/**
 * An href safe to put on an anchor: http(s), mailto, or a relative/fragment
 * URL. Anything else (`javascript:`, `data:`, `vbscript:`, unknown schemes)
 * is rejected.
 */
export function safeLinkHref(raw: string): string | null {
  const url = normalise(raw);
  if (!url) return null;
  const scheme = SCHEME.exec(url);
  if (!scheme) return url; // relative, absolute path, or "#fragment"
  return LINK_SCHEMES.has(scheme[1].toLowerCase()) ? url : null;
}

/**
 * An image src safe to put on `<img>`: http(s), a relative URL, or an image
 * data URL (the seed avatars are inline SVG; SVG loaded through `<img>` cannot
 * run script or fetch anything).
 */
export function safeImageSrc(raw: string): string | null {
  const url = normalise(raw);
  if (!url) return null;
  const scheme = SCHEME.exec(url);
  if (!scheme) return url;
  const name = scheme[1].toLowerCase();
  if (name === 'http' || name === 'https') return url;
  if (name === 'data') return IMAGE_DATA_URL.test(url) ? url : null;
  return null;
}
