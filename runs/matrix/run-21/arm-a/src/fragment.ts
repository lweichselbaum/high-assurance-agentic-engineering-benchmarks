/**
 * Deep links. The search query and the selected note live in the URL fragment
 * as `#q=<query>&note=<id>`, so a board view can be reloaded or shared.
 */

export interface FragmentState {
  query: string;
  selectedId: number | null;
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value; // malformed percent-escape: take it literally
  }
}

export function parseFragment(hash: string): FragmentState {
  const state: FragmentState = { query: '', selectedId: null };
  const raw = hash.replace(/^#/, '');
  if (!raw) return state;

  for (const part of raw.split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    const key = decode(eq === -1 ? part : part.slice(0, eq));
    const value = eq === -1 ? '' : decode(part.slice(eq + 1));
    if (key === 'q') {
      state.query = value;
    } else if (key === 'note') {
      const id = Number.parseInt(value, 10);
      state.selectedId = Number.isFinite(id) ? id : null;
    }
  }
  return state;
}

/** `#q=port&note=3`, omitting whichever half is inactive. */
export function buildFragment(state: FragmentState): string {
  const parts: string[] = [];
  if (state.query.trim()) parts.push(`q=${encodeURIComponent(state.query)}`);
  if (state.selectedId !== null) parts.push(`note=${state.selectedId}`);
  return parts.length ? `#${parts.join('&')}` : '';
}

/**
 * Keep the address bar in sync without pushing a history entry per keystroke.
 * Returns true if the fragment changed.
 */
export function writeFragment(state: FragmentState): boolean {
  const next = buildFragment(state);
  if (next === window.location.hash) return false;
  const url = next || window.location.pathname + window.location.search;
  window.history.replaceState(null, '', url);
  return true;
}
