import { UrlState } from './types';

/**
 * Parses the current URL fragment into search query and selected note ID.
 */
export function parseFragment(hashString: string): UrlState {
  const hash = hashString.startsWith('#') ? hashString.slice(1) : hashString;
  if (!hash) {
    return { query: '', noteId: null };
  }

  const params = new URLSearchParams(hash);
  const q = params.get('q') ?? '';
  const noteParam = params.get('note');

  let noteId: number | null = null;
  if (noteParam !== null && noteParam !== '') {
    const parsed = parseInt(noteParam, 10);
    if (!isNaN(parsed)) {
      noteId = parsed;
    }
  }

  return { query: q, noteId };
}

/**
 * Serializes state into a fragment string.
 */
export function formatFragment(state: UrlState): string {
  const params: string[] = [];

  if (state.query && state.query.trim()) {
    params.push(`q=${encodeURIComponent(state.query.trim())}`);
  }

  if (state.noteId !== null) {
    params.push(`note=${state.noteId}`);
  }

  return params.length > 0 ? `#${params.join('&')}` : '';
}

/**
 * Synchronizes the URL fragment without adding unwanted history spam during fast typing.
 */
export function syncUrlFragment(state: UrlState): void {
  const newFragment = formatFragment(state);
  const currentHash = window.location.hash;

  if (currentHash !== newFragment) {
    if (newFragment === '') {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    } else {
      history.replaceState(null, '', newFragment);
    }
  }
}
