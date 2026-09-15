// Porto Notes — shared notes board implementation
import './style.css';
import { sanitizeHtml } from 'safevalues';
import { setElementInnerHtml } from 'safevalues/dom';
import fixtures from '../fixtures.json';

export interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

export interface ParsedHash {
  query: string;
  noteId: number | null;
}

const STORAGE_KEY = 'porto_notes';

let notes: Note[] = [];
let selectedNoteId: number | null = null;

// DOM Elements
const formEl = document.querySelector<HTMLFormElement>('#note-form');
const titleInput = document.querySelector<HTMLInputElement>('#title');
const bodyInput = document.querySelector<HTMLTextAreaElement>('#body');
const avatarInput = document.querySelector<HTMLInputElement>('#avatar');
const searchInput = document.querySelector<HTMLInputElement>('#search');
const resultsLineEl = document.querySelector<HTMLParagraphElement>('#results-line');
const feedEl = document.querySelector<HTMLElement>('#feed');

/**
 * Validates avatar URLs to allow only safe schemes (http:, https:, data:image/).
 * Disallows javascript: URLs or other active schemes.
 */
export function isValidAvatarUrl(url: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('data:image/')) {
    return true;
  }
  try {
    const parsed = new URL(trimmed, window.location.href);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Loads notes from localStorage, seeding from fixtures.json if no saved notes exist.
 */
export function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as Note[];
      }
    }
  } catch {
    // Ignore storage parse errors, fallback to fixtures
  }
  const initial = fixtures as Note[];
  saveNotes(initial);
  return [...initial];
}

/**
 * Persists notes array to localStorage.
 */
export function saveNotes(notesToSave: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notesToSave));
  } catch {
    // Ignore storage write errors (e.g. storage quota exceeded)
  }
}

/**
 * Converts newlines to HTML <br> tags for rich text display.
 */
export function formatBody(body: string): string {
  return body.replace(/\r\n|\n/g, '<br>');
}

/**
 * Checks if a note matches the case-insensitive search query in title or body.
 */
export function matchesSearch(note: Note, query: string): boolean {
  if (!query) return true;
  const qLower = query.toLowerCase();
  const text = `${note.title} ${note.body}`.toLowerCase();
  return text.includes(qLower);
}

/**
 * Parses query and selected note id from the URL fragment (e.g. #q=port&note=3).
 */
export function parseUrlHash(): ParsedHash {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) {
    return { query: '', noteId: null };
  }
  const params = new URLSearchParams(hash);
  const query = params.get('q') ?? '';
  const noteParam = params.get('note');
  const parsedId = noteParam ? parseInt(noteParam, 10) : null;
  const noteId = parsedId !== null && !Number.isNaN(parsedId) ? parsedId : null;
  return { query, noteId };
}

/**
 * Keeps the URL fragment in sync with current search query and selected note id.
 */
