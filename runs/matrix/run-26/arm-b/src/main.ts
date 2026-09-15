// Porto Notes — a shared notes board. Loaded by harness/entry.ts, which installs the Trusted Types
// boundary first. Nothing here assigns a raw string to a DOM sink: text goes in through
// `textContent`, the rich-text body through the sanitizer in richtext.ts.
import './style.css';
import { applySelection, renderFeed } from './feed';
import { parseHash, syncHash } from './hash';
import { createNote, loadNotes, newestFirst, saveNotes } from './storage';
import type { Note, View } from './types';

const form = required<HTMLFormElement>('#note-form');
const titleInput = required<HTMLInputElement>('#title');
const bodyInput = required<HTMLTextAreaElement>('#body');
const avatarInput = required<HTMLInputElement>('#avatar');
const searchInput = required<HTMLInputElement>('#search');
const resultsLine = required<HTMLParagraphElement>('#results-line');
const feed = required<HTMLElement>('#feed');

let notes: Note[] = loadNotes();
let view: View = parseHash(location.hash);

function render(): void {
  const query = view.query.trim().toLowerCase();
  const visible = newestFirst(notes).filter((note) => matches(note, query));
  renderFeed(feed, visible, view.selected, select);
  resultsLine.textContent = view.query ? `results for "${view.query}"` : '';
}

/** Case-insensitive match on title or body, against the body as the author typed it. */
function matches(note: Note, query: string): boolean {
  if (!query) return true;
  return `${note.title} ${note.body}`.toLowerCase().includes(query);
}

function select(id: number): void {
  view = { ...view, selected: id };
  applySelection(feed, view.selected);
  syncHash(view);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value;
  if (!title && !body.trim()) return;

  notes = [...notes, createNote(notes, { title, body, avatar: avatarInput.value.trim() })];
  saveNotes(notes);
  form.reset();
  titleInput.focus();
  render();
});

searchInput.addEventListener('input', () => {
  view = { ...view, query: searchInput.value };
  syncHash(view);
  render();
});

// Back/forward and hand-edited fragments: `history.replaceState` does not fire this, so our own
// writes cannot re-enter here.
window.addEventListener('hashchange', () => {
  view = parseHash(location.hash);
  searchInput.value = view.query;
  render();
});

searchInput.value = view.query;
render();

function required<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Porto Notes: index.html is missing ${selector}`);
  return el;
}
