import './style.css';
import { formatFragment, parseFragment } from './fragment';
import { renderRichText, richTextToPlain, safeImageUrl } from './richtext';
import { loadNotes, nextNoteId, saveNotes } from './storage';
import type { Note } from './types';

const form = document.querySelector<HTMLFormElement>('#note-form')!;
const titleInput = document.querySelector<HTMLInputElement>('#title')!;
const bodyInput = document.querySelector<HTMLTextAreaElement>('#body')!;
const avatarInput = document.querySelector<HTMLInputElement>('#avatar')!;
const searchInput = document.querySelector<HTMLInputElement>('#search')!;
const resultsLine = document.querySelector<HTMLParagraphElement>('#results-line')!;
const feed = document.querySelector<HTMLElement>('#feed')!;

let notes: Note[] = loadNotes();
let query = '';
let selectedId: number | null = null;

/** Searchable text per note, rebuilt only when a note is added. */
const searchIndex = new Map<number, string>();

function indexNote(note: Note): void {
  const text = `${richTextToPlain(note.title)} ${richTextToPlain(note.body)}`;
  searchIndex.set(note.id, text.toLowerCase());
}

function newestFirst(a: Note, b: Note): number {
  const byDate = Date.parse(b.createdAt) - Date.parse(a.createdAt);
  return byDate !== 0 && !Number.isNaN(byDate) ? byDate : b.id - a.id;
}

function matchingNotes(): Note[] {
  const needle = query.trim().toLowerCase();
  const visible =
    needle === '' ? notes : notes.filter((note) => (searchIndex.get(note.id) ?? '').includes(needle));
  return [...visible].sort(newestFirst);
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function noteElement(note: Note): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.dataset.noteId = String(note.id);
  if (note.id === selectedId) article.setAttribute('aria-current', 'true');

  const header = document.createElement('header');
  header.className = 'note-header';

  const avatar = safeImageUrl(note.avatar);
  if (avatar !== null) {
    const img = document.createElement('img');
    img.className = 'note-avatar';
    img.src = avatar;
    img.alt = '';
    img.width = 40;
    img.height = 40;
    img.loading = 'lazy';
    header.append(img);
  }

  // The title itself is the control that selects the note, so that a click and
  // a keyboard activation hit exactly the same target.
  const heading = document.createElement('h2');
  heading.className = 'note-heading';
  const titleButton = document.createElement('button');
  titleButton.type = 'button';
  titleButton.className = 'note-title';
  titleButton.innerHTML = renderRichText(note.title);
  titleButton.addEventListener('click', () => selectNote(note.id));
  heading.append(titleButton);
  header.append(heading);

  const body = document.createElement('div');
  body.className = 'note-body';
  body.innerHTML = renderRichText(note.body);

  const time = document.createElement('time');
  time.className = 'note-date';
  time.dateTime = note.createdAt;
  time.textContent = formatDate(note.createdAt);

  article.append(header, body, time);
  return article;
}

function renderFeed(): void {
  const visible = matchingNotes();
  feed.replaceChildren(...visible.map(noteElement));

  if (visible.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent =
      query.trim() === '' ? 'No notes yet — add the first one.' : 'No notes match your search.';
    feed.append(empty);
  }
}

function renderResultsLine(): void {
  resultsLine.textContent = query === '' ? '' : `results for "${query}"`;
}

function syncFragment(replace: boolean): void {
  const fragment = formatFragment({ query, selectedId });
  const url = `${location.pathname}${location.search}${fragment}`;
  if (url === `${location.pathname}${location.search}${location.hash}`) return;
  if (replace) history.replaceState(null, '', url);
  else history.pushState(null, '', url);
}

function render(): void {
  renderResultsLine();
  renderFeed();
}

function selectNote(id: number): void {
  selectedId = id;
  syncFragment(false);
  render();
}

function setQuery(next: string, replaceFragment: boolean): void {
  query = next;
  if (searchInput.value !== next) searchInput.value = next;
  syncFragment(replaceFragment);
  render();
}

function addNote(): void {
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  if (title === '' && body === '') return;

  const note: Note = {
    id: nextNoteId(notes),
    title,
    body,
    avatar: avatarInput.value.trim(),
    createdAt: new Date().toISOString(),
  };
  notes = [...notes, note];
  indexNote(note);
  saveNotes(notes);
  form.reset();
  titleInput.focus();
  render();
}

function applyFragment(): void {
  const state = parseFragment(location.hash);
  query = state.query;
  searchInput.value = state.query;
  // Only select an id that exists, so a stale deep link degrades to no selection.
  selectedId = notes.some((note) => note.id === state.selectedId) ? state.selectedId : null;
  render();
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  addNote();
});

searchInput.addEventListener('input', () => {
  // Typing rewrites the current entry rather than pushing a history step each
  // keystroke; selecting a note is what creates a new one.
  setQuery(searchInput.value, true);
});

window.addEventListener('hashchange', applyFragment);
window.addEventListener('popstate', applyFragment);

for (const note of notes) indexNote(note);
saveNotes(notes);
applyFragment();
