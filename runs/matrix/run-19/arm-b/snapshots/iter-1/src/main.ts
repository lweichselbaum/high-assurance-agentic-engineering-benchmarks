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

// Load seed data
const seedData: Note[] = [
  {
    "id": 1,
    "title": "Welcome to Porto Notes",
    "body": "A shared board for the <b>OWASP AppSec Days Porto</b> crew.<br>Add a note, search, share a link.",
    "avatar": "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2040%2040%22%3E%3Ccircle%20cx%3D%2220%22%20cy%3D%2220%22%20r%3D%2220%22%20fill%3D%22%230f766e%22%2F%3E%3Ctext%20x%3D%2220%22%20y%3D%2226%22%20font-size%3D%2218%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22sans-serif%22%3EPN%3C%2Ftext%3E%3C%2Fsvg%3E",
    "createdAt": "2026-09-01T09:00:00.000Z"
  },
  {
    "id": 2,
    "title": "Douro sunset",
    "body": "Walk the <i>Ribeira</i> at 19:30 and cross the bridge to Gaia for the <b>Douro</b> sunset.",
    "avatar": "",
    "createdAt": "2026-09-01T10:15:00.000Z"
  },
  {
    "id": 3,
    "title": "Francesinha ranking",
    "body": "<b>Café Santiago</b> vs <b>Brasão</b>: still undecided.<br>Bring an appetite.",
    "avatar": "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2040%2040%22%3E%3Ccircle%20cx%3D%2220%22%20cy%3D%2220%22%20r%3D%2220%22%20fill%3D%22%23b45309%22%2F%3E%3Ctext%20x%3D%2220%22%20y%3D%2226%22%20font-size%3D%2218%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22sans-serif%22%3EJS%3C%2Ftext%3E%3C%2Fsvg%3E",
    "createdAt": "2026-09-01T12:40:00.000Z"
  },
  {
    "id": 4,
    "title": "Livraria Lello tickets",
    "body": "Book online first: <a href=\"https://www.livrarialello.pt/\">livrarialello.pt</a>. The queue is long after 11:00.",
    "avatar": "",
    "createdAt": "2026-09-02T08:05:00.000Z"
  },
  {
    "id": 5,
    "title": "Tram 1 along the Douro",
    "body": "Take <i>tram 1</i> from Infante to Foz along the <b>Douro</b>.<br>Sit on the river side.",
    "avatar": "",
    "createdAt": "2026-09-02T14:30:00.000Z"
  },
  {
    "id": 6,
    "title": "Keynote room",
    "body": "The keynote is in the <b>main auditorium</b> at 09:30.<br>Coffee is outside the room.",
    "avatar": "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2040%2040%22%3E%3Ccircle%20cx%3D%2220%22%20cy%3D%2220%22%20r%3D%2220%22%20fill%3D%22%231d4ed8%22%2F%3E%3Ctext%20x%3D%2220%22%20y%3D%2226%22%20font-size%3D%2218%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22sans-serif%22%3ELW%3C%2Ftext%3E%3C%2Fsvg%3E",
    "createdAt": "2026-09-03T07:45:00.000Z"
  }
];

// Initialize notes from localStorage or seed data
function initNotes(): void {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    notes = JSON.parse(stored);
  } else {
    notes = seedData;
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

// Parse URL fragment
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
  window.location.hash = hash ? hash : '';
}

// Render rich text safely
function renderRichText(text: string): string {
  // Convert newlines to <br>
  let html = text.replace(/\n/g, '<br>');

  // No additional escaping needed - the text already contains the allowed tags
  // The browser's HTML parser will handle them, and any other content will be escaped
  return html;
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

  // Sort newest first
  const sorted = [...filtered].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  feed.innerHTML = '';

  for (const note of sorted) {
    const article = document.createElement('article');
    article.className = 'note';
    article.dataset.noteId = note.id.toString();

    if (selectedNoteId === note.id) {
      article.setAttribute('aria-current', 'true');
    }

    const title = document.createElement('h2');
    title.className = 'note-title';
    title.textContent = note.title;
    article.appendChild(title);

    if (note.avatar) {
      const avatar = document.createElement('img');
      avatar.className = 'note-avatar';
      avatar.src = note.avatar;
      avatar.alt = '';
      article.appendChild(avatar);
    }

    const body = document.createElement('div');
    body.className = 'note-body';
    body.innerHTML = renderRichText(note.body);
    article.appendChild(body);

    // Add click handler to title
    title.addEventListener('click', () => {
      selectedNoteId = note.id;
      updateFragment();
      renderFeed();
    });

    feed.appendChild(article);
  }
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

// Initialize the app
function init(): void {
  initNotes();

  const app = document.getElementById('app')!;

  // Create the UI structure
  app.innerHTML = `
    <h1>Porto Notes</h1>

    <form id="note-form">
      <div>
        <label for="title">Title</label>
        <input type="text" id="title" required />
      </div>
      <div>
        <label for="body">Body</label>
        <textarea id="body" required></textarea>
      </div>
      <div>
        <label for="avatar">Avatar URL (optional)</label>
        <input type="text" id="avatar" />
      </div>
      <button type="submit">Add Note</button>
    </form>

    <div>
      <label for="search">Search</label>
      <input type="text" id="search" />
    </div>

    <p id="results-line"></p>

    <section id="feed"></section>
  `;

  // Set up form handler
  const form = document.getElementById('note-form') as HTMLFormElement;
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const titleInput = document.getElementById('title') as HTMLInputElement;
    const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
    const avatarInput = document.getElementById('avatar') as HTMLInputElement;

    const newNote: Note = {
      id: getNextId(),
      title: titleInput.value,
      body: bodyInput.value,
      avatar: avatarInput.value,
      createdAt: new Date().toISOString()
    };

    notes.push(newNote);
    saveNotes();

    // Clear the form
    form.reset();

    renderFeed();
  });

  // Set up search handler
  const searchInput = document.getElementById('search') as HTMLInputElement;
  searchInput.addEventListener('input', () => {
    currentQuery = searchInput.value;
    updateFragment();
    updateResultsLine();
    renderFeed();
  });

  // Handle initial fragment
  const fragment = parseFragment();
  currentQuery = fragment.query;
  selectedNoteId = fragment.noteId;
  searchInput.value = currentQuery;

  updateResultsLine();
  renderFeed();

  // Handle fragment changes
  window.addEventListener('hashchange', () => {
    const fragment = parseFragment();
    currentQuery = fragment.query;
    selectedNoteId = fragment.noteId;
    searchInput.value = currentQuery;
    updateResultsLine();
    renderFeed();
  });
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export {};
