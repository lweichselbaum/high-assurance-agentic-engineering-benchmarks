export interface Note {
  /** Integer id; new notes continue the sequence from the highest existing id. */
  id: number;
  /** Raw title as typed. Rendered through the rich-text allowlist. */
  title: string;
  /** Raw body as typed. Rendered through the rich-text allowlist. */
  body: string;
  /** Author avatar URL, or '' when none was given. */
  avatar: string;
  /** ISO 8601 timestamp used to order the feed newest-first. */
  createdAt: string;
}
