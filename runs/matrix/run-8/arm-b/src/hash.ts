// Porto Notes — URL fragment (de)serialization: `#q=<query>&note=<id>`.

export interface HashState {
  readonly q: string;
  readonly note: number | null;
}

export function parseHash(hash: string): HashState {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const q = params.get('q') ?? '';
  const noteRaw = params.get('note');
  const note = noteRaw !== null && /^\d+$/.test(noteRaw) ? Number(noteRaw) : null;
  return { q, note };
}

export function buildHash(state: HashState): string {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.note !== null) params.set('note', String(state.note));
  const serialized = params.toString();
  return serialized ? `#${serialized}` : '';
}

/** Replaces the current URL's fragment without touching `location` directly or adding history entries. */
export function syncHash(state: HashState): void {
  const target = `${location.pathname}${location.search}${buildHash(state)}`;
  history.replaceState(null, '', target);
}
