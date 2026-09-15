/**
 * Avatar URLs come from a text field, so the scheme is checked before the string is
 * allowed near `img.src`: only http(s) and image data URLs pass. Anything else — most
 * of all `javascript:` — is dropped and the note renders without an avatar.
 */

const IMAGE_DATA_URL = /^data:image\/[a-z0-9.+-]+[;,]/i;

/** The URL to put on `img.src`, or `null` when it is not a safe image URL. */
export function safeAvatarUrl(raw: string): string | null {
  const value = raw.trim();
  if (value === '') return null;

  let parsed: URL;
  try {
    parsed = new URL(value, document.baseURI);
  } catch {
    return null;
  }

  if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return value;
  if (parsed.protocol === 'data:' && IMAGE_DATA_URL.test(value)) return value;
  return null;
}
