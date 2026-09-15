/**
 * The URL fragment holds the search query and the selected note: `#q=port&note=3`.
 * `history.replaceState` writes it, so the app never assigns to `location` (see eslint.config.js).
 */
import type { DeepLink } from './types';

const NOTE_ID_RE = /^\d+$/;

export function parseFragment(hash: string): DeepLink {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);
  const note = params.get('note');
  return {
    query: params.get('q') ?? '',
    selected: note !== null && NOTE_ID_RE.test(note) ? Number(note) : null,
  };
}

/** The canonical fragment for a state: `q` first, `note` second, empty when neither is set. */
export function formatFragment(state: DeepLink): string {
  const parts: string[] = [];
  if (state.query !== '') parts.push(`q=${encodeURIComponent(state.query)}`);
  if (state.selected !== null) parts.push(`note=${String(state.selected)}`);
  return parts.length === 0 ? '' : `#${parts.join('&')}`;
}

/** Keeps the address bar in sync without adding a history entry per keystroke. */
export function syncFragment(state: DeepLink): void {
  const fragment = formatFragment(state);
  if (fragment === window.location.hash) return;
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${fragment}`);
}
