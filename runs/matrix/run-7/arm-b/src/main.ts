import './style.css';
import { setLocationHref } from 'safevalues/dom';
import type { Note } from './types';
import { loadNotes, saveNotes, nextId } from './storage';
import { parseHash, serializeHash } from './hash';
import { renderRichBody, stripTags, isSafeAvatarUrl } from './content';

function requireElement<T extends Element>(id: string): T {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`missing #${id}`);
  return el as unknown as T;
}

const noteForm = requireElement<HTMLFormElement>('note-form');
const titleInput = requireElement<HTMLInputElement>('title');
const bodyInput = requireElement<HTMLTextAreaElement>('body');
const avatarInput = requireElement<HTMLInputElement>('avatar');
const searchInput = requireElement<HTMLInputElement>('search');
const resultsLine = requireElement<HTMLParagraphElement>('results-line');
const feed = requireElement<HTMLElement>('feed');

let notes: Note[] = loadNotes();
let query = '';
let selectedId: number | null = null;

function matchesQuery(note: Note, needle: string): boolean {
  const haystack = `${note.title} ${stripTags(note.body)}`.toLowerCase();
  return haystack.includes(needle);
}

function renderResultsLine(): void {
  resultsLine.textContent = query === '' ? '' : `results for "${query}"`;
}

function renderNoteArticle(note: Note): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.dataset.noteId = String(note.id);
  if (note.id === selectedId) article.setAttribute('aria-current', 'true');

  if (isSafeAvatarUrl(note.avatar)) {
    const img = document.createElement('img');
    img.className = 'note-avatar';
    img.alt = '';
    img.src = note.avatar;
    article.appendChild(img);
  }

  const titleButton = document.createElement('button');
  titleButton.type = 'button';
  titleButton.className = 'note-title';
  titleButton.textContent = note.title;
  titleButton.addEventListener('click', () => selectNote(note.id));
  article.appendChild(titleButton);

  const bodyEl = document.createElement('div');
  bodyEl.className = 'note-body';
  renderRichBody(bodyEl, note.body);
  article.appendChild(bodyEl);

  return article;
}

function renderFeed(): void {
  feed.textContent = '';
  const needle = query.toLowerCase();
  const filtered = needle === '' ? notes : notes.filter((note) => matchesQuery(note, needle));
  const sorted = [...filtered].sort((a, b) => b.id - a.id);
  for (const note of sorted) {
    feed.appendChild(renderNoteArticle(note));
  }
}

function syncHash(): void {
  const next = serializeHash({ q: query, note: selectedId });
  const current = window.location.hash === '' ? '#' : window.location.hash;
  if (current !== next) setLocationHref(window.location, next);
}

function selectNote(id: number): void {
  selectedId = id;
  renderFeed();
  syncHash();
}

function applyHash(): void {
  const state = parseHash(window.location.hash);
  query = state.q;
  selectedId = state.note;
  searchInput.value = query;
  renderResultsLine();
  renderFeed();
}

noteForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value;
  const avatar = avatarInput.value.trim();
  if (title === '' || body.trim() === '') return;

  const note: Note = { id: nextId(notes), title, body, avatar, createdAt: new Date().toISOString() };
  notes = [...notes, note];
  saveNotes(notes);
  noteForm.reset();
  renderFeed();
});

searchInput.addEventListener('input', () => {
  query = searchInput.value;
  renderResultsLine();
  renderFeed();
  syncHash();
});

window.addEventListener('hashchange', applyHash);

applyHash();
