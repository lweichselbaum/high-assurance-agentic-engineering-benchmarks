import './style.css';
import fixturesData from '../fixtures.json';
import DOMPurify from 'dompurify';
import { sanitizeHtml, SafeHtml } from 'safevalues';
import { setElementInnerHtml } from 'safevalues/dom';

export interface Note {
  id: number;
  title: string;
  body: string;
  avatar?: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto_notes_data';

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as Note[];
      }
    }
  } catch (err) {
    console.error('Error loading notes from localStorage:', err);
  }
  const initial = (fixturesData as Note[]).slice();
  saveNotes(initial);
  return initial;
}

function saveNotes(data: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Error saving notes to localStorage:', err);
  }
}

function isValidAvatarUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  // Reject control characters
  if (/[\u0000-\u001F\u007F-\u009F]/.test(trimmed)) return false;

  // Check data:image/...
  if (/^data:image\/(?:png|jpeg|jpg|gif|svg\+xml|webp|avif|bmp|ico)[;,]/i.test(trimmed)) {
    return true;
  }

  try {
    const parsed = new URL(trimmed, window.location.origin);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

function sanitizeRichText(body: string): SafeHtml {
  const withBreaks = body.replace(/\r?\n/g, '<br>');

  const clean = DOMPurify.sanitize(withBreaks, {
    ALLOWED_TAGS: [
      'a',
      'b',
      'strong',
      'i',
      'em',
      'u',
      's',
      'br',
      'p',
      'span',
      'code',
      'pre',
      'ul',
      'ol',
      'li',
      'blockquote',
    ],
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
    KEEP_CONTENT: true,
  });

  return sanitizeHtml(clean);
}

function parseHash(): { query: string; selectedNoteId: number | null } {
  const rawHash = window.location.hash;
  const hash = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
  if (!hash) {
    return { query: '', selectedNoteId: null };
  }
  const params = new URLSearchParams(hash);
  const q = params.get('q') ?? '';
  const noteParam = params.get('note');
  const noteId =
    noteParam !== null && noteParam !== '' && !isNaN(Number(noteParam))
      ? Number(noteParam)
      : null;
  return { query: q, selectedNoteId: noteId };
}

function updateHash(q: string, noteId: number | null): void {
  const params = new URLSearchParams();
  if (q) {
    params.set('q', q);
  }
  if (noteId !== null) {
    params.set('note', String(noteId));
  }
  const str = params.toString();
  const newHash = str ? `#${str}` : '';
  const currentFullHash = window.location.hash;
  if (newHash !== currentFullHash) {
    history.replaceState(null, '', newHash || window.location.pathname);
  }
}

const noteForm = document.getElementById('note-form') as HTMLFormElement;
const titleInput = document.getElementById('title') as HTMLInputElement;
const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
const avatarInput = document.getElementById('avatar') as HTMLInputElement;
const searchInput = document.getElementById('search') as HTMLInputElement;
const resultsLine = document.getElementById('results-line') as HTMLParagraphElement;
const feedEl = document.getElementById('feed') as HTMLElement;

let notes: Note[] = loadNotes();
const initialHash = parseHash();
let query = initialHash.query;
let selectedNoteId = initialHash.selectedNoteId;
searchInput.value = query;

function render(): void {
  if (query) {
    resultsLine.textContent = `results for "${query}"`;
  } else {
    resultsLine.textContent = '';
  }

  const lowerQuery = query.toLowerCase();
  const filtered = notes.filter((n) => {
    if (!lowerQuery) return true;
    return (
      n.title.toLowerCase().includes(lowerQuery) ||
      n.body.toLowerCase().includes(lowerQuery)
    );
  });

  const sorted = [...filtered].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );

  feedEl.replaceChildren();

  if (sorted.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.className = 'empty-feed';
    emptyMsg.textContent = query
      ? 'No notes found matching your search.'
      : 'No notes yet. Add your first note above!';
    feedEl.appendChild(emptyMsg);
    return;
  }

  for (const note of sorted) {
    const article = document.createElement('article');
    article.className = 'note';
    article.setAttribute('data-note-id', String(note.id));

    if (selectedNoteId === note.id) {
      article.setAttribute('aria-current', 'true');
    }

    if (isValidAvatarUrl(note.avatar)) {
      const img = document.createElement('img');
      img.className = 'note-avatar';
      img.src = note.avatar!;
      img.alt = '';
      article.appendChild(img);
    }

    const contentDiv = document.createElement('div');
    contentDiv.className = 'note-content';

    const titleEl = document.createElement('h3');
    titleEl.className = 'note-title';
    titleEl.textContent = note.title;
    titleEl.setAttribute('role', 'button');
    titleEl.setAttribute('tabindex', '0');

    const handleSelect = () => {
      selectedNoteId = note.id;
      updateHash(query, selectedNoteId);
      render();
    };

    titleEl.addEventListener('click', handleSelect);
    titleEl.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSelect();
      }
    });
    contentDiv.appendChild(titleEl);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'note-body';
    const safeBody = sanitizeRichText(note.body);
    setElementInnerHtml(bodyEl, safeBody);
    contentDiv.appendChild(bodyEl);

    article.appendChild(contentDiv);
    feedEl.appendChild(article);
  }
}

noteForm.addEventListener('submit', (e: Event) => {
  e.preventDefault();
  const title = titleInput.value;
  const body = bodyInput.value;
  const avatar = avatarInput.value.trim();

  const maxId = notes.reduce((max, n) => Math.max(max, n.id), 0);
  const newNote: Note = {
    id: maxId + 1,
    title,
    body,
    avatar: avatar || undefined,
    createdAt: new Date().toISOString(),
  };

  notes.unshift(newNote);
  saveNotes(notes);

  titleInput.value = '';
  bodyInput.value = '';
  avatarInput.value = '';

  render();
});

searchInput.addEventListener('input', () => {
  query = searchInput.value;
  updateHash(query, selectedNoteId);
  render();
});

function syncFromHash(): void {
  const parsed = parseHash();
  let changed = false;
  if (parsed.query !== query) {
    query = parsed.query;
    searchInput.value = query;
    changed = true;
  }
  if (parsed.selectedNoteId !== selectedNoteId) {
    selectedNoteId = parsed.selectedNoteId;
    changed = true;
  }
  if (changed) {
    render();
  }
}

window.addEventListener('hashchange', syncFromHash);
window.addEventListener('popstate', syncFromHash);

render();
