/** One note on the board. `body` holds the user's rich text as they typed it. */
export interface Note {
  id: number;
  title: string;
  body: string;
  /** Author avatar URL, or '' when none was given. */
  avatar: string;
  /** ISO-8601 timestamp; the feed is ordered newest-first by this. */
  createdAt: string;
}

/** What the URL fragment carries: the active search query and the selected note. */
export interface View {
  query: string;
  selected: number | null;
}
