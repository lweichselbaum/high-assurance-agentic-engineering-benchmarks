// Porto Notes — implement the app here (see CLAUDE.md). This file is loaded by harness/entry.ts.

interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto-notes';
let notes: Note[] = [];
let currentQuery = '';
let selectedNoteId: number | null = null;

// Sanitize HTML to only allow specific tags and attributes
function sanitizeRichText(html: string): string {
  const div = document.createElement('div');
  div.textContent = html; // First escape everything
  let escaped = div.innerHTML;

  // Convert newlines to <br> tags
  escaped = escaped.replace(/\n/g, '<br>');

  // Now allow only specific tags by replacing their escaped versions
  escaped = escaped.replace(/&lt;b&gt;/g, '<b>');
  escaped = escaped.replace(/&lt;\/b&gt;/g, '</b>');
  escaped = escaped.replace(/&lt;strong&gt;/g, '<strong>');
  escaped = escaped.replace(/&lt;\/strong&gt;/g, '</strong>');
  escaped = escaped.replace(/&lt;i&gt;/g, '<i>');
  escaped = escaped.replace(/&lt;\/i&gt;/g, '</i>');
  escaped = escaped.replace(/&lt;em&gt;/g, '<em>');
  escaped = escaped.replace(/&lt;\/em&gt;/g, '</em>');
  escaped = escaped.replace(/&lt;br&gt;/g, '<br>');
  escaped = escaped.replace(/&lt;br\/&gt;/g, '<br>');
  escaped = escaped.replace(/&lt;br \/&gt;/g, '<br>');

  // Handle <a href="..."> tags more carefully
  escaped = escaped.replace(/&lt;a href=&quot;([^&"]+)&quot;&gt;/g, '<a href="$1">');
  escaped = escaped.replace(/&lt;a href=&#39;([^&']+)&#39;&gt;/g, '<a href="$1">');
  escaped = escaped.replace(/&lt;\/a&gt;/g, '</a>');

  return escaped;
}

// Load notes from localStorage or fixtures
async function loadNotes(): Promise<void> {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    notes = JSON.parse(stored);
  } else {
    // Load fixtures on first run
    const response = await fetch('/fixtures.json');
    notes = await response.json();
    saveNotes();
  }
}

// Save notes to localStorage
function saveNotes(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

// Get next note ID
function getNextId(): number {
  return notes.length > 0 ? Math.max(...notes.map(n => n.id)) + 1 : 1;
}

// Add a new note
function addNote(title: string, body: string, avatar: string): void {
  const note: Note = {
    id: getNextId(),
    title,
    body,
    avatar,
    createdAt: new Date().toISOString()
  };
  notes.unshift(note); // Add to beginning (newest first)
  saveNotes();
  renderFeed();
}

// Filter notes based on search query
function getFilteredNotes(): Note[] {
  if (!currentQuery) {
    return notes;
  }
  const query = currentQuery.toLowerCase();
  return notes.filter(note =>
    note.title.toLowerCase().includes(query) ||
    note.body.toLowerCase().includes(query)
  );
}

// Render the feed
function renderFeed(): void {
  const feed = document.getElementById('feed')!;
  const filtered = getFilteredNotes();

  feed.innerHTML = '';

  filtered.forEach(note => {
    const article = document.createElement('article');
    article.className = 'note';
    article.setAttribute('data-note-id', String(note.id));

    if (selectedNoteId === note.id) {
      article.setAttribute('aria-current', 'true');
    }

    const title = document.createElement('h2');
    title.className = 'note-title';
    title.textContent = note.title;
    title.style.cursor = 'pointer';
    title.addEventListener('click', () => selectNote(note.id));

    const body = document.createElement('div');
    body.className = 'note-body';
    body.innerHTML = sanitizeRichText(note.body);

    article.appendChild(title);

    if (note.avatar) {
      const avatar = document.createElement('img');
      avatar.className = 'note-avatar';
      avatar.src = note.avatar;
      avatar.alt = 'Avatar';
      article.appendChild(avatar);
    }

    article.appendChild(body);
    feed.appendChild(article);
  });

  updateResultsLine();
}

// Update the results line
function updateResultsLine(): void {
  const resultsLine = document.getElementById('results-line')!;
  if (currentQuery) {
    resultsLine.textContent = `results for "${currentQuery}"`;
  } else {
    resultsLine.textContent = '';
  }
}

// Select a note and update URL
function selectNote(id: number): void {
  selectedNoteId = id;
  updateFragment();
  renderFeed();
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

// Parse URL fragment and restore state
function parseFragment(): void {
  const hash = window.location.hash.slice(1); // Remove #
  if (!hash) {
    currentQuery = '';
    selectedNoteId = null;
    return;
  }

  const params = new URLSearchParams(hash);
  currentQuery = params.get('q') || '';
  const noteId = params.get('note');
  selectedNoteId = noteId ? parseInt(noteId, 10) : null;

  // Update search input
  const searchInput = document.getElementById('search') as HTMLInputElement;
  searchInput.value = currentQuery;
}

// Initialize the app
async function init(): Promise<void> {
  await loadNotes();
  parseFragment();
  renderFeed();

  // Form submission
  const form = document.getElementById('note-form') as HTMLFormElement;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const titleInput = document.getElementById('title') as HTMLInputElement;
    const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
    const avatarInput = document.getElementById('avatar') as HTMLInputElement;

    addNote(titleInput.value, bodyInput.value, avatarInput.value);

    // Clear form
    titleInput.value = '';
    bodyInput.value = '';
    avatarInput.value = '';
  });

  // Search input
  const searchInput = document.getElementById('search') as HTMLInputElement;
  searchInput.addEventListener('input', () => {
    currentQuery = searchInput.value;
    updateFragment();
    renderFeed();
  });

  // Handle hash changes (back/forward navigation)
  window.addEventListener('hashchange', () => {
    parseFragment();
    renderFeed();
  });
}

// Start the app
init();

export {};
