/** A single note on the board. Ids are integers; new notes continue the sequence. */
export interface Note {
  id: number;
  /** Rich-text source: plain text plus the inline tags the renderer allows. */
  title: string;
  /** Rich-text source. A newline counts as a line break too. */
  body: string;
  /** Author avatar URL, or '' when none was given. */
  avatar: string;
  /** ISO timestamp; the feed is ordered newest-first by this. */
  createdAt: string;
}

/** The state the URL fragment carries: `#q=<query>&note=<id>`. */
export interface FragmentState {
  query: string;
  noteId: number | null;
}
