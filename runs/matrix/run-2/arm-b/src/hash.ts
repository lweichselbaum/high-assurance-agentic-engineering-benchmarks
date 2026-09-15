export interface RouteState {
  query: string;
  noteId: number | null;
}

export function parseHash(hash: string): RouteState {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const query = params.get('q') ?? '';
  const noteParam = params.get('note');
  const noteId = noteParam !== null && /^\d+$/.test(noteParam) ? Number(noteParam) : null;
  return { query, noteId };
}

export function serializeHash(state: RouteState): string {
  const params = new URLSearchParams();
  if (state.query) params.set('q', state.query);
  if (state.noteId !== null) params.set('note', String(state.noteId));
  const serialized = params.toString();
  return serialized ? `#${serialized}` : '';
}
