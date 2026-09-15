/**
 * Avatar URL validation. `img.src` is not a script sink, but an unchecked URL there is still a way
 * to smuggle a scheme we never meant to support, so the scheme is checked against an allow-list
 * before the value is assigned (see harness/README.md).
 */

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/** `data:` is allowed only for image media types — the seed avatars are inline SVGs. */
const DATA_IMAGE_PATTERN = /^data:image\/(?:png|jpeg|jpg|gif|webp|avif|bmp|x-icon|svg\+xml)[;,]/i;

/**
 * Returns the URL if it is safe to put in an `<img src>`, or null if it is empty or uses a
 * scheme we do not allow (`javascript:`, `vbscript:`, a non-image `data:`, …).
 */
export function safeAvatarUrl(raw: string): string | null {
  const url = raw.trim();
  if (url === '') return null;
  if (DATA_IMAGE_PATTERN.test(url)) return url;

  let parsed: URL;
  try {
    // Resolving against the document base also settles relative URLs, and normalises the leading
    // control characters and whitespace that scheme-smuggling tricks rely on.
    parsed = new URL(url, document.baseURI);
  } catch {
    return null;
  }
  return ALLOWED_PROTOCOLS.has(parsed.protocol) ? url : null;
}
