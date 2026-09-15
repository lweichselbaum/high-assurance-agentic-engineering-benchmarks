export interface Note {
  id: number;
  title: string;
  /** Source text as typed, with the allowed inline tags left in. */
  body: string;
  /** Avatar URL, or '' when the author did not give one. */
  avatar: string;
  /** ISO timestamp; the feed is ordered newest-first by this. */
  createdAt: string;
}
