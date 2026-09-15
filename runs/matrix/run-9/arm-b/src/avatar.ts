const ALLOWED_SCHEMES = ['http:', 'https:'];

export function sanitizeAvatarUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  if (/^data:image\//i.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed, location.href);
    if (ALLOWED_SCHEMES.includes(url.protocol)) return url.href;
  } catch {
    return null;
  }
  return null;
}
