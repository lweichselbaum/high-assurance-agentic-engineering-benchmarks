import './style.css';
import defaultFixtures from './fixtures.json';
import { sanitizeHtml, SafeHtml } from 'safevalues';
import { setElementInnerHtml } from 'safevalues/dom';

export interface Note {
  id: number;
  title: string;
  body: string;
  avatar?: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto_notes';

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as Note[];
      }
    }
  } catch {
    // Fallback to default fixtures on storage read/parse failure
  }
  const seedNotes: Note[] = JSON.parse(JSON.stringify(defaultFixtures));
  saveNotes(seedNotes);
  return seedNotes;
}

function saveNotes(notesToSave: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notesToSave));
  } catch {
    // Storage quota or disabled
  }
}

function getNextNoteId(existingNotes: Note[]): number {
  const maxId = existingNotes.reduce((max, n) => Math.max(max, typeof n.id === 'number' ? n.id : 0), 0);
  return maxId + 1;
}

function getSortedNotes(notesToSort: Note[]): Note[] {
  return [...notesToSort].sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    if (timeB !== timeA) {
      return timeB - timeA;
    }
    return b.id - a.id;
  });
}

function formatBody(rawBody: string): SafeHtml {
  // Convert newlines to <br>
  const withBr = rawBody.replace(/\r\n|\r|\n/g, '<br>');
  return sanitizeHtml(withBr);
}

function isValidAvatarUrl(url: string | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (/^data:image\/[a-z0-9.+;=-]+,/i.test(trimmed)) return true;
  try {
    const parsed = new URL(trimmed, window.location.href);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function parseHash(): { query: string; noteId: number | null } {
  const raw = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (!raw) {
    return { query: '', noteId: null };
  }
  const params = new URLSearchParams(raw);
  const q = params.get('q') ?? '';
  const noteStr = params.get('note');
  let noteId: number | null = null;
  if (noteStr !== null && noteStr !== '') {
    const parsed = parseInt(noteStr, 10);
    if (!Number.isNaN(parsed)) {
      noteId = parsed;
    }
  }
  return { query: q, noteId };
}

function syncUrlHash(query: string, noteId: number | null): void {
  const params = new URLSearchParams();
  if (query) {
    params.set('q', query);
  }
  if (noteId !== null) {
    params.set('note', String(noteId));
  }
  const newHash = params.toString();
  const newUrl = newHash
    ? `#${newHash}`
    : window.location.pathname + window.location.search;
  const currentRawHash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (currentRawHash !== newHash) {
    window.history.replaceState(null, '', newUrl);
  }
}

// App state
const notes: Note[] = loadNotes();
const initialHashState = parseHash();
let currentQuery: string = initialHashState.query;
let selectedNoteId: number | null = initialHashState.noteId;

// DOM references
const formEl = document.getElementById('note-form') as HTMLFormElement | null;
const titleInput = document.getElementById('title') as HTMLInputElement | null;
const bodyInput = document.getElementById('body') as HTMLTextAreaElement | null;
const avatarInput = document.getElementById('avatar') as HTMLInputElement | null;
const searchInput = document.getElementById('search') as HTMLInputElement | null;
const resultsLineEl = document.getElementById('results-line') as HTMLParagraphElement | null;
const feedEl = document.getElementById('feed') as HTMLElement | null;

function updateResultsLine(): void {
  if (!resultsLineEl) return;
  if (currentQuery) {
    resultsLineEl.textContent = `results for "${currentQuery}"`;
  } else {
    resultsLineEl.textContent = '';
  }
}

function updateSelectionVisuals(): void {
  if (!feedEl) return;
  const noteElements = feedEl.querySelectorAll<HTMLElement>('.note');
  noteElements.forEach((el) => {
    const idStr = el.dataset.noteId;
    if (idStr && parseInt(idStr, 10) === selectedNoteId) {
      el.setAttribute('aria-current', 'true');
    } else {
      el.removeAttribute('aria-current');
    }
  });
}

function createNoteElement(note: Note, isSelected: boolean): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.dataset.noteId = String(note.id);
  if (isSelected) {
    article.setAttribute('aria-current', 'true');
  }

  const header = document.createElement('div');
  header.className = 'note-header';

  if (note.avatar && isValidAvatarUrl(note.avatar)) {
    const avatarImg = document.createElement('img');
    avatarImg.className = 'note-avatar';
    avatarImg.src = note.avatar.trim();
    avatarImg.alt = `${note.title} avatar`;
    header.appendChild(avatarImg);
  }

  const titleWrapper = document.createElement('div');
  titleWrapper.className = 'note-title-wrapper';

  const titleEl = document.createElement('h3');
  titleEl.className = 'note-title';
  titleEl.textContent = note.title;
  titleEl.tabIndex = 0;
  titleEl.setAttribute('role', 'button');
  titleEl.setAttribute('aria-label', `Select note: ${note.title}`);

  const handleSelect = (): void => {
    selectedNoteId = note.id;
    syncUrlHash(currentQuery, selectedNoteId);
    updateSelectionVisuals();
  };

  titleEl.addEventListener('click', handleSelect);
  titleEl.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelect();
    }
  });

  titleWrapper.appendChild(titleEl);
  header.appendChild(titleWrapper);
  article.appendChild(header);

  const bodyEl = document.createElement('div');
  bodyEl.className = 'note-body';
  const safeBodyHtml = formatBody(note.body);
  setElementInnerHtml(bodyEl, safeBodyHtml);
  article.appendChild(bodyEl);

  return article;
}

