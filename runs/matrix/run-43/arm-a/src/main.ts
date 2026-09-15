import './style.css';
import { Note, RouteState } from './types';
import { loadNotes, saveNotes, getNextId } from './storage';
import { renderRichText, noteMatchesSearch } from './rich-text';

// Application State
let notes: Note[] = [];
let currentQuery = '';
let selectedNoteId: number | null = null;

// DOM Elements
const noteForm = document.getElementById('note-form') as HTMLFormElement;
const titleInput = document.getElementById('title') as HTMLInputElement;
const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
const avatarInput = document.getElementById('avatar') as HTMLInputElement;
const searchInput = document.getElementById('search') as HTMLInputElement;
const resultsLine = document.getElementById('results-line') as HTMLParagraphElement;
const feedContainer = document.getElementById('feed') as HTMLElement;

/**
 * Parses the current URL fragment into query and noteId.
 */
function parseHash(): RouteState {
  let hash = window.location.hash;
  if (hash.startsWith('#')) {
    hash = hash.slice(1);
  }
  if (!hash) {
    return { q: '', noteId: null };
  }
  const params = new URLSearchParams(hash);
  const q = params.get('q') ?? '';
  const noteStr = params.get('note');
  let noteId: number | null = null;
  if (noteStr !== null && noteStr !== '') {
    const parsed = parseInt(noteStr, 10);
    if (!isNaN(parsed)) {
      noteId = parsed;
    }
  }
  return { q, noteId };
}

/**
 * Synchronizes the URL fragment with current state.
 */
function syncHash(q: string, noteId: number | null): void {
  const params = new URLSearchParams();
  if (q) {
    params.set('q', q);
  }
  if (noteId !== null) {
    params.set('note', String(noteId));
  }
  const str = params.toString();
  const targetHash = str ? `#${str}` : '';

  if (window.location.hash !== targetHash) {
    if (targetHash) {
      history.replaceState(null, '', targetHash);
    } else {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }
}

/**
 * Updates the search results status line.
 */
function updateResultsLine(): void {
  if (currentQuery) {
    resultsLine.textContent = `results for "${currentQuery}"`;
  } else {
    resultsLine.textContent = '';
  }
}

/**
 * Updates aria-current on rendered note articles.
 */
function updateSelectionInDOM(): void {
  const noteElements = feedContainer.querySelectorAll<HTMLElement>('article.note');
  for (const el of noteElements) {
    const idStr = el.getAttribute('data-note-id');
    if (idStr !== null && parseInt(idStr, 10) === selectedNoteId) {
      el.setAttribute('aria-current', 'true');
    } else {
      el.removeAttribute('aria-current');
    }
  }
}

/**
 * Creates a single note article element.
 */
function createNoteElement(note: Note, isSelected: boolean): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.setAttribute('data-note-id', String(note.id));
  if (isSelected) {
    article.setAttribute('aria-current', 'true');
  }

  const headerWrap = document.createElement('div');
  headerWrap.className = 'note-header-wrap';

  if (note.avatar && note.avatar.trim().length > 0) {
    const img = document.createElement('img');
    img.className = 'note-avatar';
    img.src = note.avatar.trim();
    img.alt = 'Author avatar';
    headerWrap.appendChild(img);
  }

  const titleEl = document.createElement('h2');
  titleEl.className = 'note-title';
  renderRichText(note.title, titleEl);
  headerWrap.appendChild(titleEl);

  article.appendChild(headerWrap);

  const bodyEl = document.createElement('div');
  bodyEl.className = 'note-body';
  renderRichText(note.body, bodyEl);
  article.appendChild(bodyEl);

  return article;
}

/**
 * Renders the notes feed matching the current query.
 */
function renderFeed(): void {
  feedContainer.innerHTML = '';

  const filtered = notes.filter((n) => noteMatchesSearch(n.title, n.body, currentQuery));

  // Sort newest-first (by createdAt descending, fallback to id descending)
  const sorted = [...filtered].sort((a, b) => {
    const tA = new Date(a.createdAt).getTime();
    const tB = new Date(b.createdAt).getTime();
    if (isNaN(tA) || isNaN(tB) || tA === tB) {
      return b.id - a.id;
    }
    return tB - tA;
  });

  for (const note of sorted) {
    const isSelected = note.id === selectedNoteId;
    const noteEl = createNoteElement(note, isSelected);
    feedContainer.appendChild(noteEl);
  }
}

/**
 * Selects a note by id and updates fragment.
 */
function selectNote(id: number): void {
  selectedNoteId = id;
  syncHash(currentQuery, selectedNoteId);
  updateSelectionInDOM();
}

// Event Listeners

// Note Title Click (Selection)
feedContainer.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const titleEl = target.closest('.note-title');
  if (titleEl) {
    const noteArticle = titleEl.closest('article.note');
    if (noteArticle) {
      const idStr = noteArticle.getAttribute('data-note-id');
      if (idStr) {
        const id = parseInt(idStr, 10);
        if (!isNaN(id)) {
          selectNote(id);
        }
      }
    }
  }
});

// Search Input Live Filter
searchInput.addEventListener('input', () => {
  currentQuery = searchInput.value;
  syncHash(currentQuery, selectedNoteId);
  updateResultsLine();
  renderFeed();
});

// Form Submission
noteForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value;
  const avatar = avatarInput.value.trim();

  if (!title && !body) {
    return;
  }

  const newNote: Note = {
    id: getNextId(notes),
    title,
    body,
    avatar,
    createdAt: new Date().toISOString(),
  };

  notes.unshift(newNote);
  saveNotes(notes);

  noteForm.reset();
  titleInput.value = '';
  bodyInput.value = '';
  avatarInput.value = '';

  renderFeed();
});

// Browser History / Fragment Navigation
function handleHashChange(): void {
  const state = parseHash();
  currentQuery = state.q;
  selectedNoteId = state.noteId;
  searchInput.value = currentQuery;
  updateResultsLine();
  renderFeed();
}

window.addEventListener('hashchange', handleHashChange);
window.addEventListener('popstate', handleHashChange);

// App Initialization
function init(): void {
  notes = loadNotes();
  const initialState = parseHash();
  currentQuery = initialState.q;
  selectedNoteId = initialState.noteId;
  if (currentQuery) {
    searchInput.value = currentQuery;
  }
  updateResultsLine();
  renderFeed();
}

init();
