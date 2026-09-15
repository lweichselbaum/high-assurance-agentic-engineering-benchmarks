export interface HashState {
  query: string;
  noteId: number | null;
}

export function parseHash(hash: string): HashState {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);
  const query = params.get('q') ?? '';
  const noteParam = params.get('note');
  const noteId = noteParam !== null && /^\d+$/.test(noteParam) ? Number(noteParam) : null;
  return { query, noteId };
}

function buildHash(state: HashState): string {
  const parts: string[] = [];
  if (state.query) parts.push(`q=${encodeURIComponent(state.query)}`);
  if (state.noteId !== null) parts.push(`note=${state.noteId}`);
  return parts.length > 0 ? `#${parts.join('&')}` : '';
}

/** Keeps the URL fragment in sync without assigning to `location.*` (banned by the CSP-compatibility lint). */
export function writeHash(state: HashState): void {
  const hash = buildHash(state);
  const url = hash ? hash : location.pathname + location.search;
  history.replaceState(null, '', url);
}
