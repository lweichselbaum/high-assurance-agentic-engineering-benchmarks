/**
 * Deep links: the query and the selected note id live in the URL fragment, as `#q=…&note=…`.
 *
 * The fragment is written with history.replaceState — assigning to `location` would be a way
 * to smuggle a `javascript:` URL into a navigation, and the harness bans it for that reason.
 */
import type { ViewState } from './types';

export function parseHash(hash: string): ViewState {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const note = params.get('note');
  const selectedId = note !== null && /^-?\d+$/.test(note) ? Number(note) : null;
  return { query: params.get('q') ?? '', selectedId };
}

export function formatHash(state: ViewState): string {
  const parts: string[] = [];
  if (state.query !== '') parts.push(`q=${encodeURIComponent(state.query)}`);
  if (state.selectedId !== null) parts.push(`note=${String(state.selectedId)}`);
  return parts.length === 0 ? '' : `#${parts.join('&')}`;
}

/** Keeps the address bar in sync without adding a history entry or firing `hashchange`. */
export function syncHash(state: ViewState): void {
  const base = location.pathname + location.search;
  const next = base + formatHash(state);
  if (base + location.hash === next) return;
  history.replaceState(history.state, '', next);
}
