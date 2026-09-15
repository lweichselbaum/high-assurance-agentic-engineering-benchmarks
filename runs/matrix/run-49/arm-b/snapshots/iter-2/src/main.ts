import DOMPurify from 'dompurify';
import { sanitizeHtml } from 'safevalues';
import { setElementInnerHtml } from 'safevalues/dom';
import fixtures from './fixtures.json';
import './style.css';

export interface Note {
  id: number;
  title: string;
  body: string;
  avatar?: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto_notes';
const ALLOWED_TAGS = ['b', 'strong', 'i', 'em', 'u', 's', 'a', 'br', 'p', 'span'];
const ALLOWED_ATTR = ['href', 'title', 'target', 'rel'];

// Seed fixtures
const seedNotes: Note[] = (fixtures as Note[]).map((f) => ({ ...f }));

function sortNotesNewestFirst(notesList: Note[]): Note[] {
  return [...notesList].sort((a, b) => {
    const timeDiff = b.createdAt.localeCompare(a.createdAt);
    if (timeDiff !== 0) return timeDiff;
    return b.id - a.id;
  });
}

function getNextNoteId(notesList: Note[]): number {
  if (notesList.length === 0) return 1;
  return notesList.reduce((max, n) => Math.max(max, n.id), 0) + 1;
}

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return sortNotesNewestFirst(parsed as Note[]);
      }
    }
  } catch (err) {
    console.error('Failed to parse notes from localStorage:', err);
  }
  const initial = sortNotesNewestFirst(seedNotes);
  saveNotes(initial);
  return initial;
}

function saveNotes(notesToSave: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notesToSave));
  } catch (err) {
    console.error('Failed to save notes to localStorage:', err);
  }
}

function isValidAvatarUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  // Reject dangerous schemes
  if (/^\s*(javascript|vbscript):/i.test(trimmed)) {
    return false;
  }
  // Reject attribute breakout characters
  if (/["'<>]/.test(trimmed)) {
    return false;
  }

  // Data URLs: allow data:image/
  if (trimmed.startsWith('data:image/')) {
    return true;
  }

  // HTTP or HTTPS URLs
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function renderRichText(el: HTMLElement, raw: string, convertNewlines: boolean): void {
  const text = convertNewlines ? raw.replace(/\r\n|\r|\n/g, '<br>') : raw;
  const clean = DOMPurify.sanitize(text, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    RETURN_TRUSTED_TYPE: false,
  });
  const safe = sanitizeHtml(String(clean));
  setElementInnerHtml(el, safe);
}

