import './style.css';
import type { Note } from './types';
import { loadNotes, saveNotes } from './storage';
import { plainText, renderRichText, safeImageUrl } from './richtext';
import { readFragment, writeFragment, type ViewState } from './fragment';

function need<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Porto Notes: missing element ${selector}`);
  return element;
}

const form = need<HTMLFormElement>('#note-form');
const titleInput = need<HTMLInputElement>('#title');
const bodyInput = need<HTMLTextAreaElement>('#body');
const avatarInput = need<HTMLInputElement>('#avatar');
const formError = need<HTMLParagraphElement>('#form-error');
const searchInput = need<HTMLInputElement>('#search');
const resultsLine = need<HTMLParagraphElement>('#results-line');
const feed = need<HTMLElement>('#feed');

let notes: Note[] = loadNotes();
let view: ViewState = { query: '', selectedId: null };

const timestampFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** Newest first; ids break ties so notes added in the same millisecond stay ordered. */
function feedOrder(a: Note, b: Note): number {
  const byDate = Date.parse(b.createdAt) - Date.parse(a.createdAt);
  if (byDate !== 0 && Number.isFinite(byDate)) return byDate;
  return b.id - a.id;
}

/** Case-insensitive match on the visible text of the title or body. */
function matches(note: Note, needle: string): boolean {
  const haystack = `${plainText(note.title)} ${plainText(note.body)}`.toLowerCase();
  return haystack.includes(needle);
}

function visibleNotes(): Note[] {
  const needle = view.query.trim().toLowerCase();
  const filtered = needle === '' ? notes.slice() : notes.filter((note) => matches(note, needle));
  return filtered.sort(feedOrder);
}

function noteElement(note: Note): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.dataset.noteId = String(note.id);

  const head = document.createElement('div');
  head.className = 'note-head';

  const avatar = safeImageUrl(note.avatar);
  if (avatar) {
    const image = document.createElement('img');
    image.className = 'note-avatar';
    image.src = avatar;
    // Decorative: the avatar carries no information the note text does not already give.
    image.alt = '';
    image.width = 40;
    image.height = 40;
    image.loading = 'lazy';
    // A URL that does not resolve should leave no broken-image artefact behind.
    image.addEventListener('error', () => image.remove(), { once: true });
    head.append(image);
  }

  const heading = document.createElement('h3');
  heading.className = 'note-heading';
  const titleButton = document.createElement('button');
  titleButton.type = 'button';
  titleButton.className = 'note-title';
  // Allowlisted markup built by renderRichText; links are left out because the title is a button.
  titleButton.innerHTML = renderRichText(note.title, { links: false });
  // A button with no text has no accessible name, so a body-only note still gets a label.
  if (titleButton.textContent?.trim() === '') titleButton.textContent = 'Untitled note';
  heading.append(titleButton);
  head.append(heading);

  const body = document.createElement('div');
  body.className = 'note-body';
  body.innerHTML = renderRichText(note.body, { links: true, newlines: true });

  const time = document.createElement('time');
  time.className = 'note-time';
  const parsed = Date.parse(note.createdAt);
  if (!Number.isNaN(parsed)) {
    time.dateTime = new Date(parsed).toISOString();
    time.textContent = timestampFormat.format(parsed);
  }

  article.append(head, body, time);
  return article;
}

function emptyMessage(): HTMLElement {
  const message = document.createElement('p');
  message.className = 'feed-empty';
  message.textContent =
    view.query.trim() === ''
      ? 'No notes yet. Add the first one above.'
      : `No notes match "${view.query}".`;
  return message;
}

/** Mark the selected note, leaving the rest of the feed untouched. */
function applySelection(): void {
  for (const article of feed.querySelectorAll<HTMLElement>('article.note')) {
    const selected = Number(article.dataset.noteId) === view.selectedId;
    if (selected) article.setAttribute('aria-current', 'true');
    else article.removeAttribute('aria-current');
  }
}

function renderResultsLine(): void {
  resultsLine.textContent = view.query.trim() === '' ? '' : `results for "${view.query}"`;
}

function renderFeed(): void {
  const shown = visibleNotes();
  feed.replaceChildren(...(shown.length ? shown.map(noteElement) : [emptyMessage()]));
  applySelection();
}

function render(): void {
  renderResultsLine();
  renderFeed();
}

/**
 * Keep the fragment in step with the view state. replaceState avoids a history entry per
 * keystroke and does not fire hashchange, so this cannot loop with the hashchange handler.
 */
function syncFragment(): void {
  const fragment = writeFragment(view);
  const url = location.pathname + location.search + (fragment ? `#${fragment}` : '');
  if (url !== location.pathname + location.search + location.hash) {
    history.replaceState(history.state, '', url);
  }
}

function nextId(): number {
  return notes.reduce((highest, note) => Math.max(highest, note.id), 0) + 1;
}

function showFormError(message: string): void {
  formError.textContent = message;
  formError.hidden = message === '';
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  if (title === '' && body === '') {
    showFormError('Give the note a title or a body.');
    titleInput.focus();
    return;
  }

  showFormError('');
  notes.push({
    id: nextId(),
    title,
    body,
    avatar: avatarInput.value.trim(),
    createdAt: new Date().toISOString(),
  });
  saveNotes(notes);

  form.reset();
  render();
  titleInput.focus();
});

searchInput.addEventListener('input', () => {
  view = { ...view, query: searchInput.value };
  syncFragment();
  render();
});

feed.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const title = target.closest('.note-title');
  if (!title) return;
  const article = title.closest<HTMLElement>('article.note');
  if (!article) return;
  const id = Number(article.dataset.noteId);
  if (!Number.isInteger(id)) return;

  view = { ...view, selectedId: id };
  syncFragment();
  applySelection();
});

/** Adopt the state in the fragment: on load, and whenever it changes outside our own writes. */
function adoptFragment(): void {
  view = readFragment(location.hash);
  searchInput.value = view.query;
  render();
}

window.addEventListener('hashchange', adoptFragment);

adoptFragment();
// Normalise the fragment we were given (e.g. `#note=3&q=x`) to the canonical order.
syncFragment();

if (view.selectedId !== null) {
  feed
    .querySelector(`article.note[data-note-id="${CSS.escape(String(view.selectedId))}"]`)
    ?.scrollIntoView({ block: 'nearest' });
}
