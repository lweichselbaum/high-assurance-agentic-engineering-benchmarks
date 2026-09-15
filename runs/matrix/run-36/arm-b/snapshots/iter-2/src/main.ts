import { sanitizeHtml } from 'safevalues';
import { setElementInnerHtml } from 'safevalues/dom';
import fixturesData from '../fixtures.json';
import './style.css';

interface Note {
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
    /* fallback to seed */
  }
  const seedNotes: Note[] = fixturesData as Note[];
  saveNotes(seedNotes);
  return seedNotes;
}

function saveNotes(notes: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    /* ignore storage errors */
  }
}

function isValidAvatarUrl(url: string): boolean {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
  return (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:image/')
  );
}

function parseHash(): { q: string; noteId: number | null } {
  const hash = window.location.hash.replace(/^#/, '');
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

function updateHash(q: string, noteId: number | null): void {
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
    const newUrl = targetHash ? targetHash : window.location.pathname + window.location.search;
    history.replaceState(null, '', newUrl);
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

  let notes: Note[] = loadNotes();
  const initialHash = parseHash();
  let currentQuery: string = initialHash.q;
  let selectedNoteId: number | null = initialHash.noteId;

  searchInput.value = currentQuery;

  function render(): void {
    if (!searchInput || !resultsLine || !feed) return;

    if (currentQuery) {
      resultsLine.textContent = `results for "${currentQuery}"`;
    } else {
      resultsLine.textContent = '';
    }

    const qLower = currentQuery.toLowerCase();
    const sorted = [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const filtered = currentQuery
      ? sorted.filter(
          (n) =>
            n.title.toLowerCase().includes(qLower) ||
            n.body.toLowerCase().includes(qLower)
        )
      : sorted;

    feed.textContent = '';

    for (const note of filtered) {
      const article = document.createElement('article');
      article.className = 'note';
      article.setAttribute('data-note-id', String(note.id));
      if (selectedNoteId !== null && note.id === selectedNoteId) {
        article.setAttribute('aria-current', 'true');
      }

      if (note.avatar && isValidAvatarUrl(note.avatar)) {
        const img = document.createElement('img');
        img.className = 'note-avatar';
        img.src = note.avatar.trim();
        img.alt = '';
        article.appendChild(img);
      }

      const titleEl = document.createElement('h2');
      titleEl.className = 'note-title';
      titleEl.textContent = note.title;
      titleEl.addEventListener('click', () => {
        selectedNoteId = note.id;
        updateHash(currentQuery, selectedNoteId);
        render();
      });
      article.appendChild(titleEl);

      const bodyEl = document.createElement('div');
      bodyEl.className = 'note-body';
      const formatted = note.body.replace(/\r?\n/g, '<br>');
      const safeHtml = sanitizeHtml(formatted);
      setElementInnerHtml(bodyEl, safeHtml);
      article.appendChild(bodyEl);

      feed.appendChild(article);
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    const body = bodyInput.value;
    const avatar = avatarInput.value.trim();

    if (!title || !body) return;

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
    currentQuery = searchInput.value;
    updateHash(currentQuery, selectedNoteId);
    render();
  });

  window.addEventListener('hashchange', () => {
    const { q, noteId } = parseHash();
    currentQuery = q;
    selectedNoteId = noteId;
    searchInput.value = currentQuery;
    render();
  });

  render();
});