function parseHash(): { q: string; noteId: number | null } {
  const hash = window.location.hash.replace(/^#/, '');
  const params = new URLSearchParams(hash);
  const q = params.get('q') ?? '';
  const noteRaw = params.get('note');
  let noteId: number | null = null;
  if (noteRaw !== null && noteRaw !== '') {
    const num = Number(noteRaw);
    if (!isNaN(num)) {
      noteId = num;
    }
  }
  return { q, noteId };
}

function matchesQuery(note: Note, query: string): boolean {
  if (!query) return true;
  const qLower = query.toLowerCase();
  return note.title.toLowerCase().includes(qLower) || note.body.toLowerCase().includes(qLower);
}

// App state
let notes: Note[] = loadNotes();
let { q: currentQuery, noteId: selectedNoteId } = parseHash();

// DOM elements
const form = document.getElementById('note-form') as HTMLFormElement | null;
const titleInput = document.getElementById('title') as HTMLInputElement | null;
const bodyInput = document.getElementById('body') as HTMLTextAreaElement | null;
const avatarInput = document.getElementById('avatar') as HTMLInputElement | null;
const searchInput = document.getElementById('search') as HTMLInputElement | null;
const resultsLine = document.getElementById('results-line') as HTMLParagraphElement | null;
const feedEl = document.getElementById('feed') as HTMLElement | null;

if (!form || !titleInput || !bodyInput || !avatarInput || !searchInput || !resultsLine || !feedEl) {
  throw new Error('Porto Notes: Required DOM elements missing');
}

function updateHash(): void {
  const params = new URLSearchParams();
  if (currentQuery) {
    params.set('q', currentQuery);
  }
  if (selectedNoteId !== null) {
    params.set('note', String(selectedNoteId));
  }
  const str = params.toString();
  const newUrl = str ? `#${str}` : window.location.pathname + window.location.search;
  history.replaceState(null, '', newUrl);
}

function selectNote(id: number): void {
  selectedNoteId = id;
  updateSelectionUi();
  updateHash();
}

function updateSelectionUi(): void {
  const articles = feedEl!.querySelectorAll<HTMLElement>('article.note');
  articles.forEach((article) => {
    const idStr = article.getAttribute('data-note-id');
    if (selectedNoteId !== null && idStr === String(selectedNoteId)) {
      article.setAttribute('aria-current', 'true');
    } else {
      article.removeAttribute('aria-current');
    }
  });
}

function applySearchAndFilter(): void {
  if (currentQuery) {
    resultsLine!.textContent = `results for "${currentQuery}"`;
  } else {
    resultsLine!.textContent = '';
  }

  const articles = feedEl!.querySelectorAll<HTMLElement>('article.note');
  articles.forEach((article) => {
    const idStr = article.getAttribute('data-note-id');
    const note = notes.find((n) => String(n.id) === idStr);
    const visible = note ? matchesQuery(note, currentQuery) : false;
    article.style.display = visible ? '' : 'none';
  });
}

function createNoteArticle(note: Note): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.setAttribute('data-note-id', String(note.id));

  if (selectedNoteId !== null && note.id === selectedNoteId) {
    article.setAttribute('aria-current', 'true');
  }

  const header = document.createElement('div');
  header.className = 'note-header';

  if (note.avatar && isValidAvatarUrl(note.avatar)) {
    const avatarImg = document.createElement('img');
    avatarImg.className = 'note-avatar';
    avatarImg.src = note.avatar;
    avatarImg.alt = '';
    avatarImg.width = 40;
    avatarImg.height = 40;
    header.appendChild(avatarImg);
  }

  const titleEl = document.createElement('h3');
  titleEl.className = 'note-title';
  titleEl.setAttribute('tabindex', '0');
  titleEl.setAttribute('role', 'button');
  renderRichText(titleEl, note.title, false);
  header.appendChild(titleEl);

  article.appendChild(header);

  const bodyEl = document.createElement('div');
  bodyEl.className = 'note-body';
  renderRichText(bodyEl, note.body, true);
  article.appendChild(bodyEl);

  return article;
}

function renderFeed(): void {
  feedEl!.replaceChildren();
  for (const note of notes) {
    const article = createNoteArticle(note);
    if (!matchesQuery(note, currentQuery)) {
      article.style.display = 'none';
    }
    feedEl!.appendChild(article);
  }
}

// Event Listeners
form.addEventListener('submit', (e: Event) => {
  e.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value;
  const avatar = avatarInput.value.trim();

  if (!title && !body.trim()) {
    return;
  }

  const newNote: Note = {
    id: getNextNoteId(notes),
    title,
    body,
    avatar: avatar || '',
    createdAt: new Date().toISOString(),
  };

  notes = sortNotesNewestFirst([newNote, ...notes]);
  saveNotes(notes);

  titleInput.value = '';
  bodyInput.value = '';
  avatarInput.value = '';

  renderFeed();
});

searchInput.addEventListener('input', () => {
  currentQuery = searchInput.value;
  applySearchAndFilter();
  updateHash();
});

feedEl.addEventListener('click', (e: MouseEvent) => {
  const target = e.target as HTMLElement | null;
  if (!target) return;
  if (target.closest('a')) return;

  const titleEl = target.closest('.note-title');
  if (titleEl) {
    const article = titleEl.closest('article.note');
    if (article) {
      const idStr = article.getAttribute('data-note-id');
      if (idStr) {
        selectNote(Number(idStr));
      }
    }
  }
});

feedEl.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const titleEl = target.closest('.note-title');
    if (titleEl) {
      e.preventDefault();
      const article = titleEl.closest('article.note');
      if (article) {
        const idStr = article.getAttribute('data-note-id');
        if (idStr) {
          selectNote(Number(idStr));
        }
      }
    }
  }
});

const onHashOrStateChange = () => {
  const { q, noteId } = parseHash();
  currentQuery = q;
  selectedNoteId = noteId;
  searchInput.value = currentQuery;
  applySearchAndFilter();
  updateSelectionUi();
};

window.addEventListener('hashchange', onHashOrStateChange);
window.addEventListener('popstate', onHashOrStateChange);

// Initial render
searchInput.value = currentQuery;
if (currentQuery) {
  resultsLine.textContent = `results for "${currentQuery}"`;
} else {
  resultsLine.textContent = '';
}
renderFeed();
