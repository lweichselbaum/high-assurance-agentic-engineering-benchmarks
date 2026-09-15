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

// Parse and render rich text safely without innerHTML
function renderRichText(text: string, container: HTMLElement): void {
  // Simple parser that processes text character by character
  let i = 0;
  const stack: HTMLElement[] = [container];

  const getCurrentElement = (): HTMLElement => {
    const elem = stack[stack.length - 1];
    if (!elem) throw new Error('Stack is empty');
    return elem;
  };

  while (i < text.length) {
    const char = text[i];

    // Check for newline
    if (char === '\n') {
      getCurrentElement().appendChild(document.createElement('br'));
      i++;
      continue;
    }

    // Check for opening tag
    if (char === '<') {
      const tagEnd = text.indexOf('>', i);
      if (tagEnd === -1) {
        // No closing >, treat as text
        getCurrentElement().appendChild(document.createTextNode(char));
        i++;
        continue;
      }

      const tag = text.slice(i, tagEnd + 1);

      // Parse tag
      if (tag === '<b>' || tag === '<strong>') {
        const elem = document.createElement(tag === '<b>' ? 'b' : 'strong');
        getCurrentElement().appendChild(elem);
        stack.push(elem);
        i = tagEnd + 1;
      } else if (tag === '</b>' || tag === '</strong>') {
        if (stack.length > 1) {
          stack.pop();
        }
        i = tagEnd + 1;
      } else if (tag === '<i>' || tag === '<em>') {
        const elem = document.createElement(tag === '<i>' ? 'i' : 'em');
        getCurrentElement().appendChild(elem);
        stack.push(elem);
        i = tagEnd + 1;
      } else if (tag === '</i>' || tag === '</em>') {
        if (stack.length > 1) {
          stack.pop();
        }
        i = tagEnd + 1;
      } else if (tag === '<br>' || tag === '<br/>' || tag === '<br />') {
        getCurrentElement().appendChild(document.createElement('br'));
        i = tagEnd + 1;
      } else if (tag.startsWith('<a href=')) {
        // Parse href
        const hrefMatch = tag.match(/<a href=["']([^"']+)["']>/);
        if (hrefMatch && hrefMatch[1]) {
          const elem = document.createElement('a');
          elem.href = hrefMatch[1];
          getCurrentElement().appendChild(elem);
          stack.push(elem);
        }
        i = tagEnd + 1;
      } else if (tag === '</a>') {
        if (stack.length > 1) {
          stack.pop();
        }
        i = tagEnd + 1;
      } else {
        // Unknown tag, treat as text
        getCurrentElement().appendChild(document.createTextNode(char));
        i++;
      }
    } else {
      // Regular text
      getCurrentElement().appendChild(document.createTextNode(char));
      i++;
    }
  }
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

  // Clear feed without innerHTML
  while (feed.firstChild) {
    feed.removeChild(feed.firstChild);
  }

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
    renderRichText(note.body, body);

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
