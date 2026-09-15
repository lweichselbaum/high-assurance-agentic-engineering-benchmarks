import { Note } from './types';
import seedData from './fixtures.json';

const STORAGE_KEY = 'porto_notes';

/**
 * Loads notes from localStorage. If no saved notes exist, seeds with fixtures.
 */
export function getStoredNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (error) {
    console.error('Failed to load notes from localStorage:', error);
  }

  // Seed with initial fixtures
  const initial = seedData as Note[];
  saveStoredNotes(initial);
  return [...initial];
}

/**
 * Saves notes to localStorage.
 */
export function saveStoredNotes(notes: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch (error) {
    console.error('Failed to save notes to localStorage:', error);
  }
}

/**
 * Sorts notes in newest-first order based on createdAt (and ID as tiebreaker).
 */
export function sortNotesNewestFirst(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (timeA !== timeB) {
      return timeB - timeA;
    }
    return b.id - a.id;
  });
}

/**
 * Adds a new note and continues the integer ID sequence.
 */
export function addNote(noteData: { title: string; body: string; avatar?: string }): Note {
  const currentNotes = getStoredNotes();
  const nextId = currentNotes.reduce((maxId, item) => Math.max(maxId, Number(item.id) || 0), 0) + 1;

  const newNote: Note = {
    id: nextId,
    title: noteData.title,
    body: noteData.body,
    avatar: noteData.avatar && noteData.avatar.trim() ? noteData.avatar.trim() : '',
    createdAt: new Date().toISOString(),
  };

  const updatedNotes = [newNote, ...currentNotes];
  saveStoredNotes(updatedNotes);
  return newNote;
}
