import fixtures from '../fixtures.json';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto-notes';
const FIXTURES_LOADED_KEY = 'porto-notes-fixtures-loaded';

let notes: Note[] = [];
let selectedNoteId: number | null = null;
let searchQuery = '';

// DOM elements
const titleInput = document.getElementById('title') as HTMLInputElement;
const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
const avatarInput = document.getElementById('avatar') as HTMLInputElement;
const noteForm = document.getElementById('note-form') as HTMLFormElement;
const searchInput = document.getElementById('search') as HTMLInputElement;
const resultsLine = document.getElementById('results-line') as HTMLParagraphElement;
const feedSection = document.getElementById('feed') as HTMLElement;

function loadNotes() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    notes = JSON.parse(stored);
  } else {
    const fixturesLoaded = localStorage.getItem(FIXTURES_LOADED_KEY);
    if (!fixturesLoaded) {
      notes = fixtures as Note[];
      localStorage.setItem(FIXTURES_LOADED_KEY, 'true');
      saveNotes();
    }
  }
}

function saveNotes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function getNextNoteId(): number {
  if (notes.length === 0) return 1;
  return Math.max(...notes.map(n => n.id)) + 1;
}

function renderRichText(text: string): string {
  // Replace newlines with <br>
  let html = text.replace(/\n/g, '<br>');
  // Escape HTML special characters first
  html = html
    .replace(/&(?!(?:lt|gt|amp|quot|#39);)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // Now unescape the tags we want to allow
  html = html
    .replace(/&lt;b&gt;/g, '<b>')
    .replace(/&lt;\/b&gt;/g, '</b>')
    .replace(/&lt;strong&gt;/g, '<strong>')
    .replace(/&lt;\/strong&gt;/g, '</strong>')
    .replace(/&lt;i&gt;/g, '<i>')
    .replace(/&lt;\/i&gt;/g, '</i>')
    .replace(/&lt;em&gt;/g, '<em>')
    .replace(/&lt;\/em&gt;/g, '</em>')
    .replace(/&lt;br&gt;/g, '<br>')
    .replace(/&lt;a href="([^"]*?)"&gt;/g, '<a href="$1">')
    .replace(/&lt;\/a&gt;/g, '</a>');
  return html;
}

function renderNote(note: Note, isSelected: boolean = false): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.dataset.noteId = note.id.toString();
  if (isSelected) {
    article.setAttribute('aria-current', 'true');
  }

  const noteHeader = document.createElement('div');
  noteHeader.className = 'note-header';

  if (note.avatar) {
    const avatar = document.createElement('img');
    avatar.className = 'note-avatar';
    avatar.src = note.avatar;
    avatar.alt = '';
    noteHeader.appendChild(avatar);
  }

  const noteContent = document.createElement('div');
  noteContent.className = 'note-content';

  const title = document.createElement('h3');
  title.className = 'note-title';
  title.textContent = note.title;
  title.addEventListener('click', () => selectNote(note.id));
  noteContent.appendChild(title);

  const body = document.createElement('p');
  body.className = 'note-body';
  body.innerHTML = renderRichText(note.body);
  noteContent.appendChild(body);

  noteHeader.appendChild(noteContent);
  article.appendChild(noteHeader);
  article.addEventListener('click', (e) => {
    if (e.target !== title) {
      selectNote(note.id);
    }
  });

  return article;
}

function getFilteredNotes(): Note[] {
  if (!searchQuery) {
    return notes;
  }
  const q = searchQuery.toLowerCase();
  return notes.filter(
    note =>
      note.title.toLowerCase().includes(q) ||
      note.body.toLowerCase().includes(q)
  );
}

function renderFeed() {
  const filtered = getFilteredNotes();
  feedSection.innerHTML = '';

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = searchQuery ? 'No notes found' : 'No notes yet';
    feedSection.appendChild(empty);
    return;
  }

  // Sort newest first
  const sorted = [...filtered].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  sorted.forEach(note => {
    const isSelected = selectedNoteId === note.id;
    feedSection.appendChild(renderNote(note, isSelected));
  });
}

function updateResultsLine() {
  if (searchQuery) {
    resultsLine.textContent = `results for "${searchQuery}"`;
  } else {
    resultsLine.textContent = '';
  }
}

function updateFragment() {
  const params = new URLSearchParams();
  if (searchQuery) {
    params.set('q', searchQuery);
  }
  if (selectedNoteId) {
    params.set('note', selectedNoteId.toString());
  }
  const fragment = params.toString();
  window.location.hash = fragment ? `#${fragment}` : '';
}

function parseFragment() {
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash);
  searchQuery = params.get('q') || '';
  selectedNoteId = params.get('note') ? parseInt(params.get('note')!, 10) : null;
}

function selectNote(noteId: number) {
  selectedNoteId = noteId;
  updateFragment();
  renderFeed();
}

function addNote(title: string, body: string, avatar: string) {
  const note: Note = {
    id: getNextNoteId(),
    title,
    body,
    avatar,
    createdAt: new Date().toISOString(),
  };
  notes.unshift(note);
  saveNotes();
  renderFeed();
}

function init() {
  loadNotes();
  parseFragment();

  // Form submission
  noteForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    const body = bodyInput.value.trim();
    const avatar = avatarInput.value.trim();

    if (title && body) {
      addNote(title, body, avatar);
      titleInput.value = '';
      bodyInput.value = '';
      avatarInput.value = '';
    }
  });

  // Search input
  searchInput.addEventListener('input', (e) => {
    searchQuery = (e.target as HTMLInputElement).value;
    selectedNoteId = null;
    updateResultsLine();
    updateFragment();
    renderFeed();
  });

  // Handle fragment change
  window.addEventListener('hashchange', () => {
    parseFragment();
    updateResultsLine();
    renderFeed();
  });

  renderFeed();
  updateResultsLine();
}

init();
