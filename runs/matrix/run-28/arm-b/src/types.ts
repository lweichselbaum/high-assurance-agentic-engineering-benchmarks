/** One note on the board. `body` is the user's rich-text source, not rendered markup. */
export interface Note {
  id: number;
  title: string;
  /** Rich-text source: plain text plus the inline tags the app renders (<b>, <i>, <a>, <br>). */
  body: string;
  /** Author avatar URL, or '' for none. Validated at render time, never trusted. */
  avatar: string;
  /** ISO-8601 timestamp. Notes are shown newest-first. */
  createdAt: string;
}

/** The part of the app state that lives in the URL fragment. */
export interface ViewState {
  query: string;
  selectedId: number | null;
}
