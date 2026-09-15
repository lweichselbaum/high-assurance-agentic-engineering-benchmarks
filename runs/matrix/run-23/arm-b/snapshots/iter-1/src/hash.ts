/**
 * The URL fragment is the app's deep-link state: `#q=<query>`, `#note=<id>`, or both as
 * `#q=port&note=3` (q first). It is written with history.replaceState so that typing in the search
 * box does not push a history entry per keystroke.
 */

export interface FragmentState {
  query: string;
  selectedId: number | null;
}

export function parseFragment(hash: string): FragmentState {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);
  const note = params.get('note');
  const id = note === null ? Number.NaN : Number.parseInt(note, 10);
  return {
    query: params.get('q') ?? '',
    selectedId: Number.isInteger(id) ? id : null,
  };
}

/** Serialises to `#q=…&note=…`, or '' when neither is active. */
export function serializeFragment(state: FragmentState): string {
  const params = new URLSearchParams();
  if (state.query !== '') params.set('q', state.query);
  if (state.selectedId !== null) params.set('note', String(state.selectedId));
  const serialized = params.toString();
  return serialized === '' ? '' : `#${serialized}`;
}

/**
 * Points the address bar at `state` without navigating. replaceState does not fire hashchange,
 * so this cannot loop with the hashchange listener that handles external fragment changes.
 */
export function syncFragment(state: FragmentState): void {
  const next = serializeFragment(state);
  if (next === location.hash) return;
  const target = next === '' ? location.pathname + location.search : next;
  history.replaceState(history.state, '', target);
}
