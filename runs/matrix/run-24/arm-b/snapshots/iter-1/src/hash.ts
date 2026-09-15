/**
 * The URL fragment is the app's route: `#q=<query>`, `#note=<id>` or `#q=port&note=3`.
 * It is read on load and kept in sync as the query and the selection change.
 */

export interface Route {
  query: string;
  noteId: number | null;
}

export const EMPTY_ROUTE: Route = { query: '', noteId: null };

/** The route currently in the address bar. */
export function readRoute(): Route {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  const note = params.get('note');
  return {
    query: params.get('q') ?? '',
    noteId: note !== null && /^\d+$/.test(note) ? Number(note) : null,
  };
}

/** The fragment for a route, without the leading '#'. Empty when nothing is active. */
export function formatRoute(route: Route): string {
  const params = new URLSearchParams();
  if (route.query !== '') params.set('q', route.query);
  if (route.noteId !== null) params.set('note', String(route.noteId));
  return params.toString();
}

/**
 * Put `route` in the address bar. `replaceState` rather than `location.hash`: typing in
 * the search box would otherwise push a history entry per keystroke (and assigning to
 * `location` from a string is what the lint rules ban).
 */
export function writeRoute(route: Route): void {
  const fragment = formatRoute(route);
  if (fragment === location.hash.replace(/^#/, '')) return;
  const url = location.pathname + location.search + (fragment === '' ? '' : `#${fragment}`);
  history.replaceState(null, '', url);
}
