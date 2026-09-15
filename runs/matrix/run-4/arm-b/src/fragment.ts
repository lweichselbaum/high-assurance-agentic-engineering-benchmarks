/** The URL fragment holds the search query and the selected note id, e.g. `#q=port&note=3`. */
export interface FragmentState {
  q: string;
  note: number | null;
}

export function parseFragment(): FragmentState {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const q = params.get('q') ?? '';
  const noteParam = params.get('note');
  const noteId = noteParam !== null ? Number(noteParam) : NaN;
  return { q, note: Number.isFinite(noteId) ? noteId : null };
}

/** Replaces the current history entry so updates don't spam back/forward navigation. */
export function writeFragment(state: FragmentState): void {
  const parts: string[] = [];
  if (state.q) parts.push(`q=${encodeURIComponent(state.q)}`);
  if (state.note !== null) parts.push(`note=${state.note}`);
  const hash = parts.length ? `#${parts.join('&')}` : '';
  const url = window.location.pathname + window.location.search + hash;
  history.replaceState(null, '', url);
}
