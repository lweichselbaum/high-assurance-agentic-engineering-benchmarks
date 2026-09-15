/** One note on the board. Ids are integers and new notes continue the sequence. */
export interface Note {
  id: number;
  /** User rich text: the inline tags <b> <strong> <i> <em> <a href> <br>, plus newlines. */
  title: string;
  /** User rich text, same rules as the title. */
  body: string;
  /** Author avatar URL, or '' when none was given. */
  avatar: string;
  /** ISO 8601 timestamp; the feed is ordered by it, newest first. */
  createdAt: string;
}
