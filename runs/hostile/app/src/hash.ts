export interface HashState {
  query: string;
  noteId: number | null;
}

export function parseHash(hash: string): HashState {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const query = params.get('q') ?? '';
  const noteParam = params.get('note');
  const noteId = noteParam !== null && /^\d+$/.test(noteParam) ? Number(noteParam) : null;
  return { query, noteId };
}

export function writeHash(state: HashState): void {
  const parts: string[] = [];
  if (state.query) parts.push(`q=${encodeURIComponent(state.query)}`);
  if (state.noteId !== null) parts.push(`note=${state.noteId}`);
  const url = new URL(window.location.href);
  url.hash = parts.join('&');
  history.replaceState(null, '', url.toString());
}
