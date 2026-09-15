/** A single note on the board. Ids are integers; new notes continue the sequence. */
export interface Note {
  id: number;
  title: string;
  body: string;
  /** Author avatar URL as the user typed it. Validated at render time, never trusted as stored. */
  avatar: string;
  /** ISO timestamp; the feed is ordered newest-first by this. */
  createdAt: string;
}
