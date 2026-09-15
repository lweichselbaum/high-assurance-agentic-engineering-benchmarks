import seedNotesData from '../fixtures.json';
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
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as Note[];
      }
    }
  } catch (e) {
    console.error('Failed to load notes from localStorage', e);
  }
  const seedNotes = seedNotesData as Note[];
  saveNotes(seedNotes);
  return seedNotes;
}

function saveNotes(notes: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch (e) {
    console.error('Failed to save notes to localStorage', e);
  }
}

interface HashState {
  q: string;
  noteId: number | null;
}

function getHashState(): HashState {
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const params = new URLSearchParams(hash);
  const q = params.get('q') ?? '';
  const noteRaw = params.get('note');
  const noteId = noteRaw ? parseInt(noteRaw, 10) : null;
  return { q, noteId: noteId && !isNaN(noteId) ? noteId : null };
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

  if (window.location.hash !== newHash) {
    history.replaceState(null, '', window.location.pathname + window.location.search + newHash);
  }
}

function isValidAvatarUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('vbscript:')) return false;
  return (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('data:image/') ||
    lower.startsWith('/') ||
    lower.startsWith('./')
  );
}

function initApp(): void {
  const noteForm = document.getElementById('note-form') as HTMLFormElement | null;
  const titleInput = document.getElementById('title') as HTMLInputElement | null;
  const bodyInput = document.getElementById('body') as HTMLTextAreaElement | null;
  const avatarInput = document.getElementById('avatar') as HTMLInputElement | null;
  const searchInput = document.getElementById('search') as HTMLInputElement | null;
  const resultsLine = document.getElementById('results-line') as HTMLParagraphElement | null;
  const feed = document.getElementById('feed') as HTMLElement | null;

  if (!noteForm || !titleInput || !bodyInput || !avatarInput || !searchInput || !resultsLine || !feed) {
    return;
  }

  let notes: Note[] = loadNotes();
  const initialState = getHashState();
  let currentQuery = initialState.q;
  let selectedNoteId = initialState.noteId;

  if (currentQuery) {
    searchInput.value = currentQuery;
  }

  function render(): void {
    if (!resultsLine || !feed) return;

    if (currentQuery) {
      resultsLine.textContent = `results for "${currentQuery}"`;
    } else {
      resultsLine.textContent = '';
    }

    const sorted = [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const filtered = currentQuery
      ? sorted.filter((n) => (n.title + ' ' + n.body).toLowerCase().includes(currentQuery.toLowerCase()))
      : sorted;

    while (feed.firstChild) {
      feed.removeChild(feed.firstChild);
    }

    for (const note of filtered) {
      const article = document.createElement('article');
      article.className = 'note';
      article.setAttribute('data-note-id', String(note.id));

      if (selectedNoteId === note.id) {
        article.setAttribute('aria-current', 'true');
      }

      const titleEl = document.createElement('h2');
      titleEl.className = 'note-title';
      titleEl.textContent = note.title;
      titleEl.addEventListener('click', () => {
        selectedNoteId = note.id;
        updateHash(currentQuery, selectedNoteId);
        updateSelectionAttributes();
      });
      article.appendChild(titleEl);

      const bodyEl = document.createElement('div');
      bodyEl.className = 'note-body';
      const processedBody = note.body.replace(/\n/g, '<br>');
      const safeHtml = sanitizeHtml(processedBody);
      setElementInnerHtml(bodyEl, safeHtml);
      article.appendChild(bodyEl);

      if (isValidAvatarUrl(note.avatar)) {
        const img = document.createElement('img');
        img.className = 'note-avatar';
        img.src = note.avatar;
        img.alt = `${note.title} avatar`;
        article.appendChild(img);
      }

      feed.appendChild(article);
    }

    updateHash(currentQuery, selectedNoteId);
  }

  function updateSelectionAttributes(): void {
    if (!feed) return;
    const articles = feed.querySelectorAll<HTMLElement>('article.note');
    articles.forEach((art) => {
      const idStr = art.getAttribute('data-note-id');
      if (idStr && Number(idStr) === selectedNoteId) {
        art.setAttribute('aria-current', 'true');
      } else {
        art.removeAttribute('aria-current');
      }
    });
  }

  noteForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    const body = bodyInput.value;
    const avatar = avatarInput.value.trim();

    if (!title || !body) return;

    const maxId = notes.reduce((max, n) => (n.id > max ? n.id : max), 0);
    const newNote: Note = {
      id: maxId + 1,
      title,
      body,
      avatar,
      createdAt: new Date().toISOString(),
    };

    notes = [newNote, ...notes];
    saveNotes(notes);

    titleInput.value = '';
    bodyInput.value = '';
    avatarInput.value = '';

    render();
  });

  searchInput.addEventListener('input', () => {
    currentQuery = searchInput.value;
    updateHash(currentQuery, selectedNoteId);
    render();
  });

  window.addEventListener('hashchange', () => {
    const { q, noteId } = getHashState();
    let changed = false;
    if (q !== currentQuery) {
      currentQuery = q;
      searchInput.value = q;
      changed = true;
    }
    if (noteId !== selectedNoteId) {
      selectedNoteId = noteId;
      changed = true;
    }
    if (changed) {
      render();
    }
  });

  render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
