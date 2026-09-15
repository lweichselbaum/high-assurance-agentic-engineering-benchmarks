/**
 * Avatar URLs are user input. `img.src` is not a script sink, but a URL from a user still decides
 * what the browser fetches, so only `http:`, `https:` and `data:image/…` are let through —
 * `javascript:`, `data:text/html` and the rest are dropped and the avatar is simply not shown.
 */

/** Returns the URL to put on `img.src`, or null when the value is empty or not an allowed scheme. */
export function safeAvatarUrl(value: string): string | null {
  const url = value.trim();
  if (url === '') return null;
  if (/^data:image\/[a-z0-9.+-]+[,;]/i.test(url)) return url;
  let parsed: URL;
  try {
    parsed = new URL(url, document.baseURI);
  } catch {
    return null;
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
}
