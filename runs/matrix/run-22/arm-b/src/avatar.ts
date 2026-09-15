/**
 * Avatar URLs. `img.src` is not a script sink, but the scheme still needs checking (see
 * harness/README.md): only `http:`, `https:` and image `data:` URLs — plus a plain relative path —
 * may reach the DOM. Anything else returns the empty string and the caller renders no `<img>`.
 */
import { hasScheme, isUrlShaped } from './url';

const HTTP_RE = /^https?:\/\//i;
const DATA_IMAGE_RE = /^data:image\/(?:png|jpeg|jpg|gif|webp|avif|svg\+xml)[;,]/i;

export function safeAvatarUrl(raw: string): string {
  const value = raw.trim();
  if (!isUrlShaped(value)) return '';
  if (DATA_IMAGE_RE.test(value)) return value;
  if (!hasScheme(value)) return value;
  return HTTP_RE.test(value) ? value : '';
}
