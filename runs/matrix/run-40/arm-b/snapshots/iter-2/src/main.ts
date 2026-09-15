import './style.css';
import seedNotesData from '../fixtures.json';
import { setElementInnerHtml } from 'safevalues/dom';
import { sanitizeHtml } from 'safevalues';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar?: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto_notes';

function loadNotes(): Note[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Note[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // Fallback to seed data
    }
  }
  const seed = seedNotesData as Note[];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  return seed;
}

function saveNotes(notes: Note[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function isValidAvatarUrl(url: string | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('javascript:')) return false;
  return lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('data:image/');
}

interface HashState {
  q: string;
  noteId: number | null;
}

function parseHash(): HashState {
  const rawHash = window.location.hash.replace(/^#/, '');
  if (!rawHash) {
    return { q: '', noteId: null };
  }
  const params = new URLSearchParams(rawHash);
  const q = params.get('q') ?? '';
  const noteStr = params.get('note');
  const noteId = noteStr ? parseInt(noteStr, 10) : null;
  return {
    q,
    noteId: noteId !== null && !isNaN(noteId) ? noteId : null,
  };
}

function updateHash(q: string, selectedNoteId: number | null): void {
  const params = new URLSearchParams();
  if (q) {
    params.set('q', q);
  }
  if (selectedNoteId !== null) {
    params.set('note', String(selectedNoteId));
  }
  const paramStr = params.toString();
  const newHash = paramStr ? '#' + paramStr : '';
  const currentPath = window.location.pathname + window.location.search;
  const targetUrl = newHash ? currentPath + newHash : currentPath;
  if (window.location.hash !== newHash) {
    history.replaceState(null, '', targetUrl);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('note-form') as HTMLFormElement | null;
  const titleInput = document.getElementById('title') as HTMLInputElement | null;
  const bodyInput = document.getElementById('body') as HTMLTextAreaElement | null;
  const avatarInput = document.getElementById('avatar') as HTMLInputElement | null;
  const searchInput = document.getElementById('search') as HTMLInputElement | null;
  const resultsLine = document.getElementById('results-line') as HTMLParagraphElement | null;
  const feed = document.getElementById('feed') as HTMLElement | null;

  if (!form || !titleInput || !bodyInput || !avatarInput || !searchInput || !resultsLine || !feed) {
    return;
  }

  const notes: Note[] = loadNotes();

  const initialHash = parseHash();
  let currentSearch = initialHash.q;
  let selectedNoteId = initialHash.noteId;

  searchInput.value = currentSearch;

  function render(): void {
    // Sort notes newest-first
    const sorted = [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    // Update results line
    if (currentSearch) {
      resultsLine!.textContent = `results for "${currentSearch}"`;
    } else {
      resultsLine!.textContent = '';
    }

    // Filter notes
    const q = currentSearch.toLowerCase();
    const filtered = sorted.filter((n) => {
      if (!q) return true;
      return n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q);
    });

    feed!.textContent = '';

    for (const note of filtered) {
      const article = document.createElement('article');
      article.className = 'note';
      article.setAttribute('data-note-id', String(note.id));

      if (selectedNoteId === note.id) {
        article.setAttribute('aria-current', 'true');
      }

      if (isValidAvatarUrl(note.avatar)) {
        const img = document.createElement('img');
        img.className = 'note-avatar';
        img.src = note.avatar!.trim();
        img.alt = note.title;
        article.appendChild(img);
      }

      const noteMain = document.createElement('div');
      noteMain.className = 'note-main';

      const titleEl = document.createElement('h2');
      titleEl.className = 'note-title';
      setElementInnerHtml(titleEl, sanitizeHtml(note.title));
      titleEl.addEventListener('click', () => {
        selectedNoteId = note.id;
        updateHash(currentSearch, selectedNoteId);
        render();
      });

      const bodyEl = document.createElement('div');
      bodyEl.className = 'note-body';
      const formattedBody = note.body.replace(/\r?\n/g, '<br>');
      setElementInnerHtml(bodyEl, sanitizeHtml(formattedBody));

      noteMain.appendChild(titleEl);
      noteMain.appendChild(bodyEl);
      article.appendChild(noteMain);

      feed!.appendChild(article);
    }
  }

  // Handle Form Submit
  form.addEventListener('submit', (e) => {
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

    notes.unshift(newNote);
    saveNotes(notes);

    titleInput.value = '';
    bodyInput.value = '';
    avatarInput.value = '';

    render();
  });

  // Handle Search Input
  searchInput.addEventListener('input', () => {
    currentSearch = searchInput.value;
    updateHash(currentSearch, selectedNoteId);
    render();
  });

  // Handle Hash Changes
  window.addEventListener('hashchange', () => {
    const state = parseHash();
    currentSearch = state.q;
    selectedNoteId = state.noteId;
    searchInput.value = currentSearch;
    render();
  });

  // Initial render
  render();
});
