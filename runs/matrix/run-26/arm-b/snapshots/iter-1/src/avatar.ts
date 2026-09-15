/**
 * `img.src` is not a script sink, but a `javascript:` or `vbscript:` URL there is still a way to
 * get script into the page on some paths, so the scheme is checked against an allowlist before the
 * URL is used. Anything else means "no avatar".
 */
const HTTP_URL = /^https?:\/\//i;
const IMAGE_DATA_URL = /^data:image\/(?:png|jpeg|jpg|gif|webp|avif|svg\+xml)[;,]/i;

/** Returns the URL if it is a usable image URL, or null if it is not. */
export function safeAvatarUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  if (HTTP_URL.test(url) || IMAGE_DATA_URL.test(url)) return url;
  return null;
}
