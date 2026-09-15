/**
 * Porto Notes — a shared notes board.
 *
 * State lives in three places: the notes themselves in localStorage, the
 * current query and selection in the URL fragment, and the rendered feed in
 * the DOM. Everything user-supplied reaches the page as DOM nodes built here
 * (see richtext.ts) rather than as markup.
 */
import './style.css';
import { parseFragment, writeFragment, type FragmentState } from './fragment';
import { renderRichText, richTextToPlainText } from './richtext';
import {
  loadNotes,
  nextCreatedAt,
  nextId,
  saveNotes,
  sortNewestFirst,
  type Note,
} from './storage';
import { safeImageSrc, safeLinkHref } from './urls';

function must<E extends Element>(selector: string): E {
  const element = document.querySelector<E>(selector);
  if (!element) throw new Error(`Porto Notes: missing element ${selector}`);
  return element;
}

const form = must<HTMLFormElement>('#note-form');
const titleInput = must<HTMLInputElement>('#title');
const bodyInput = must<HTMLTextAreaElement>('#body');
const avatarInput = must<HTMLInputElement>('#avatar');
const searchInput = must<HTMLInputElement>('#search');
const resultsLine = must<HTMLParagraphElement>('#results-line');
const feed = must<HTMLElement>('#feed');

let notes: Note[] = loadNotes();
const state: FragmentState = { query: '', selectedId: null };

const dateFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** Search matches the rendered words, not the markup around them. */
function searchText(note: Note): string {
  return `${richTextToPlainText(note.title)}\n${richTextToPlainText(note.body)}`.toLowerCase();
}

/**
 * The feed contents: matches for the current query, newest first. The selected
 * note is kept even when it does not match, so a deep link like
 * `#q=port&note=3` still shows the note it points at.
 */
function visibleNotes(): Note[] {
  const query = state.query.trim().toLowerCase();
  const ordered = sortNewestFirst(notes);
  if (!query) return ordered;
  return ordered.filter(
    (note) => note.id === state.selectedId || searchText(note).includes(query),
  );
}

function buildAvatar(note: Note): HTMLImageElement | null {
  const src = note.avatar.trim() ? safeImageSrc(note.avatar.trim()) : null;
  if (!src) return null;
  const img = document.createElement('img');
  img.className = 'note-avatar';
  img.setAttribute('src', src);
  img.alt = ''; // decorative: the note carries no author name to announce
  img.width = 40;
  img.height = 40;
  img.loading = 'lazy';
  img.referrerPolicy = 'no-referrer';
  // A dead URL should not leave a broken-image icon in the feed.
  img.addEventListener('error', () => img.classList.add('is-broken'));
  return img;
}

function buildNote(note: Note): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.dataset.noteId = String(note.id);
  article.setAttribute('aria-labelledby', `note-title-${note.id}`);

  const header = document.createElement('div');
  header.className = 'note-header';

  const avatar = buildAvatar(note);
  if (avatar) header.appendChild(avatar);

  const heading = document.createElement('h2');
  heading.className = 'note-heading';

  // The title is the select control, so links inside it are rendered as plain
  // words — an anchor inside a button would be neither valid nor operable.
  const title = document.createElement('button');
  title.type = 'button';
  title.className = 'note-title';
  title.id = `note-title-${note.id}`;
  title.appendChild(renderRichText(note.title, { allowLinks: false }));
  heading.appendChild(title);
  header.appendChild(heading);

  const time = document.createElement('time');
  time.className = 'note-date';
  const created = Date.parse(note.createdAt);
  if (Number.isFinite(created)) {
    time.dateTime = new Date(created).toISOString();
    time.textContent = dateFormat.format(created);
  }
  header.appendChild(time);

  article.appendChild(header);

  const body = document.createElement('div');
  body.className = 'note-body';
  body.appendChild(renderRichText(note.body, { sanitizeHref: safeLinkHref }));
  article.appendChild(body);

  return article;
}

function applySelection(): void {
  for (const article of feed.querySelectorAll<HTMLElement>('article.note')) {
    const selected = Number(article.dataset.noteId) === state.selectedId;
    article.classList.toggle('is-selected', selected);
    if (selected) article.setAttribute('aria-current', 'true');
    else article.removeAttribute('aria-current');
  }
}

function renderResultsLine(): void {
  resultsLine.textContent = state.query.trim() ? `results for "${state.query}"` : '';
}

function renderFeed(): void {
  const matches = visibleNotes();
  feed.replaceChildren();

  if (matches.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = notes.length
      ? 'No notes match your search.'
      : 'No notes yet — add the first one.';
    feed.appendChild(empty);
  } else {
    const fragment = document.createDocumentFragment();
    for (const note of matches) fragment.appendChild(buildNote(note));
    feed.appendChild(fragment);
  }

  applySelection();
}

function render(): void {
  renderResultsLine();
  renderFeed();
}

function setQuery(query: string): void {
  if (query === state.query) return;
  state.query = query;
  render();
  writeFragment(state);
}

function setSelected(id: number | null): void {
  if (id === state.selectedId) return;
  state.selectedId = id;
  applySelection();
  writeFragment(state);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value;
  if (!title && !body.trim()) return;

  notes = [
    ...notes,
    {
      id: nextId(notes),
      title,
      body,
      avatar: avatarInput.value.trim(),
      createdAt: nextCreatedAt(notes),
    },
  ];
  saveNotes(notes);
  form.reset();
  render();
  titleInput.focus();
});

searchInput.addEventListener('input', () => setQuery(searchInput.value));

feed.addEventListener('click', (event) => {
  const target = event.target as Element | null;
  const title = target?.closest<HTMLElement>('.note-title');
  if (!title) return;
  const article = title.closest<HTMLElement>('article.note');
  if (!article) return;
  const id = Number(article.dataset.noteId);
  if (Number.isFinite(id)) setSelected(id);
});

/** Adopt the fragment as the source of truth (first load and back/forward). */
function applyFragment(): void {
  const next = parseFragment(window.location.hash);
  const known = next.selectedId !== null && notes.some((note) => note.id === next.selectedId);
  state.query = next.query;
  state.selectedId = known ? next.selectedId : null;
  searchInput.value = state.query;
  render();
  writeFragment(state); // normalise (drop unknown ids, fix ordering)
}

window.addEventListener('hashchange', applyFragment);

applyFragment();

if (state.selectedId !== null) {
  feed
    .querySelector(`article.note[data-note-id="${state.selectedId}"]`)
    ?.scrollIntoView({ block: 'nearest' });
}
