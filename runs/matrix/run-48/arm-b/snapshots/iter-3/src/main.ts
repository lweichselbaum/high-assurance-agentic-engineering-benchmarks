import DOMPurify from 'dompurify';
import { sanitizeHtml } from 'safevalues';
import { setElementInnerHtml } from 'safevalues/dom';
import seedNotes from '../fixtures.json';
import './style.css';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto_notes';

function loadNotes(): Note[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed as Note[];
      }
    } catch {
      // Fallback to seed notes on JSON error
    }
  }
  const initial: Note[] = (seedNotes as Note[]).map((n) => ({ ...n }));
  saveNotes(initial);
  return initial;
}

function saveNotes(notesToSave: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notesToSave));
  } catch {
    // Storage errors handled gracefully
  }
}

function isValidAvatarUrl(url: string | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  // Reject javascript: scheme
  if (/^\s*javascript:/i.test(trimmed)) return false;

  // Allowed safe data:image/ URIs
  if (/^data:image\/(?:svg\+xml|png|jpeg|jpg|gif|webp)(?:;charset=[^;,]+)?(?:;base64)?,/i.test(trimmed)) {
    if (/javascript:/i.test(trimmed)) return false;
    return true;
  }

  // Allowed http: and https: protocols
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

function renderNoteBody(bodyEl: HTMLElement, rawBody: string): void {
  const withLineBreaks = rawBody.replace(/\r\n|\r|\n/g, '<br>');
  const cleanHtml = DOMPurify.sanitize(withLineBreaks, {
    ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'a', 'br'],
    ALLOWED_ATTR: ['href', 'title'],
    ALLOW_DATA_ATTR: false,
  });
  const safeHtml = sanitizeHtml(cleanHtml);
  setElementInnerHtml(bodyEl, safeHtml);
}

function parseFragment(): { q: string; noteId: number | null } {
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (!hash) {
    return { q: '', noteId: null };
  }
  const params = new URLSearchParams(hash);
  const q = params.get('q') ?? '';
  const noteStr = params.get('note');
  const noteId = noteStr !== null && !isNaN(Number(noteStr)) ? Number(noteStr) : null;
  return { q, noteId };
}

function updateFragment(q: string, noteId: number | null): void {
  const params = new URLSearchParams();
  if (q) {
    params.set('q', q);
  }
  if (noteId !== null) {
    params.set('note', String(noteId));
  }
  const str = params.toString();
  const target = str ? '#' + str : window.location.pathname + window.location.search;
  const current = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (current !== str) {
    history.replaceState(null, '', target);
  }
}

let notes: Note[] = [];
let searchQuery = '';
let selectedNoteId: number | null = null;

function noteMatchesQuery(note: Note, query: string): boolean {
  if (!query) return true;
  const lowerQ = query.toLowerCase();
  return (
    note.title.toLowerCase().includes(lowerQ) ||
    note.body.toLowerCase().includes(lowerQ)
  );
}

function selectNote(id: number): void {
  selectedNoteId = id;
  const feed = document.getElementById('feed');
  if (feed) {
    const articles = feed.querySelectorAll<HTMLElement>('article.note');
    for (const art of articles) {
      if (art.dataset.noteId === String(id)) {
        art.setAttribute('aria-current', 'true');
      } else {
        art.removeAttribute('aria-current');
      }
    }
  }
  updateFragment(searchQuery, selectedNoteId);
}

function handleSearch(query: string, syncUrl: boolean = true): void {
  searchQuery = query;

  const resultsLine = document.getElementById('results-line');
  if (resultsLine) {
    resultsLine.textContent = query ? `results for "${query}"` : '';
  }

  const feed = document.getElementById('feed');
  if (feed) {
    const articles = feed.querySelectorAll<HTMLElement>('article.note');
    for (const art of articles) {
      const id = Number(art.dataset.noteId);
      const note = notes.find((n) => n.id === id);
      if (note) {
        const visible = noteMatchesQuery(note, query);
        art.style.display = visible ? '' : 'none';
      }
    }
  }

  if (syncUrl) {
    updateFragment(searchQuery, selectedNoteId);
  }
}

function renderFeed(): void {
  const feed = document.getElementById('feed');
  if (!feed) return;

  feed.replaceChildren();

  const sorted = [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  for (const note of sorted) {
    const article = document.createElement('article');
    article.className = 'note';
    article.setAttribute('data-note-id', String(note.id));

    if (selectedNoteId === note.id) {
      article.setAttribute('aria-current', 'true');
    }

    const header = document.createElement('div');
    header.className = 'note-header';

    if (isValidAvatarUrl(note.avatar)) {
      const avatarImg = document.createElement('img');
      avatarImg.className = 'note-avatar';
      avatarImg.src = note.avatar.trim();
      avatarImg.alt = '';
      header.appendChild(avatarImg);
    }

    const titleEl = document.createElement('h3');
    titleEl.className = 'note-title';
    titleEl.textContent = note.title;
    titleEl.setAttribute('role', 'button');
    titleEl.setAttribute('tabindex', '0');

    titleEl.addEventListener('click', () => {
      selectNote(note.id);
    });
    titleEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectNote(note.id);
      }
    });

    header.appendChild(titleEl);
    article.appendChild(header);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'note-body';
    renderNoteBody(bodyEl, note.body);
    article.appendChild(bodyEl);

    if (!noteMatchesQuery(note, searchQuery)) {
      article.style.display = 'none';
    }

    feed.appendChild(article);
  }
}

function syncFromFragment(): void {
  const { q, noteId } = parseFragment();
  searchQuery = q;
  selectedNoteId = noteId;

  const searchInput = document.getElementById('search') as HTMLInputElement | null;
  if (searchInput) {
    searchInput.value = q;
  }

  handleSearch(q, false);

  const feed = document.getElementById('feed');
  if (feed) {
    const articles = feed.querySelectorAll<HTMLElement>('article.note');
    for (const art of articles) {
      if (selectedNoteId !== null && art.dataset.noteId === String(selectedNoteId)) {
        art.setAttribute('aria-current', 'true');
      } else {
        art.removeAttribute('aria-current');
      }
    }
  }
}

function initForm(): void {
  const form = document.getElementById('note-form') as HTMLFormElement | null;
  const titleInput = document.getElementById('title') as HTMLInputElement | null;
  const bodyInput = document.getElementById('body') as HTMLTextAreaElement | null;
  const avatarInput = document.getElementById('avatar') as HTMLInputElement | null;

  if (!form || !titleInput || !bodyInput || !avatarInput) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const title = titleInput.value;
    const body = bodyInput.value;
    const avatar = avatarInput.value;

    const maxId = notes.reduce((max, n) => Math.max(max, n.id), 0);
    const newNote: Note = {
      id: maxId + 1,
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

function initSearch(): void {
  const searchInput = document.getElementById('search') as HTMLInputElement | null;
  if (!searchInput) return;

  searchInput.addEventListener('input', () => {
    handleSearch(searchInput.value, true);
  });
}

function initApp(): void {
  notes = loadNotes();
  initForm();
  initSearch();
  renderFeed();
  syncFromFragment();

  window.addEventListener('hashchange', () => {
    syncFromFragment();
  });
  window.addEventListener('popstate', () => {
    syncFromFragment();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
