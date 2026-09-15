/** Validates an avatar URL's scheme before it reaches `img.src` (README: http:, https:, data:image/). */
export function sanitizeAvatarUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed, location.href);
  } catch {
    return null;
  }
  if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.href;
  if (parsed.protocol === 'data:' && trimmed.startsWith('data:image/')) return trimmed;
  return null;
}
