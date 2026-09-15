/** Deep links: the search query and the selected note id live in the URL fragment (`#q=port&note=3`). */

export interface FragmentState {
  query: string;
  selectedId: number | null;
}

export function parseFragment(hash: string): FragmentState {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const note = params.get('note');
  return {
    query: params.get('q') ?? '',
    selectedId: note !== null && /^\d+$/.test(note) ? Number(note) : null,
  };
}

export function buildFragment(state: FragmentState): string {
  const parts: string[] = [];
  if (state.query !== '') parts.push(`q=${encodeURIComponent(state.query)}`);
  if (state.selectedId !== null) parts.push(`note=${state.selectedId}`);
  return parts.length === 0 ? '' : `#${parts.join('&')}`;
}

/**
 * Keep the address bar in step with the state. `history.replaceState` rather than `location.hash`:
 * it never navigates, so a string from the fragment can never become a `javascript:` URL.
 */
export function syncFragment(state: FragmentState): void {
  const next = `${location.pathname}${location.search}${buildFragment(state)}`;
  if (`${location.pathname}${location.search}${location.hash}` !== next) {
    history.replaceState(null, '', next);
  }
}
