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

// Load notes from localStorage or seed with fixtures
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

// Sanitize HTML to only allow specific tags
function sanitizeRichText(html: string): string {
  // Convert newlines to <br> tags
  let sanitized = html.replace(/\n/g, '<br>');

  // Create a temporary div to parse HTML
  const temp = document.createElement('div');
  temp.innerHTML = sanitized;

  // Recursively sanitize nodes
  function sanitizeNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tagName = el.tagName.toLowerCase();

      // Only allow specific tags
      if (['b', 'strong', 'i', 'em', 'br'].includes(tagName)) {
        const children = Array.from(node.childNodes).map(sanitizeNode).join('');
        if (tagName === 'br') {
          return '<br>';
        }
        return `<${tagName}>${children}</${tagName}>`;
      } else if (tagName === 'a') {
        const href = el.getAttribute('href') || '';
        const children = Array.from(node.childNodes).map(sanitizeNode).join('');
        return `<a href="${escapeHtml(href)}">${children}</a>`;
      }

      // For disallowed tags, just return their text content
      return Array.from(node.childNodes).map(sanitizeNode).join('');
    }

    return '';
  }

  return Array.from(temp.childNodes).map(sanitizeNode).join('');
}

// Escape HTML entities
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Parse URL fragment
function parseFragment(): { query: string; noteId: number | null } {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  return {
    query: params.get('q') || '',
    noteId: params.get('note') ? parseInt(params.get('note')!, 10) : null
  };
}

// Update URL fragment
function updateFragment(): void {
  const params = new URLSearchParams();
  if (currentQuery) {
    params.set('q', currentQuery);
  }
  if (selectedNoteId !== null) {
    params.set('note', selectedNoteId.toString());
  }
  const hash = params.toString();
  window.location.hash = hash ? `#${hash}` : '';
}

// Filter notes by query
function filterNotes(): Note[] {
  if (!currentQuery) {
    return notes;
  }
  const lowerQuery = currentQuery.toLowerCase();
  return notes.filter(note =>
    note.title.toLowerCase().includes(lowerQuery) ||
    note.body.toLowerCase().includes(lowerQuery)
  );
}

// Render the feed
function renderFeed(): void {
  const feed = document.getElementById('feed')!;
  const filtered = filterNotes();

  // Sort by newest first (highest id first, as new notes continue the sequence)
  const sorted = [...filtered].sort((a, b) => b.id - a.id);

  feed.innerHTML = '';

  sorted.forEach(note => {
    const article = document.createElement('article');
    article.className = 'note';
    article.setAttribute('data-note-id', note.id.toString());

    if (note.id === selectedNoteId) {
      article.setAttribute('aria-current', 'true');
    }

    const title = document.createElement('h2');
    title.className = 'note-title';
    title.textContent = note.title;
    title.addEventListener('click', () => selectNote(note.id));

    const body = document.createElement('div');
    body.className = 'note-body';
    body.innerHTML = sanitizeRichText(note.body);

    article.appendChild(title);
    article.appendChild(body);

    if (note.avatar) {
      const avatar = document.createElement('img');
      avatar.className = 'note-avatar';
      avatar.src = note.avatar;
      avatar.alt = 'Avatar';
      article.appendChild(avatar);
    }

    feed.appendChild(article);
  });
}

// Select a note
function selectNote(id: number): void {
  selectedNoteId = id;
  updateFragment();
  renderFeed();
}

// Update results line
function updateResultsLine(): void {
  const resultsLine = document.getElementById('results-line')!;
  if (currentQuery) {
    resultsLine.textContent = `results for "${currentQuery}"`;
  } else {
    resultsLine.textContent = '';
  }
}

// Handle form submission
function handleFormSubmit(e: Event): void {
  e.preventDefault();

  const form = e.target as HTMLFormElement;
  const titleInput = document.getElementById('title') as HTMLInputElement;
  const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
  const avatarInput = document.getElementById('avatar') as HTMLInputElement;

  const newNote: Note = {
    id: notes.length > 0 ? Math.max(...notes.map(n => n.id)) + 1 : 1,
    title: titleInput.value,
    body: bodyInput.value,
    avatar: avatarInput.value,
    createdAt: new Date().toISOString()
  };

  notes.push(newNote);
  saveNotes();

  form.reset();
  renderFeed();
}

// Handle search input
function handleSearch(e: Event): void {
  const input = e.target as HTMLInputElement;
  currentQuery = input.value;
  updateFragment();
  updateResultsLine();
  renderFeed();
}

// Initialize app
async function init(): Promise<void> {
  await loadNotes();

  // Parse fragment and restore state
  const fragment = parseFragment();
  currentQuery = fragment.query;
  selectedNoteId = fragment.noteId;

  // Set search input value
  const searchInput = document.getElementById('search') as HTMLInputElement;
  searchInput.value = currentQuery;

  // Attach event listeners
  const form = document.getElementById('note-form')!;
  form.addEventListener('submit', handleFormSubmit);

  searchInput.addEventListener('input', handleSearch);

  // Handle fragment changes
  window.addEventListener('hashchange', () => {
    const fragment = parseFragment();
    currentQuery = fragment.query;
    selectedNoteId = fragment.noteId;
    searchInput.value = currentQuery;
    updateResultsLine();
    renderFeed();
  });

  // Initial render
  updateResultsLine();
  renderFeed();
}

// Start the app
init();

export {};
