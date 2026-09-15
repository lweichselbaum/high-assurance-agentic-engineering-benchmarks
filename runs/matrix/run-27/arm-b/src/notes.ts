/** The note model: ordering, ids, timestamps and search. */
import type { Note } from './types';

/** Newest first, with the id as a stable tie-breaker for notes added in the same millisecond. */
export function newestFirst(notes: readonly Note[]): Note[] {
  return [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
}

/** Ids are integers and new notes continue the sequence. */
export function nextId(notes: readonly Note[]): number {
  return notes.reduce((max, note) => Math.max(max, note.id), 0) + 1;
}

/**
 * A new note must sort to the top even if the device clock lags behind the newest note
 * on the board (a shared board is written by several clocks).
 */
export function nextTimestamp(notes: readonly Note[]): string {
  const newest = notes.reduce((max, note) => {
    const at = Date.parse(note.createdAt);
    return Number.isNaN(at) ? max : Math.max(max, at);
  }, 0);
  return new Date(Math.max(Date.now(), newest + 1)).toISOString();
}

/** Case-insensitive match on the title or the body, as the author typed them. */
export function matches(note: Note, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === '') return true;
  return note.title.toLowerCase().includes(needle) || note.body.toLowerCase().includes(needle);
}

export function filterNotes(notes: readonly Note[], query: string): Note[] {
  return newestFirst(notes).filter((note) => matches(note, query));
}
