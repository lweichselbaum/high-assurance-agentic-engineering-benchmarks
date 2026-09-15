import './style.css';
import type { Note } from './types';
import { loadNotes, saveNotes, getNextNoteId } from './storage';
import { renderRichText, isSafeImageUrl } from './richText';
import { parseUrlFragment, syncUrlFragment } from './url';

// Application State
let notes: Note[] = [];
let currentQuery = '';
let selectedNoteId: number | null = null;

// DOM Elements
const form = document.getElementById('note-form') as HTMLFormElement;
const titleInput = document.getElementById('title') as HTMLInputElement;
const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
const avatarInput = document.getElementById('avatar') as HTMLInputElement;
const searchInput = document.getElementById('search') as HTMLInputElement;
const resultsLine = document.getElementById('results-line') as HTMLParagraphElement;
const feed = document.getElementById('feed') as HTMLElement;

function matchesSearch(note: Note, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase().trim();
  if (!q) return true;

  const titleLower = note.title.toLowerCase();
  const bodyLower = note.body.toLowerCase();

  if (titleLower.includes(q) || bodyLower.includes(q)) {
    return true;
  }

  // Also check stripped HTML text content
  const strippedTitle = note.title.replace(/<[^>]*>/g, '').toLowerCase();
  const strippedBody = note.body.replace(/<[^>]*>/g, '').toLowerCase();

  return strippedTitle.includes(q) || strippedBody.includes(q);
}

function updateResultsLine(query: string): void {
  if (query && query.length > 0) {
    resultsLine.textContent = `results for "${query}"`;
  } else {
    resultsLine.textContent = '';
  }
}

function selectNote(noteId: number): void {
  selectedNoteId = noteId;
  updateSelectionInDom();
  syncUrlFragment(currentQuery, selectedNoteId);
}

function updateSelectionInDom(): void {
  const noteElements = feed.querySelectorAll<HTMLElement>('article.note');
  noteElements.forEach((el) => {
    const id = Number(el.dataset.noteId);
    if (selectedNoteId !== null && id === selectedNoteId) {
      el.setAttribute('aria-current', 'true');
    } else {
      el.removeAttribute('aria-current');
    }
  });
}

function createNoteElement(note: Note): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.dataset.noteId = String(note.id);
  if (selectedNoteId !== null && note.id === selectedNoteId) {
    article.setAttribute('aria-current', 'true');
  }

  // Header container
  const header = document.createElement('div');
  header.className = 'note-header';

  // Avatar (only rendered when an avatar URL was given)
  if (note.avatar && note.avatar.trim().length > 0 && isSafeImageUrl(note.avatar)) {
    const img = document.createElement('img');
    img.className = 'note-avatar';
    img.src = note.avatar.trim();
    img.alt = '';
    header.appendChild(img);
  }

  // Title
  const title = document.createElement('h3');
  title.className = 'note-title';
  title.setAttribute('tabindex', '0');
  title.setAttribute('role', 'button');
  renderRichText(note.title, title);

  // Click & keyboard handlers to select note
  title.addEventListener('click', () => {
    selectNote(note.id);
  });

  title.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectNote(note.id);
    }
  });

  header.appendChild(title);
  article.appendChild(header);

  // Body
  const body = document.createElement('div');
  body.className = 'note-body';
  renderRichText(note.body, body);
  article.appendChild(body);

  // Date footer
  if (note.createdAt) {
    const footer = document.createElement('div');
    footer.className = 'note-footer';
    const time = document.createElement('time');
    time.className = 'note-date';
    time.dateTime = note.createdAt;
    try {
      const date = new Date(note.createdAt);
      time.textContent = date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      time.textContent = note.createdAt;
    }
    footer.appendChild(time);
    article.appendChild(footer);
  }

  return article;
}

function renderFeed(): void {
  feed.replaceChildren();

  // Sort newest-first (descending by createdAt, fallback to id desc)
  const sortedNotes = [...notes]
    .filter((n) => matchesSearch(n, currentQuery))
    .sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) {
        return timeB - timeA;
      }
      return b.id - a.id;
    });

  if (sortedNotes.length === 0) {
    if (currentQuery.trim().length > 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'feed-empty';
      const p = document.createElement('p');
      p.textContent = 'No notes match your search.';
      emptyMsg.appendChild(p);
      feed.appendChild(emptyMsg);
    }
    return;
  }

  for (const note of sortedNotes) {
    const el = createNoteElement(note);
    feed.appendChild(el);
  }
}

// Event Listeners
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const rawTitle = titleInput.value.trim();
  const rawBody = bodyInput.value.trim();
  const rawAvatar = avatarInput.value.trim();

  if (!rawTitle || !rawBody) {
    return;
  }

  const newNote: Note = {
    id: getNextNoteId(notes),
    title: titleInput.value,
    body: bodyInput.value,
    avatar: rawAvatar,
    createdAt: new Date().toISOString(),
  };

  notes.unshift(newNote);
  saveNotes(notes);

  // Clear form
  form.reset();
  titleInput.value = '';
  bodyInput.value = '';
  avatarInput.value = '';

  renderFeed();
});

searchInput.addEventListener('input', () => {
  currentQuery = searchInput.value;
  updateResultsLine(currentQuery);
  renderFeed();
  syncUrlFragment(currentQuery, selectedNoteId);
});

function handleUrlChange(): void {
  const { query, noteId } = parseUrlFragment();
  let stateChanged = false;

  if (currentQuery !== query) {
    currentQuery = query;
    searchInput.value = query;
    updateResultsLine(query);
    stateChanged = true;
  }

  if (selectedNoteId !== noteId) {
    selectedNoteId = noteId;
    stateChanged = true;
  }

  if (stateChanged) {
    renderFeed();
  }
}

window.addEventListener('hashchange', handleUrlChange);
window.addEventListener('popstate', handleUrlChange);

// Initialize Application
function init(): void {
  notes = loadNotes();

  const { query, noteId } = parseUrlFragment();
  currentQuery = query;
  selectedNoteId = noteId;

  if (currentQuery) {
    searchInput.value = currentQuery;
  }
  updateResultsLine(currentQuery);

  renderFeed();
}

init();