function renderFeed(): void {
  if (!feedEl) return;
  feedEl.textContent = '';

  const sortedNotes = getSortedNotes(notes);
  const trimmedQ = currentQuery.trim().toLowerCase();

  const filteredNotes = trimmedQ
    ? sortedNotes.filter(
        (n) =>
          n.title.toLowerCase().includes(trimmedQ) ||
          n.body.toLowerCase().includes(trimmedQ),
      )
    : sortedNotes;

  if (filteredNotes.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.className = 'empty-feed';
    emptyMsg.textContent = trimmedQ
      ? 'No notes matching your search.'
      : 'No notes yet. Add one above!';
    feedEl.appendChild(emptyMsg);
    return;
  }

  for (const note of filteredNotes) {
    const isSelected = note.id === selectedNoteId;
    const noteEl = createNoteElement(note, isSelected);
    feedEl.appendChild(noteEl);
  }
}

// Initial sync
if (searchInput && currentQuery) {
  searchInput.value = currentQuery;
}
updateResultsLine();
renderFeed();

// Event listeners
if (searchInput) {
  searchInput.addEventListener('input', () => {
    currentQuery = searchInput.value;
    updateResultsLine();
    syncUrlHash(currentQuery, selectedNoteId);
    renderFeed();
  });
}

if (formEl && titleInput && bodyInput && avatarInput) {
  formEl.addEventListener('submit', (e: Event) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    const body = bodyInput.value;
    const avatar = avatarInput.value.trim();

    if (!title || !body) return;

    const newNote: Note = {
      id: getNextNoteId(notes),
      title,
      body,
      avatar,
      createdAt: new Date().toISOString(),
    };

    notes.unshift(newNote);
    saveNotes(notes);

    titleInput.value = '';
    bodyInput.value = '';
    avatarInput.value = '';

    renderFeed();
  });
}

window.addEventListener('hashchange', () => {
  const { query, noteId } = parseHash();
  let shouldRender = false;
  if (query !== currentQuery) {
    currentQuery = query;
    if (searchInput) {
      searchInput.value = currentQuery;
    }
    updateResultsLine();
    shouldRender = true;
  }
  if (noteId !== selectedNoteId) {
    selectedNoteId = noteId;
    shouldRender = true;
  }
  if (shouldRender) {
    renderFeed();
  }
});


