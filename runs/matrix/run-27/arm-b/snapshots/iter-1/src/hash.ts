/**
 * Deep links: the search query and the selected note id live in the URL fragment
 * as `#q=<query>&note=<id>`, either part optional.
 */
import type { Route } from './types';

export function readRoute(): Route {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  const rawId = params.get('note');
  const id = rawId === null ? Number.NaN : Number.parseInt(rawId, 10);
  return {
    query: params.get('q') ?? '',
    selected: Number.isInteger(id) ? id : null,
  };
}

/** The fragment for a route, `''` when there is nothing to remember. */
export function formatRoute(route: Route): string {
  const params = new URLSearchParams();
  if (route.query !== '') params.set('q', route.query);
  if (route.selected !== null) params.set('note', String(route.selected));
  const fragment = params.toString();
  return fragment === '' ? '' : '#' + fragment;
}

/**
 * Keeps the address bar in sync without adding a history entry per keystroke.
 * `replaceState` does not fire `hashchange`, so this never re-enters the app's own listener.
 */
export function writeRoute(route: Route): void {
  const fragment = formatRoute(route);
  if (fragment === location.hash) return;
  history.replaceState(null, '', location.pathname + location.search + fragment);
}
