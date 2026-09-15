export interface RouteState {
  query: string;
  noteId: number | null;
}

export function parseHash(hash: string): RouteState {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);
  const query = params.get('q') ?? '';
  const noteRaw = params.get('note');
  const noteId = noteRaw !== null && /^\d+$/.test(noteRaw) ? Number(noteRaw) : null;
  return { query, noteId };
}

export function formatHash(state: RouteState): string {
  const params = new URLSearchParams();
  if (state.query) params.set('q', state.query);
  if (state.noteId !== null) params.set('note', String(state.noteId));
  const serialized = params.toString();
  return serialized ? `#${serialized}` : '';
}

/** Keeps the URL fragment in sync without ever assigning to `location.hash`. */
export function writeHash(state: RouteState): void {
  const next = formatHash(state);
  if (next === location.hash || (next === '' && location.hash === '')) return;
  const url = next === '' ? location.pathname + location.search : location.pathname + location.search + next;
  history.replaceState(null, '', url);
}
