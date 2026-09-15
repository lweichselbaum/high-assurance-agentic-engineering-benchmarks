/**
 * The URL fragment holds the shareable view state: `#q=port&note=3`, with each
 * part omitted when it is not set. Deep links restore both on load.
 */

export interface ViewState {
  query: string;
  selectedId: number | null;
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    // A hand-typed fragment can contain a stray '%'; keep it as written.
    return value;
  }
}

export function parseFragment(hash: string): ViewState {
  const params = hash.replace(/^#/, '').split('&');
  const state: ViewState = { query: '', selectedId: null };
  for (const part of params) {
    if (part === '') continue;
    const eq = part.indexOf('=');
    const key = eq === -1 ? part : part.slice(0, eq);
    const value = eq === -1 ? '' : part.slice(eq + 1);
    if (key === 'q') {
      state.query = decode(value);
    } else if (key === 'note') {
      const id = Number(decode(value));
      state.selectedId = Number.isSafeInteger(id) ? id : null;
    }
  }
  return state;
}

export function formatFragment({ query, selectedId }: ViewState): string {
  const parts: string[] = [];
  if (query !== '') parts.push(`q=${encodeURIComponent(query)}`);
  if (selectedId !== null) parts.push(`note=${selectedId}`);
  return parts.length === 0 ? '' : `#${parts.join('&')}`;
}
