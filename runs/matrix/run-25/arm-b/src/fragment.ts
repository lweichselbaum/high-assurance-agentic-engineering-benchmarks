/**
 * Deep links. The search query and the selected note id live in the URL fragment,
 * e.g. `#q=port&note=3`, so a board view can be shared and survives a reload.
 */
import type { FragmentState } from './types';

export const EMPTY_FRAGMENT_STATE: FragmentState = { query: '', noteId: null };

function decode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

/** Reads `#q=…&note=…`; unknown keys and malformed values are ignored. */
export function parseFragment(hash: string): FragmentState {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const state: FragmentState = { ...EMPTY_FRAGMENT_STATE };
  for (const part of raw.split('&')) {
    if (part === '') continue;
    const eq = part.indexOf('=');
    const key = eq === -1 ? part : part.slice(0, eq);
    const value = eq === -1 ? '' : part.slice(eq + 1);
    if (key === 'q') {
      state.query = decode(value);
    } else if (key === 'note') {
      const id = Number(decode(value));
      state.noteId = Number.isInteger(id) ? id : null;
    }
  }
  return state;
}

/** The fragment for a state: `#q=…&note=…`, `#q=…`, `#note=…`, or '' when neither is active. */
export function formatFragment(state: FragmentState): string {
  const parts: string[] = [];
  if (state.query !== '') parts.push(`q=${encodeURIComponent(state.query)}`);
  if (state.noteId !== null) parts.push(`note=${state.noteId}`);
  return parts.length === 0 ? '' : `#${parts.join('&')}`;
}
