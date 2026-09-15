/** Avatar URLs come from user input; only allow schemes an <img src> can't turn into script execution. */
export function validateAvatarUrl(url: string): string | null {
  const trimmed = url.trim();
  if (trimmed === '') return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^data:image\//i.test(trimmed)) return trimmed;
  return null;
}
