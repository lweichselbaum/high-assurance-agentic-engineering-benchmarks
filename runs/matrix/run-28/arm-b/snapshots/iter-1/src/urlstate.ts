import type { ViewState } from './types';

/**
 * The search query and the selected note live in the URL fragment (`#q=port&note=3`) so a view of
 * the board is a link. The fragment is attacker-controlled — it is the cheapest thing to put in
 * someone else's URL — so `read` only ever produces a string and an integer, and every consumer
 * treats them as data.
 */
export function readViewState(): ViewState {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  const note = params.get('note');
  return {
    query: params.get('q') ?? '',
    selectedId: note !== null && /^\d+$/.test(note) ? Number(note) : null,
  };
}

/** Mirrors the state back into the fragment, keeping `q` before `note` as the deep-link format says. */
export function writeViewState(state: ViewState): void {
  const params = new URLSearchParams();
  if (state.query !== '') params.set('q', state.query);
  if (state.selectedId !== null) params.set('note', String(state.selectedId));

  const fragment = params.toString();
  const base = location.pathname + location.search;
  const next = fragment === '' ? base : `${base}#${fragment}`;
  if (next !== base + location.hash) {
    // replaceState rather than assigning location.hash: typing in the search box should not fill
    // the back button with one entry per keystroke, and it does not fire `hashchange` at us.
    history.replaceState(null, '', next);
  }
}
