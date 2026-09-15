import { sanitizeHtml } from 'safevalues';
import { setElementInnerHtml } from 'safevalues/dom';
import fixturesData from '../fixtures.json';

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
      const parsed = JSON.parse(raw) as Note[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Ignore storage errors and fall back to seed
  }
  const seed: Note[] = fixturesData as Note[];
  saveNotes(seed);
  return seed;
}

function saveNotes(notes: Note[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function getNextId(notes: Note[]): number {
  if (notes.length === 0) return 1;
  const maxId = Math.max(...notes.map((n) => n.id));
  return maxId + 1;
}

function isValidAvatarUrl(url: string | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  return /^(https?:|data:image\/)/i.test(trimmed);
}

function parseHash(): { query: string; selectedNoteId: number | null } {
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  const params = new URLSearchParams(hash);
  const query = params.get('q') ?? '';
  const noteStr = params.get('note');
  let selectedNoteId: number | null = null;
  if (noteStr && /^\d+$/.test(noteStr)) {
    selectedNoteId = parseInt(noteStr, 10);
  }
  return { query, selectedNoteId };
}

function updateHash(query: string, selectedNoteId: number | null): void {
  const params = new URLSearchParams();
  if (query) {
    params.set('q', query);
  }
  if (selectedNoteId !== null) {
    params.set('note', String(selectedNoteId));
  }
  const str = params.toString();
  const newHash = str ? `#${str}` : '';

  if (window.location.hash !== newHash) {
    history.replaceState(null, '', newHash || window.location.pathname + window.location.search);
  }
}

// State
const notes: Note[] = loadNotes();
const initialHash = parseHash();
let currentQuery: string = initialHash.query;
let selectedNoteId: number | null = initialHash.selectedNoteId;

// DOM Elements
const form = document.getElementById('note-form') as HTMLFormElement;
const titleInput = document.getElementById('title') as HTMLInputElement;
const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
const avatarInput = document.getElementById('avatar') as HTMLInputElement;
const searchInput = document.getElementById('search') as HTMLInputElement;
const resultsLine = document.getElementById('results-line') as HTMLParagraphElement;
const feedSection = document.getElementById('feed') as HTMLElement;

searchInput.value = currentQuery;

function updateResultsLine(): void {
  if (currentQuery) {
    resultsLine.textContent = `results for "${currentQuery}"`;
  } else {
    resultsLine.textContent = '';
  }
}

function prepareBodyHtml(rawBody: string): string {
  return rawBody.replace(/\r\n/g, '\n').replace(/\n/g, '<br>');
}

function renderFeed(): void {
  feedSection.textContent = '';

  const sortedNotes = [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const q = currentQuery.trim().toLowerCase();
  const filteredNotes = q
    ? sortedNotes.filter(
        (note) =>
          note.title.toLowerCase().includes(q) || note.body.toLowerCase().includes(q)
      )
    : sortedNotes;

  for (const note of filteredNotes) {
    const article = document.createElement('article');
    article.className = 'note';
    article.setAttribute('data-note-id', String(note.id));

    if (note.id === selectedNoteId) {
      article.setAttribute('aria-current', 'true');
    }

    const header = document.createElement('div');
    header.className = 'note-header';

    if (isValidAvatarUrl(note.avatar)) {
      const img = document.createElement('img');
      img.className = 'note-avatar';
      img.src = note.avatar!.trim();
      img.alt = '';
      header.appendChild(img);
    }

    const titleEl = document.createElement('h2');
    titleEl.className = 'note-title';
    titleEl.textContent = note.title;
    titleEl.addEventListener('click', () => {
      selectedNoteId = note.id;
      updateHash(currentQuery, selectedNoteId);
      renderFeed();
    });
    header.appendChild(titleEl);

    article.appendChild(header);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'note-body';
    const safeBody = sanitizeHtml(prepareBodyHtml(note.body));
    setElementInnerHtml(bodyEl, safeBody);

    article.appendChild(bodyEl);

    feedSection.appendChild(article);
  }
}

// Event Listeners
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value;
  const avatar = avatarInput.value.trim();

  if (!title || !body) {
    return;
  }

  const newNote: Note = {
    id: getNextId(notes),
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

  renderFeed();
});

searchInput.addEventListener('input', () => {
  currentQuery = searchInput.value;
  updateHash(currentQuery, selectedNoteId);
  updateResultsLine();
  renderFeed();
});

window.addEventListener('hashchange', () => {
  const { query, selectedNoteId: newSelectedNoteId } = parseHash();
  currentQuery = query;
  selectedNoteId = newSelectedNoteId;
  searchInput.value = currentQuery;
  updateResultsLine();
  renderFeed();
});

// Initial render
updateResultsLine();
renderFeed();
