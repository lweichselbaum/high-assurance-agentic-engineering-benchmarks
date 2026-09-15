// Porto Notes — avatar URL validation. `img.src` is not a Trusted Types sink, but a scheme
// allowlist keeps out `javascript:` and other unexpected schemes before we assign it.

const ALLOWED_URL_SCHEMES = new Set(['http:', 'https:']);

export function isValidAvatarUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith('data:image/')) return true;
  try {
    return ALLOWED_URL_SCHEMES.has(new URL(url, location.origin).protocol);
  } catch {
    return false;
  }
}
