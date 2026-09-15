/**
 * The URL fragment holds the view state so notes are deep-linkable: `#q=port&note=3`.
 * `q` comes first when both are present. Parsing and serialising both go through
 * URLSearchParams so values round-trip exactly.
 */

export interface ViewState {
  /** The search query as typed, or ''. */
  query: string;
  /** The selected note id, or null. */
  selectedId: number | null;
}

export function readFragment(hash: string): ViewState {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const note = params.get('note');
  const id = note !== null && note.trim() !== '' ? Number(note) : Number.NaN;
  return {
    query: params.get('q') ?? '',
    selectedId: Number.isInteger(id) ? id : null,
  };
}

/** Serialise view state to a fragment body (no leading '#'); '' when there is nothing to keep. */
export function writeFragment(state: ViewState): string {
  const params = new URLSearchParams();
  if (state.query.trim() !== '') params.set('q', state.query);
  if (state.selectedId !== null) params.set('note', String(state.selectedId));
  return params.toString();
}
