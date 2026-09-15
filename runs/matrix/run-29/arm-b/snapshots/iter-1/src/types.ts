/** A note on the board. Ids are integers; new notes continue the sequence. */
export interface Note {
  id: number;
  title: string;
  body: string;
  /** Author avatar URL, or '' when none was given. */
  avatar: string;
  /** ISO 8601 timestamp. */
  createdAt: string;
}

/** The part of the app state that lives in the URL fragment. */
export interface ViewState {
  query: string;
  selectedId: number | null;
}
