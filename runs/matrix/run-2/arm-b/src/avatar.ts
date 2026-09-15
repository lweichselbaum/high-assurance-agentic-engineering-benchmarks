const SAFE_AVATAR_SCHEMES = [/^https:\/\//i, /^http:\/\//i, /^data:image\//i];

export function isSafeAvatarUrl(url: string): boolean {
  return SAFE_AVATAR_SCHEMES.some((scheme) => scheme.test(url));
}
