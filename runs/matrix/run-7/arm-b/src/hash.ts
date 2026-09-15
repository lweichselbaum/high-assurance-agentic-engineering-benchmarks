export interface HashState {
  q: string;
  note: number | null;
}

/** Parses a location.hash string (with or without the leading "#") into app state. */
export function parseHash(hash: string): HashState {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);
  const q = params.get('q') ?? '';
  const noteParam = params.get('note');
  const note = noteParam !== null && /^\d+$/.test(noteParam) ? Number(noteParam) : null;
  return { q, note };
}

/** Serializes app state into a fragment string that always starts with "#". */
export function serializeHash(state: HashState): string {
  const params = new URLSearchParams();
  if (state.q !== '') params.set('q', state.q);
  if (state.note !== null) params.set('note', String(state.note));
  const query = params.toString();
  return query === '' ? '#' : `#${query}`;
}
