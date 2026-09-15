import type { View } from './types';

/**
 * The URL fragment is the app's shareable state: `#q=port&note=3`, either half optional.
 */
export function parseHash(hash: string): View {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const note = Number(params.get('note'));
  return {
    query: params.get('q') ?? '',
    selected: Number.isInteger(note) && note > 0 ? note : null,
  };
}

/** The fragment for a view, or '' when there is nothing to remember. */
export function formatHash(view: View): string {
  const parts: string[] = [];
  if (view.query) parts.push(`q=${encodeURIComponent(view.query)}`);
  if (view.selected !== null) parts.push(`note=${view.selected}`);
  return parts.length > 0 ? `#${parts.join('&')}` : '';
}

/**
 * Keeps the address bar in sync without adding a history entry per keystroke.
 * `history.replaceState` does not fire `hashchange`, so this cannot loop with the listener.
 */
export function syncHash(view: View): void {
  const hash = formatHash(view);
  if (location.hash === hash) return;
  history.replaceState(null, '', `${location.pathname}${location.search}${hash}`);
}
