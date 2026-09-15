/** A note on the board. `body` is the raw text the user typed, including any inline tags. */
export interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

/** The piece of app state that lives in the URL fragment. */
export interface DeepLink {
  query: string;
  selected: number | null;
}
