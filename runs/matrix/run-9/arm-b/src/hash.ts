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

export function buildHash(state: HashState): string {
  const params = new URLSearchParams();
  if (state.query !== '') params.set('q', state.query);
  if (state.noteId !== null) params.set('note', String(state.noteId));
  const search = params.toString();
  return search === '' ? '' : `#${search}`;
}

export function readHash(): HashState {
  return parseHash(location.hash);
}

export function writeHash(state: HashState): void {
  const next = buildHash(state);
  const current = location.hash.startsWith('#') || location.hash === '' ? location.hash : `#${location.hash}`;
  if (next === current) return;
  const url = `${location.pathname}${location.search}${next}`;
  history.replaceState(null, '', url);
}
