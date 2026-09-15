import './style.css';
import defaultFixtures from '../fixtures.json';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

let notes: Note[] = [];
let searchQuery = '';
let selectedNoteId: number | null = null;

const formEl = document.getElementById('note-form') as HTMLFormElement;
const titleInput = document.getElementById('title') as HTMLInputElement;
const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
const avatarInput = document.getElementById('avatar') as HTMLInputElement;
const searchInput = document.getElementById('search') as HTMLInputElement;
const resultsLineEl = document.getElementById('results-line') as HTMLElement;
const feedEl = document.getElementById('feed') as HTMLElement;

function loadNotes(): Note[] {
  const saved = localStorage.getItem('porto_notes');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (e) {
      console.error('Error parsing notes from localStorage', e);
    }
  }
  // Initialize with fixtures
  localStorage.setItem('porto_notes', JSON.stringify(defaultFixtures));
  return defaultFixtures;
}

function saveNotes() {
  localStorage.setItem('porto_notes', JSON.stringify(notes));
}

function parseHash(): { query: string; noteId: number | null } {
  const hash = location.hash.replace(/^#/, '');
  const params = new URLSearchParams(hash);
  const q = params.get('q') ?? '';
  const noteStr = params.get('note');
  const noteId = noteStr ? parseInt(noteStr, 10) : null;
  return {
    query: q,
    noteId: noteId !== null && !isNaN(noteId) ? noteId : null,
  };
}

function updateHash(query: string, noteId: number | null) {
  const params = new URLSearchParams();
  if (query.trim()) {
    params.set('q', query);
  }
  if (noteId !== null) {
    params.set('note', String(noteId));
  }
  const newHash = params.toString() ? `#${params.toString()}` : '';
  if (location.hash !== newHash) {
    history.replaceState(null, '', newHash || window.location.pathname);
  }
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderBody(text: string): string {
  if (!text) return '';
  // Convert newlines to <br>
  let html = text.replace(/\r?\n/g, '<br>');
  const div = document.createElement('div');
  div.innerHTML = html;
  div.querySelectorAll('a').forEach((a) => {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  });
  return div.innerHTML;
}

function render() {
  // Filter notes
  const query = searchQuery.toLowerCase().trim();
  const filtered = notes.filter((note) => {
    if (!query) return true;
    return (
      note.title.toLowerCase().includes(query) ||
      note.body.toLowerCase().includes(query)
    );
  });

  // Sort newest first (by createdAt desc, fallback to id desc)
  filtered.sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    if (timeA !== timeB) return timeB - timeA;
    return b.id - a.id;
  });

  // Render results line
  if (searchQuery.trim()) {
    resultsLineEl.textContent = `results for "${searchQuery}"`;
  } else {
    resultsLineEl.textContent = '';
  }

  // Render feed
  if (filtered.length === 0) {
    feedEl.innerHTML = `<div class="empty-state">No notes found matching "${escapeHtml(searchQuery)}"</div>`;
    return;
  }

  feedEl.innerHTML = filtered
    .map((note) => {
      const isSelected = note.id === selectedNoteId;
      const avatarHtml = note.avatar
        ? `<img class="note-avatar" src="${escapeHtml(note.avatar)}" alt="Author avatar" />`
        : '';
      return `
        <article class="note" data-note-id="${note.id}" ${isSelected ? 'aria-current="true"' : ''}>
          ${avatarHtml}
          <div class="note-content">
            <h3 class="note-title">${escapeHtml(note.title)}</h3>
            <div class="note-body">${renderBody(note.body)}</div>
            <div class="note-meta">${new Date(note.createdAt).toLocaleString()}</div>
          </div>
        </article>
      `;
    })
    .join('');
}

// Event Listeners
formEl.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
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

  notes.push(newNote);
  saveNotes();
  formEl.reset();

  selectedNoteId = newNote.id;
  updateHash(searchQuery, selectedNoteId);
  render();
});

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value;
  updateHash(searchQuery, selectedNoteId);
  render();
});

feedEl.addEventListener('click', (e) => {
  const noteEl = (e.target as HTMLElement).closest('article.note');
  if (noteEl) {
    const idStr = noteEl.getAttribute('data-note-id');
    if (idStr) {
      selectedNoteId = parseInt(idStr, 10);
      updateHash(searchQuery, selectedNoteId);
      render();
    }
  }
});

window.addEventListener('hashchange', () => {
  const { query, noteId } = parseHash();
  searchQuery = query;
  selectedNoteId = noteId;
  searchInput.value = query;
  render();
});

// Initialization
function init() {
  notes = loadNotes();
  const initialHash = parseHash();
  searchQuery = initialHash.query;
  selectedNoteId = initialHash.noteId;
  searchInput.value = searchQuery;
  render();
}

init();
