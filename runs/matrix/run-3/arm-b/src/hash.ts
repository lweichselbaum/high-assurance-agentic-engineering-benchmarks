export interface HashState {
  query: string;
  noteId: number | null;
}

export function parseHash(hash: string): HashState {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);
  const query = params.get('q') ?? '';
  const noteIdRaw = params.get('note');
  const noteId = noteIdRaw !== null && /^\d+$/.test(noteIdRaw) ? Number(noteIdRaw) : null;
  return { query, noteId };
}

function buildHash(state: HashState): string {
  const parts: string[] = [];
  if (state.query !== '') parts.push(`q=${encodeURIComponent(state.query)}`);
  if (state.noteId !== null) parts.push(`note=${state.noteId}`);
  return parts.length ? `#${parts.join('&')}` : '';
}

/** Keeps the URL fragment in sync with app state without adding history entries or reloading. */
export function syncHash(state: HashState): void {
  const hash = buildHash(state);
  const url = `${location.pathname}${location.search}${hash}`;
  history.replaceState(null, '', url);
}
