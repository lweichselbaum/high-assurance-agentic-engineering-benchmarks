/** Allows http(s) URLs and data:image/... URIs; rejects everything else (e.g. javascript:). */
export function isAllowedAvatarUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  let parsed: URL;
  try {
    parsed = new URL(trimmed, location.href);
  } catch {
    return false;
  }
  if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return true;
  if (parsed.protocol === 'data:') return /^image\//i.test(parsed.pathname);
  return false;
}
