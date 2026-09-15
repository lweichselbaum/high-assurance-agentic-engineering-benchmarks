import './style.css';
import type { Note } from './types';
import { loadNotes, saveNotes } from './storage';
import { buildHash, parseHash } from './hash';
import { renderBody, renderTitle, safeImageUrl, toPlainText } from './richtext';

const form = document.getElementById('note-form') as HTMLFormElement;
const titleInput = document.getElementById('title') as HTMLInputElement;
const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
const avatarInput = document.getElementById('avatar') as HTMLInputElement;
const formError = document.getElementById('form-error') as HTMLParagraphElement;
const searchInput = document.getElementById('search') as HTMLInputElement;
const resultsLine = document.getElementById('results-line') as HTMLParagraphElement;
const feed = document.getElementById('feed') as HTMLElement;

let notes: Note[] = loadNotes();
let query = '';
let selectedId: number | null = null;

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function newestFirst(a: Note, b: Note): number {
  const byDate = Date.parse(b.createdAt) - Date.parse(a.createdAt);
  if (Number.isFinite(byDate) && byDate !== 0) return byDate;
  return b.id - a.id;
}

function matches(note: Note, needle: string): boolean {
  const haystack = `${toPlainText(note.title)} ${toPlainText(note.body)}`.toLowerCase();
  return haystack.includes(needle);
}

function visibleNotes(): Note[] {
  const needle = query.trim().toLowerCase();
  const found = needle ? notes.filter((note) => matches(note, needle)) : notes.slice();
  return found.sort(newestFirst);
}

function renderNote(note: Note): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.dataset.noteId = String(note.id);
  article.setAttribute('aria-labelledby', `note-heading-${note.id}`);
  if (note.id === selectedId) article.setAttribute('aria-current', 'true');

  const head = document.createElement('div');
  head.className = 'note-head';

  const avatar = note.avatar ? safeImageUrl(note.avatar) : null;
  if (avatar) {
    const img = document.createElement('img');
    img.className = 'note-avatar';
    img.src = avatar;
    img.alt = '';
    img.width = 40;
    img.height = 40;
    img.loading = 'lazy';
    head.append(img);
  }

  const heading = document.createElement('h2');
  heading.className = 'note-heading';
  heading.id = `note-heading-${note.id}`;

  // The title is the select control, so it is a real button: clickable, focusable
  // and reachable from the keyboard.
  const title = document.createElement('button');
  title.type = 'button';
  title.className = 'note-title';
  title.innerHTML = renderTitle(note.title);
  heading.append(title);
  head.append(heading);
  article.append(head);

  const body = document.createElement('div');
  body.className = 'note-body';
  body.innerHTML = renderBody(note.body);
  article.append(body);

  const stamp = Date.parse(note.createdAt);
  if (Number.isFinite(stamp)) {
    const time = document.createElement('time');
    time.className = 'note-date';
    time.dateTime = note.createdAt;
    time.textContent = dateFormat.format(new Date(stamp));
    article.append(time);
  }

  return article;
}

function render(): void {
  const shown = visibleNotes();

  resultsLine.textContent = query ? `results for "${query}"` : '';

  feed.textContent = '';
  if (shown.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = query ? 'No notes match that search.' : 'No notes yet. Add the first one.';
    feed.append(empty);
    return;
  }
  for (const note of shown) feed.append(renderNote(note));
}

function syncHash(): void {
  const next = buildHash({ query, selectedId });
  const current = location.hash;
  if (next === current || (next === '' && current === '')) return;
  const url = next || location.pathname + location.search;
  history.replaceState(null, '', url);
}

function applyHash(): void {
  const link = parseHash(location.hash);
  query = link.query;
  selectedId = link.selectedId;
  searchInput.value = query;
  render();
}

function nextId(): number {
  return notes.reduce((max, note) => Math.max(max, note.id), 0) + 1;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  const avatar = avatarInput.value.trim();

  if (!title && !body) {
    formError.textContent = 'Give the note a title or a body.';
    titleInput.focus();
    return;
  }
  formError.textContent = '';

  notes.push({ id: nextId(), title, body, avatar, createdAt: new Date().toISOString() });
  saveNotes(notes);

  form.reset();
  render();
  titleInput.focus();
});

searchInput.addEventListener('input', () => {
  query = searchInput.value;
  syncHash();
  render();
});

feed.addEventListener('click', (event) => {
  const target = event.target as Element | null;
  const title = target?.closest?.('.note-title');
  if (!title) return;
  const article = title.closest('.note') as HTMLElement | null;
  const id = Number.parseInt(article?.dataset.noteId ?? '', 10);
  if (!Number.isFinite(id)) return;
  selectedId = id;
  syncHash();
  render();
  // render() replaced the button that was just clicked; keep the focus on it.
  feed.querySelector<HTMLButtonElement>(`.note[data-note-id="${id}"] .note-title`)?.focus();
});

window.addEventListener('hashchange', applyHash);

applyHash();
