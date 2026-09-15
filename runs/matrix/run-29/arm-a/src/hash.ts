// The URL fragment carries the whole view state: `#q=<query>&note=<id>`.

export interface ViewState {
  query: string;
  selectedId: number | null;
}

/** Reads a fragment (with or without the leading '#') into view state. */
export function parseHash(hash: string): ViewState {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const rawNote = params.get('note') ?? '';
  const selectedId = /^\d+$/.test(rawNote) ? Number(rawNote) : null;
  return { query: params.get('q') ?? '', selectedId };
}

/**
 * Serialises view state back to a fragment, q before note as in the spec's
 * `#q=port&note=3`. Returns '' when there is nothing to remember.
 */
export function formatHash(state: ViewState): string {
  const parts: string[] = [];
  if (state.query.trim()) parts.push(`q=${encodeURIComponent(state.query)}`);
  if (state.selectedId !== null) parts.push(`note=${state.selectedId}`);
  return parts.length ? `#${parts.join('&')}` : '';
}
