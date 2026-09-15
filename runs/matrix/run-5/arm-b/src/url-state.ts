export interface UrlState {
  query: string;
  noteId: number | null;
}

export function parseUrlState(hash: string): UrlState {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const query = params.get('q') ?? '';
  const noteParam = params.get('note');
  const noteId = noteParam !== null && /^\d+$/.test(noteParam) ? Number(noteParam) : null;
  return { query, noteId };
}

export function formatUrlState(state: UrlState): string {
  const parts: string[] = [];
  if (state.query) parts.push(`q=${encodeURIComponent(state.query)}`);
  if (state.noteId !== null) parts.push(`note=${state.noteId}`);
  return parts.length ? `#${parts.join('&')}` : '';
}

/** Keeps the fragment in sync without polluting browser history on every keystroke/click. */
export function writeUrlState(state: UrlState): void {
  const url = location.pathname + location.search + formatUrlState(state);
  history.replaceState(null, '', url);
}
