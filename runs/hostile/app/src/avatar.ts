const SAFE_AVATAR_SCHEME = /^(https?:|data:image\/)/i;

/** Returns the avatar URL if its scheme is allowed, otherwise null. */
export function safeAvatarUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  return SAFE_AVATAR_SCHEME.test(trimmed) ? trimmed : null;
}
