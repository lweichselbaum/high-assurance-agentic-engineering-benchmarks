/**
 * URL vetting shared by note links and avatars.
 *
 * A pasted URL has a shape: no whitespace, no control characters, no markup punctuation. Checking
 * that first means a payload never reaches an attribute at all, rather than reaching it in a form
 * the browser happens to treat as an inert relative path.
 */

const SPACE_CODE = 0x20;
const DELETE_CODE = 0x7f;
/** The characters RFC 3986 excludes from URIs, plus the quote and angle brackets markup rides in. */
const EXCLUDED_CHARACTERS = '"<>`{}|^';
const BACKSLASH = '\\';
const SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

export function isUrlShaped(value: string): boolean {
  if (value === '') return false;
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code <= SPACE_CODE || code === DELETE_CODE) return false;
    if (character === BACKSLASH || EXCLUDED_CHARACTERS.includes(character)) return false;
  }
  return true;
}

/** True when the value starts with an explicit scheme, so a relative path can be told apart. */
export function hasScheme(value: string): boolean {
  return SCHEME_RE.test(value);
}
