/** One note on the board. `title` and `body` hold the user's markup, unrendered. */
export interface Note {
  id: number;
  title: string;
  body: string;
  /** Raw avatar URL as the author typed it; validated at render time. */
  avatar: string;
  /** ISO-8601 timestamp; the feed is ordered by it, newest first. */
  createdAt: string;
}

/** The part of the app state that lives in the URL fragment. */
export interface Route {
  query: string;
  selected: number | null;
}
