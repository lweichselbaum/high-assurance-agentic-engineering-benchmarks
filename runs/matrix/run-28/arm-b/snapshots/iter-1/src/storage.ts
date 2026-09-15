import seedFixtures from './fixtures.json';
import type { Note } from './types';

const STORAGE_KEY = 'porto-notes.v1';

/**
 * Anything that comes back out of localStorage is untrusted input: another script on the origin,
 * an older version of this app, or the user's devtools could have written it. Notes that do not
 * have the shape we expect are dropped rather than fixed up.
 */
function isNote(value: unknown): value is Note {
  if (typeof value !== 'object' || value === null) return false;
  const n = value as Partial<Record<keyof Note, unknown>>;
  return (
    typeof n.id === 'number' &&
    Number.isInteger(n.id) &&
    typeof n.title === 'string' &&
    typeof n.body === 'string' &&
    typeof n.avatar === 'string' &&
    typeof n.createdAt === 'string'
  );
}

function seed(): Note[] {
  return seedFixtures.map((f) => ({
    id: f.id,
    title: f.title,
    body: f.body,
    avatar: f.avatar,
    createdAt: f.createdAt,
  }));
}

/** The saved notes, or a freshly seeded board on first load. */
export function loadNotes(): Note[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode, blocked cookies). The board still works, in memory.
    return seed();
  }
  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter(isNote);
    } catch {
      // Corrupt payload — fall through and start from the seed rather than showing an empty board.
    }
  }
  const seeded = seed();
  saveNotes(seeded);
  return seeded;
}

export function saveNotes(notes: readonly Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // Quota or unavailable storage: losing persistence must not lose the note the user just typed.
  }
}
