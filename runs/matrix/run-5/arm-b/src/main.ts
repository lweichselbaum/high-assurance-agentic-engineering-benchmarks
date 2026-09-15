import type { Note } from './types';
import { loadNotes, saveNotes, nextNoteId } from './storage';
import { renderRichText, isSafeAvatarUrl } from './richtext';
import { parseUrlState, writeUrlState, type UrlState } from './url-state';

function required<T extends Element>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as unknown as T;
}

const form = required<HTMLFormElement>('note-form');
const titleInput = required<HTMLInputElement>('title');
const bodyInput = required<HTMLTextAreaElement>('body');
const avatarInput = required<HTMLInputElement>('avatar');
const searchInput = required<HTMLInputElement>('search');
const resultsLine = required<HTMLParagraphElement>('results-line');
const feed = required<HTMLElement>('feed');

let notes: Note[] = loadNotes();
let state: UrlState = parseUrlState(location.hash);
searchInput.value = state.query;

function matchesQuery(note: Note, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return note.title.toLowerCase().includes(q) || note.body.toLowerCase().includes(q);
}

function renderNote(note: Note): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.dataset.noteId = String(note.id);
  if (state.noteId === note.id) article.setAttribute('aria-current', 'true');

  if (note.avatar && isSafeAvatarUrl(note.avatar)) {
    const img = document.createElement('img');
    img.className = 'note-avatar';
    img.alt = '';
    img.src = note.avatar;
    article.appendChild(img);
  }

  const titleButton = document.createElement('button');
  titleButton.type = 'button';
  titleButton.className = 'note-title';
  renderRichText(titleButton, note.title);
  titleButton.addEventListener('click', () => selectNote(note.id));
  article.appendChild(titleButton);

  const body = document.createElement('div');
  body.className = 'note-body';
  renderRichText(body, note.body);
  article.appendChild(body);

  return article;
}

function render(): void {
  resultsLine.textContent = state.query ? `results for "${state.query}"` : '';

  const visible = notes.filter((note) => matchesQuery(note, state.query)).sort((a, b) => b.id - a.id);

  feed.replaceChildren();
  for (const note of visible) feed.appendChild(renderNote(note));
}

function selectNote(id: number): void {
  state = { ...state, noteId: id };
  writeUrlState(state);
  render();
}

searchInput.addEventListener('input', () => {
  state = { ...state, query: searchInput.value };
  writeUrlState(state);
  render();
});

window.addEventListener('hashchange', () => {
  state = parseUrlState(location.hash);
  searchInput.value = state.query;
  render();
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  const avatar = avatarInput.value.trim();
  if (!title || !body) return;

  const note: Note = {
    id: nextNoteId(notes),
    title,
    body,
    avatar,
    createdAt: new Date().toISOString(),
  };
  notes = [...notes, note];
  saveNotes(notes);
  form.reset();
  render();
});

render();
