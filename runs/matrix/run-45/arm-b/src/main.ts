import './style.css';
import seedFixtures from './fixtures.json';
import { sanitizeHtml } from 'safevalues';
import { setElementInnerHtml } from 'safevalues/dom';

export interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto_notes';

function isSafeAvatarUrl(url: string | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  // Reject dangerous protocols
  if (/^(javascript|vbscript|data|blob|file):/i.test(trimmed)) {
    // Only permit safe image MIME types for data URLs
    return /^data:image\/[a-zA-Z0-9+.-]+;(?:base64|utf8|charset=[^;,]+)?;?/i.test(trimmed);
  }

  // Allow http: and https: protocols
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  // Allow relative paths
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return true;
  }

  return false;
}

function parseFragment(): { query: string; noteId: number | null } {
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (!hash) {
    return { query: '', noteId: null };
  }
  const params = new URLSearchParams(hash);
  const query = params.get('q') ?? '';
  const noteParam = params.get('note');
  const noteId = noteParam !== null ? parseInt(noteParam, 10) : null;
  return {
    query,
    noteId: noteId !== null && !Number.isNaN(noteId) ? noteId : null,
  };
}

function updateFragment(query: string, noteId: number | null): void {
  const params = new URLSearchParams();
  if (query) {
    params.set('q', query);
  }
  if (noteId !== null) {
    params.set('note', String(noteId));
  }
  const str = params.toString();
  const target = str ? `#${str}` : window.location.pathname + window.location.search;
  window.history.replaceState(null, '', target);
}

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
    // ignore parse errors and fallback
  }
  const initial = [...seedFixtures] as Note[];
  saveNotes(initial);
  return initial;
}

function saveNotes(notesToSave: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notesToSave));
  } catch {
    // ignore storage errors
  }
}

function getFilteredNotes(allNotes: Note[], query: string): Note[] {
  if (!query) {
    return allNotes;
  }
  const q = query.toLowerCase();
  return allNotes.filter((note) => {
    const titleMatch = note.title.toLowerCase().includes(q);
    const bodyMatch = note.body.toLowerCase().includes(q);
    return titleMatch || bodyMatch;
  });
}

function initApp(): void {
  const feedEl = document.getElementById('feed');
  const formEl = document.getElementById('note-form') as HTMLFormElement | null;
  const titleInput = document.getElementById('title') as HTMLInputElement | null;
  const bodyInput = document.getElementById('body') as HTMLTextAreaElement | null;
  const avatarInput = document.getElementById('avatar') as HTMLInputElement | null;
  const searchInput = document.getElementById('search') as HTMLInputElement | null;
  const resultsLine = document.getElementById('results-line');

  if (!feedEl || !formEl || !titleInput || !bodyInput || !avatarInput || !searchInput || !resultsLine) {
    console.error('Required DOM elements missing for Porto Notes');
    return;
  }

  const notes: Note[] = loadNotes();
  const initialFragment = parseFragment();
  let currentQuery = initialFragment.query;
  let selectedNoteId: number | null = initialFragment.noteId;

  function updateResultsLine(query: string): void {
    if (query) {
      resultsLine!.textContent = `results for "${query}"`;
    } else {
      resultsLine!.textContent = '';
    }
  }

  function renderFeed(): void {
    const filtered = getFilteredNotes(notes, currentQuery);
    // Sort newest first
    filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const noteElements: HTMLElement[] = [];

    for (const note of filtered) {
      const article = document.createElement('article');
      article.className = 'note';
      article.dataset.noteId = String(note.id);

      if (selectedNoteId === note.id) {
        article.setAttribute('aria-current', 'true');
      }

      if (isSafeAvatarUrl(note.avatar)) {
        const img = document.createElement('img');
        img.className = 'note-avatar';
        img.src = note.avatar;
        img.alt = '';
        article.appendChild(img);
      }

      const contentDiv = document.createElement('div');
      contentDiv.className = 'note-content';

      const titleEl = document.createElement('h3');
      titleEl.className = 'note-title';
      titleEl.tabIndex = 0;
      titleEl.role = 'button';
      setElementInnerHtml(titleEl, sanitizeHtml(note.title));

      const handleSelect = (e: Event): void => {
        e.preventDefault();
        selectedNoteId = note.id;
        updateFragment(currentQuery, selectedNoteId);
        renderFeed();
      };

      titleEl.addEventListener('click', handleSelect);
      titleEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleSelect(e);
        }
      });

      contentDiv.appendChild(titleEl);

      const bodyEl = document.createElement('div');
      bodyEl.className = 'note-body';
      const formattedBody = note.body.replace(/\r?\n/g, '<br>');
      setElementInnerHtml(bodyEl, sanitizeHtml(formattedBody));
      contentDiv.appendChild(bodyEl);

      article.appendChild(contentDiv);
      noteElements.push(article);
    }

    feedEl!.replaceChildren(...noteElements);
  }

  // Search input handler
  searchInput.value = currentQuery;
  updateResultsLine(currentQuery);

  searchInput.addEventListener('input', () => {
    currentQuery = searchInput.value;
    updateResultsLine(currentQuery);
    updateFragment(currentQuery, selectedNoteId);
    renderFeed();
  });

  // Form submission handler
  formEl.addEventListener('submit', (e: Event) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    const body = bodyInput.value.trim();
    const avatar = avatarInput.value.trim();

    if (!title || !body) {
      return;
    }

    const nextId = notes.reduce((max, n) => (n.id > max ? n.id : max), 0) + 1;
    const newNote: Note = {
      id: nextId,
      title: titleInput.value,
      body: bodyInput.value,
      avatar,
      createdAt: new Date().toISOString(),
    };

    notes.unshift(newNote);
    saveNotes(notes);

    formEl.reset();
    titleInput.value = '';
    bodyInput.value = '';
    avatarInput.value = '';

    renderFeed();
  });

  // Sync with URL hash changes
  window.addEventListener('hashchange', () => {
    const { query, noteId } = parseFragment();
    currentQuery = query;
    selectedNoteId = noteId;
    searchInput.value = query;
    updateResultsLine(query);
    renderFeed();
  });

  // Initial render
  renderFeed();
}

// Start app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
