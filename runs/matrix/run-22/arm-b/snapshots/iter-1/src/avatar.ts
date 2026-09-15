/**
 * Avatar URLs. `img.src` is not a script sink, but a scheme check still belongs here: it keeps
 * `javascript:` and non-image `data:` URLs out of the DOM (harness/README.md). An unusable URL
 * returns the empty string and the caller renders no `<img>` at all.
 */

const HTTP_RE = /^https?:\/\//i;
const DATA_IMAGE_RE = /^data:image\/(?:png|jpeg|jpg|gif|webp|avif|svg\+xml)[;,]/i;
const SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

export function safeAvatarUrl(raw: string): string {
  const value = raw.trim();
  if (value === '') return '';
  if (HTTP_RE.test(value)) return value;
  if (DATA_IMAGE_RE.test(value)) return value;
  // Anything else carrying a scheme is refused; a bare path stays relative to this origin.
  return SCHEME_RE.test(value) ? '' : value;
}
