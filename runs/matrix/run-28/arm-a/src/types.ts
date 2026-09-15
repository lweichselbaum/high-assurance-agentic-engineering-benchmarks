export interface Note {
  /** Integer id; new notes continue the sequence. */
  id: number;
  /** Raw source as the user typed it, with inline formatting tags. */
  title: string;
  /** Raw source as the user typed it, with inline formatting tags. */
  body: string;
  /** Author avatar URL, or '' when none was given. */
  avatar: string;
  /** ISO-8601 timestamp. */
  createdAt: string;
}
