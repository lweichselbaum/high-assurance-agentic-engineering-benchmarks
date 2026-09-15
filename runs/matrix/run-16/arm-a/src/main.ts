import fixturesData from './fixtures.json';

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
    notes = fixturesData as Note[];
    if (notes.length > 0) {
      nextId = Math.max(...notes.map(n => n.id)) + 1;
    }
    saveNotes();
  }
}

function saveNotes(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

// Parse URL fragment to restore state
function parseFragment(): { query: string; noteId: number | null } {
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash);
  return {
    query: params.get('q') || '',
    noteId: params.has('note') ? parseInt(params.get('note')!, 10) : null
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

// Sanitize and render rich text
function renderRichText(text: string): string {
  // Replace newlines with <br> tags
  let html = text.replace(/\n/g, '<br>');

  // Allow only safe tags: <b>, <strong>, <i>, <em>, <a href="...">, <br>
  // Parse and rebuild HTML to sanitize
  const temp = document.createElement('div');
  temp.innerHTML = html;

  function sanitizeNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tag = el.tagName.toLowerCase();

      if (tag === 'b' || tag === 'strong') {
        return `<b>${Array.from(el.childNodes).map(sanitizeNode).join('')}</b>`;
      }
      if (tag === 'i' || tag === 'em') {
        return `<i>${Array.from(el.childNodes).map(sanitizeNode).join('')}</i>`;
      }
      if (tag === 'br') {
        return '<br>';
      }
      if (tag === 'a') {
        const href = el.getAttribute('href') || '';
        // Sanitize href to prevent javascript: and data: URLs
        const sanitizedHref = href.replace(/^javascript:/i, '').replace(/^data:/i, '');
        const escapedHref = sanitizedHref
          .replace(/&/g, '&amp;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        return `<a href="${escapedHref}">${Array.from(el.childNodes).map(sanitizeNode).join('')}</a>`;
      }

      // For unsupported tags, just return their text content
      return Array.from(el.childNodes).map(sanitizeNode).join('');
    }

    return '';
  }

  return Array.from(temp.childNodes).map(sanitizeNode).join('');
}

// Filter notes by search query
function filterNotes(): Note[] {
  if (!currentQuery) {
    return notes;
  }
  const lower = currentQuery.toLowerCase();
  return notes.filter(note =>
    note.title.toLowerCase().includes(lower) ||
    note.body.toLowerCase().includes(lower)
  );
}

// Render the feed
function renderFeed(): void {
  const feed = document.getElementById('feed')!;
  const filtered = filterNotes();

  // Sort newest first
  const sorted = [...filtered].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  feed.innerHTML = '';

  for (const note of sorted) {
    const article = document.createElement('article');
    article.className = 'note';
    article.setAttribute('data-note-id', note.id.toString());

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
    body.innerHTML = renderRichText(note.body);

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
  }
}

// Select a note
function selectNote(noteId: number): void {
  selectedNoteId = noteId;
  updateFragment();
  renderFeed();
}

// Render the results line
function renderResultsLine(): void {
  const resultsLine = document.getElementById('results-line')!;
  if (currentQuery) {
    resultsLine.textContent = `results for "${currentQuery}"`;
  } else {
    resultsLine.textContent = '';
  }
}

// Handle search input
function handleSearch(query: string): void {
  currentQuery = query;
  updateFragment();
  renderResultsLine();
  renderFeed();
}

// Handle form submission
function handleSubmit(e: Event): void {
  e.preventDefault();

  const titleInput = document.getElementById('title') as HTMLInputElement;
  const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
  const avatarInput = document.getElementById('avatar') as HTMLInputElement;

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

  notes.unshift(note);
  saveNotes();

  // Clear form
  titleInput.value = '';
  bodyInput.value = '';
  avatarInput.value = '';

  renderFeed();
}

// Initialize the app
function init(): void {
  loadNotes();

  // Restore state from URL fragment
  const { query, noteId } = parseFragment();
  currentQuery = query;
  selectedNoteId = noteId;

  // Build UI
  const app = document.getElementById('app')!;

  app.innerHTML = `
    <h1>Porto Notes</h1>

    <form id="note-form">
      <input id="title" type="text" placeholder="Title" required />
      <textarea id="body" placeholder="Body (use <b>, <i>, <a href=...>, <br>)" required></textarea>
      <input id="avatar" type="text" placeholder="Avatar URL (optional)" />
      <button type="submit">Add Note</button>
    </form>

    <input id="search" type="text" placeholder="Search notes..." />
    <p id="results-line"></p>

    <section id="feed"></section>
  `;

  // Set up event listeners
  const form = document.getElementById('note-form')!;
  form.addEventListener('submit', handleSubmit);

  const searchInput = document.getElementById('search') as HTMLInputElement;
  searchInput.value = currentQuery;
  searchInput.addEventListener('input', (e) => {
    handleSearch((e.target as HTMLInputElement).value);
  });

  // Handle hash changes
  window.addEventListener('hashchange', () => {
    const { query, noteId } = parseFragment();
    currentQuery = query;
    selectedNoteId = noteId;

    const searchInput = document.getElementById('search') as HTMLInputElement;
    searchInput.value = currentQuery;

    renderResultsLine();
    renderFeed();
  });

  // Initial render
  renderResultsLine();
  renderFeed();
}

// Start the app
init();
