import './style.css';
import seedNotes from '../fixtures.json';
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

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed as Note[];
      }
    }
  } catch (err) {
    console.error('Failed to load notes from localStorage', err);
  }
  const initial = (seedNotes as Note[]).slice();
  saveNotes(initial);
  return initial;
}

function saveNotes(notes: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch (err) {
    console.error('Failed to save notes to localStorage', err);
  }
}

function isValidAvatarUrl(url: string | undefined | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (/javascript:/i.test(trimmed)) return false;
  if (trimmed.startsWith('data:image/')) return true;
  try {
    const parsed = new URL(trimmed, window.location.origin);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function parseUrlHash(): { query: string; noteId: number | null } {
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (!hash) return { query: '', noteId: null };
  const params = new URLSearchParams(hash);
  const query = params.get('q') ?? '';
  const noteStr = params.get('note');
  let noteId: number | null = null;
  if (noteStr !== null && noteStr !== '') {
    const parsedId = parseInt(noteStr, 10);
    if (!Number.isNaN(parsedId)) {
      noteId = parsedId;
    }
  }
  return { query, noteId };
}

function updateUrlHash(query: string, selectedNoteId: number | null): void {
  const params = new URLSearchParams();
  if (query) {
    params.set('q', query);
  }
  if (selectedNoteId !== null) {
    params.set('note', String(selectedNoteId));
  }
  const hashStr = params.toString();
  const newHash = hashStr ? '#' + hashStr : '';
  const currentHash = window.location.hash;
  if (currentHash !== newHash && !(currentHash === '' && newHash === '')) {
    if (newHash) {
      window.history.replaceState(null, '', newHash);
    } else {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }
}

function initApp(): void {
  const formEl = document.getElementById('note-form') as HTMLFormElement | null;
  const titleInput = document.getElementById('title') as HTMLInputElement | null;
  const bodyInput = document.getElementById('body') as HTMLTextAreaElement | null;
  const avatarInput = document.getElementById('avatar') as HTMLInputElement | null;
  const searchInput = document.getElementById('search') as HTMLInputElement | null;
  const resultsLineEl = document.getElementById('results-line') as HTMLElement | null;
  const feedEl = document.getElementById('feed') as HTMLElement | null;

  if (!formEl || !titleInput || !bodyInput || !avatarInput || !searchInput || !resultsLineEl || !feedEl) {
    console.error('Porto Notes: Required DOM elements missing');
    return;
  }

  const notes: Note[] = loadNotes();
  const initialHash = parseUrlHash();
  let currentQuery = initialHash.query;
  let selectedNoteId: number | null = initialHash.noteId;

  searchInput.value = currentQuery;

  function updateSelectionInDOM(): void {
    if (!feedEl) return;
    const noteArticles = feedEl.querySelectorAll<HTMLElement>('article.note');
    for (const art of noteArticles) {
      const id = Number(art.getAttribute('data-note-id'));
      if (selectedNoteId !== null && id === selectedNoteId) {
        art.setAttribute('aria-current', 'true');
      } else {
        art.removeAttribute('aria-current');
      }
    }
  }

  function updateSearchFilter(): void {
    if (!feedEl || !resultsLineEl) return;
    if (currentQuery) {
      resultsLineEl.textContent = `results for "${currentQuery}"`;
    } else {
      resultsLineEl.textContent = '';
    }

    const q = currentQuery.toLowerCase();
    const noteArticles = feedEl.querySelectorAll<HTMLElement>('article.note');
    for (const art of noteArticles) {
      const id = Number(art.getAttribute('data-note-id'));
      const note = notes.find((n) => n.id === id);
      if (!note) continue;
      const matches = !q ||
        note.title.toLowerCase().includes(q) ||
        note.body.toLowerCase().includes(q);
      art.style.display = matches ? '' : 'none';
    }
  }

  function renderFeed(): void {
    if (!feedEl) return;
    feedEl.replaceChildren();

    const sortedNotes = [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const q = currentQuery.toLowerCase();

    for (const note of sortedNotes) {
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
        avatarImg.alt = `${note.title} avatar`;
        header.appendChild(avatarImg);
      }

      const titleEl = document.createElement('h3');
      titleEl.className = 'note-title';
      titleEl.textContent = note.title;
      titleEl.tabIndex = 0;
      titleEl.role = 'button';
      titleEl.setAttribute('aria-label', `Select note: ${note.title}`);

      const selectHandler = () => {
        selectedNoteId = note.id;
        updateSelectionInDOM();
        updateUrlHash(currentQuery, selectedNoteId);
      };

      titleEl.addEventListener('click', selectHandler);
      titleEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectHandler();
        }
      });

      header.appendChild(titleEl);
      article.appendChild(header);

      const bodyEl = document.createElement('div');
      bodyEl.className = 'note-body';
      const formattedBody = note.body.replace(/\r?\n/g, '<br>');
      setElementInnerHtml(bodyEl, sanitizeHtml(formattedBody));
      article.appendChild(bodyEl);

      const matches = !q ||
        note.title.toLowerCase().includes(q) ||
        note.body.toLowerCase().includes(q);

      if (!matches) {
        article.style.display = 'none';
      }

      feedEl.appendChild(article);
    }
  }

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = titleInput.value;
    const body = bodyInput.value;
    const avatar = avatarInput.value.trim();

    if (!title && !body) return;

    const nextId = notes.reduce((max, n) => Math.max(max, typeof n.id === 'number' ? n.id : 0), 0) + 1;
    const newNote: Note = {
      id: nextId,
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
    updateSearchFilter();
  });

  searchInput.addEventListener('input', () => {
    currentQuery = searchInput.value;
    updateSearchFilter();
    updateUrlHash(currentQuery, selectedNoteId);
  });

  window.addEventListener('popstate', () => {
    const hash = parseUrlHash();
    currentQuery = hash.query;
    selectedNoteId = hash.noteId;
    searchInput.value = currentQuery;
    updateSearchFilter();
    updateSelectionInDOM();
  });

  renderFeed();
  updateSearchFilter();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
