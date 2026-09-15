/** A note on the board. Ids are integers; new notes continue the sequence. */
export interface Note {
  id: number;
  title: string;
  /** Raw source as the user typed it: text plus the inline tags listed in richtext.ts. */
  body: string;
  /** Author avatar URL, or '' when none was given. */
  avatar: string;
  /** ISO-8601 timestamp. */
  createdAt: string;
}

/** The whole of the app's state. Everything rendered is a pure function of this. */
export interface AppState {
  notes: Note[];
  query: string;
  selectedId: number | null;
}