export function updateUrlHash(query: string, noteId: number | null): void {
  const params = new URLSearchParams();
  const trimmed = query.trim();
  if (trimmed) {
    params.set('q', trimmed);
  }
  if (noteId !== null) {
    params.set('note', String(noteId));
  }
  const paramStr = params.toString();
  const newHash = paramStr ? `#${paramStr}` : '';
  const currentHash = window.location.hash;
  if (currentHash !== newHash) {
    const newUrl = newHash
      ? `${window.location.pathname}${window.location.search}${newHash}`
      : `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, '', newUrl);
  }
}

/**
 * Updates note selection state and sets aria-current="true" on the selected note.
 */
function updateSelection(id: number | null): void {
  selectedNoteId = id;
  if (!feedEl) return;
  const articles = feedEl.querySelectorAll<HTMLElement>('article.note');
  articles.forEach((el) => {
    const noteId = Number(el.getAttribute('data-note-id'));
    if (noteId === selectedNoteId) {
      el.setAttribute('aria-current', 'true');
    } else {
      el.removeAttribute('aria-current');
    }
  });
}

/**
 * Filters the feed notes based on query and updates the results line.
 */
function updateFeedFilter(query: string): void {
  if (!feedEl || !resultsLineEl) return;
  const trimmed = query.trim();
  if (trimmed) {
    resultsLineEl.textContent = `results for "${trimmed}"`;
  } else {
    resultsLineEl.textContent = '';
  }

  const articles = feedEl.querySelectorAll<HTMLElement>('article.note');
  articles.forEach((el) => {
    const noteId = Number(el.getAttribute('data-note-id'));
    const note = notes.find((n) => n.id === noteId);
    if (note && matchesSearch(note, trimmed)) {
      el.style.display = '';
    } else {
      el.style.display = 'none';
    }
  });
}

/**
 * Creates a note DOM article matching the element contract.
 */
export function createNoteElement(
  note: Note,
  onSelect: (id: number) => void
): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.setAttribute('data-note-id', String(note.id));

  // Avatar (rendered only when a valid avatar URL is provided)
  if (isValidAvatarUrl(note.avatar)) {
    const img = document.createElement('img');
    img.className = 'note-avatar';
    img.alt = 'Author avatar';
    img.src = note.avatar.trim();
    article.appendChild(img);
  }

  const contentDiv = document.createElement('div');
  contentDiv.className = 'note-content';

  // Title with user formatting and click selection
  const titleEl = document.createElement('h2');
  titleEl.className = 'note-title';
  titleEl.tabIndex = 0;
  titleEl.setAttribute('role', 'button');
  titleEl.setAttribute('aria-label', `Select note ${note.title}`);
  setElementInnerHtml(titleEl, sanitizeHtml(note.title));

  const selectHandler = (e: Event) => {
    e.preventDefault();
    onSelect(note.id);
  };
  titleEl.addEventListener('click', selectHandler);
  titleEl.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      selectHandler(e);
    }
  });
  contentDiv.appendChild(titleEl);

  // Body with rich text formatting (bold, italic, links, line breaks)
  const bodyEl = document.createElement('div');
  bodyEl.className = 'note-body';
  setElementInnerHtml(bodyEl, sanitizeHtml(formatBody(note.body)));
  contentDiv.appendChild(bodyEl);

  article.appendChild(contentDiv);
  return article;
}

function handleSelect(id: number): void {
  selectedNoteId = id;
  updateSelection(selectedNoteId);
  const currentQuery = searchInput?.value ?? '';
  updateUrlHash(currentQuery, selectedNoteId);
}

/**
 * Initializes the Porto Notes application.
 */
function init(): void {
  if (!formEl || !titleInput || !bodyInput || !avatarInput || !searchInput || !resultsLineEl || !feedEl) {
    return;
  }

  // Load and sort notes newest-first
  notes = loadNotes();
  notes.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // Render initial notes in feed
  feedEl.replaceChildren();
  for (const note of notes) {
    const el = createNoteElement(note, handleSelect);
    feedEl.appendChild(el);
  }

  // Restore state from URL fragment
  const { query, noteId } = parseUrlHash();
  searchInput.value = query;
  selectedNoteId = noteId;

  updateFeedFilter(query);
  updateSelection(selectedNoteId);

  // Search input handler
  searchInput.addEventListener('input', () => {
    const q = searchInput.value;
    updateFeedFilter(q);
    updateUrlHash(q, selectedNoteId);
  });

  // Note form submission handler
  formEl.addEventListener('submit', (e: Event) => {
    e.preventDefault();
    const title = titleInput.value;
    const body = bodyInput.value;
    const avatar = avatarInput.value;

    if (!title && !body) {
      return;
    }

    const nextId = notes.reduce((max, n) => Math.max(max, n.id), 0) + 1;
    const newNote: Note = {
      id: nextId,
      title,
      body,
      avatar,
      createdAt: new Date().toISOString(),
    };

    // Prepend to notes array and save
    notes.unshift(newNote);
    saveNotes(notes);

    // Prepend to feed
    const noteEl = createNoteElement(newNote, handleSelect);
    feedEl.prepend(noteEl);

    // Clear form inputs
    titleInput.value = '';
    bodyInput.value = '';
    avatarInput.value = '';

    // Re-apply filter
    updateFeedFilter(searchInput.value);
  });

  // URL hash change handler (e.g. back/forward navigation)
  window.addEventListener('hashchange', () => {
    const { query: newQuery, noteId: newNoteId } = parseUrlHash();
    if (searchInput.value !== newQuery) {
      searchInput.value = newQuery;
    }
    selectedNoteId = newNoteId;
    updateFeedFilter(newQuery);
    updateSelection(selectedNoteId);
  });
}

// Start application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
