// Porto Notes — shared notes board
import './style.css';
import fixtures from '../fixtures.json';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto-notes';
let notes: Note[] = [];
let nextId = 1;
let currentQuery = '';
let selectedNoteId: number | null = null;

// Get DOM elements
const noteForm = document.getElementById('note-form') as HTMLFormElement;
const titleInput = document.getElementById('title') as HTMLInputElement;
const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
const avatarInput = document.getElementById('avatar') as HTMLInputElement;
const searchInput = document.getElementById('search') as HTMLInputElement;
const resultsLine = document.getElementById('results-line') as HTMLParagraphElement;
const feed = document.getElementById('feed') as HTMLElement;

// Load notes from localStorage or seed with fixtures
function loadNotes(): void {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    notes = JSON.parse(stored);
    if (notes.length > 0) {
      nextId = Math.max(...notes.map(n => n.id)) + 1;
    }
  } else {
    // Seed with fixtures on first load
    notes = fixtures as Note[];
    if (notes.length > 0) {
      nextId = Math.max(...notes.map(n => n.id)) + 1;
    }
    saveNotes();
  }
}

// Save notes to localStorage
function saveNotes(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

// Parse and sanitize rich text body
function renderRichText(text: string): string {
  // Escape all HTML first
  let safe = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // Convert newlines to <br>
  safe = safe.replace(/\n/g, '<br>');

  // Re-allow specific safe tags
  safe = safe.replace(/&lt;b&gt;/g, '<b>');
  safe = safe.replace(/&lt;\/b&gt;/g, '</b>');
  safe = safe.replace(/&lt;strong&gt;/g, '<strong>');
  safe = safe.replace(/&lt;\/strong&gt;/g, '</strong>');
  safe = safe.replace(/&lt;i&gt;/g, '<i>');
  safe = safe.replace(/&lt;\/i&gt;/g, '</i>');
  safe = safe.replace(/&lt;em&gt;/g, '<em>');
  safe = safe.replace(/&lt;\/em&gt;/g, '</em>');
  safe = safe.replace(/&lt;br&gt;/g, '<br>');
  safe = safe.replace(/&lt;br\/&gt;/g, '<br>');
  safe = safe.replace(/&lt;br \/&gt;/g, '<br>');

  // Handle anchor tags with href attribute
  safe = safe.replace(
    /&lt;a\s+href=&quot;([^&"]+)&quot;&gt;/g,
    '<a href="$1">'
  );
  safe = safe.replace(/&lt;\/a&gt;/g, '</a>');

  return safe;
}

// Filter notes based on search query
function filterNotes(): Note[] {
  if (!currentQuery) {
    return notes;
  }
  const query = currentQuery.toLowerCase();
  return notes.filter(note =>
    note.title.toLowerCase().includes(query) ||
    note.body.toLowerCase().includes(query)
  );
}

// Render the notes feed
function renderFeed(): void {
  const filtered = filterNotes();

  // Update results line
  if (currentQuery) {
    resultsLine.textContent = `results for "${currentQuery}"`;
  } else {
    resultsLine.textContent = '';
  }

  // Render notes newest-first
  const sorted = [...filtered].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  feed.innerHTML = '';
  sorted.forEach(note => {
    const article = document.createElement('article');
    article.className = 'note';
    article.setAttribute('data-note-id', String(note.id));

    if (selectedNoteId === note.id) {
      article.setAttribute('aria-current', 'true');
    }

    // Avatar
    if (note.avatar) {
      const avatar = document.createElement('img');
      avatar.className = 'note-avatar';
      avatar.src = note.avatar;
      avatar.alt = '';
      article.appendChild(avatar);
    }

    // Title
    const title = document.createElement('h2');
    title.className = 'note-title';
    title.textContent = note.title;
    title.style.cursor = 'pointer';
    title.addEventListener('click', () => selectNote(note.id));
    article.appendChild(title);

    // Body
    const body = document.createElement('div');
    body.className = 'note-body';
    body.innerHTML = renderRichText(note.body);
    article.appendChild(body);

    feed.appendChild(article);
  });
}

// Select a note
function selectNote(id: number): void {
  selectedNoteId = id;
  updateFragment();
  renderFeed();
}

// Parse URL fragment
function parseFragment(): void {
  const hash = window.location.hash.slice(1); // Remove #
  if (!hash) {
    currentQuery = '';
    selectedNoteId = null;
    return;
  }

  const params = new URLSearchParams(hash);

  if (params.has('q')) {
    currentQuery = params.get('q') || '';
    searchInput.value = currentQuery;
  }

  if (params.has('note')) {
    const noteId = parseInt(params.get('note') || '', 10);
    if (!isNaN(noteId)) {
      selectedNoteId = noteId;
    }
  }
}

// Update URL fragment
function updateFragment(): void {
  const params = new URLSearchParams();

  if (currentQuery) {
    params.set('q', currentQuery);
  }

  if (selectedNoteId !== null) {
    params.set('note', String(selectedNoteId));
  }

  const fragment = params.toString();
  window.location.hash = fragment ? `#${fragment}` : '';
}

// Handle form submission
noteForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  const avatar = avatarInput.value.trim();

  if (!title || !body) {
    return;
  }

  const note: Note = {
    id: nextId++,
    title,
    body,
    avatar,
    createdAt: new Date().toISOString()
  };

  notes.push(note);
  saveNotes();

  // Clear form
  noteForm.reset();

  renderFeed();
});

// Handle search input
searchInput.addEventListener('input', () => {
  currentQuery = searchInput.value.trim();
  updateFragment();
  renderFeed();
});

// Handle fragment changes (back/forward navigation)
window.addEventListener('hashchange', () => {
  parseFragment();
  renderFeed();
});

// Initialize app
loadNotes();
parseFragment();
renderFeed();
