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

// Parse and render rich text safely using DOM APIs
function renderRichText(text: string, container: HTMLElement): void {
  // Convert newlines to <br> tags
  const html = text.replace(/\n/g, '<br>');

  // Use DOMParser to safely parse HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const parsed = doc.body.firstChild as HTMLElement;

  // Clear container and append parsed content
  container.textContent = '';
  if (parsed) {
    while (parsed.firstChild) {
      container.appendChild(parsed.firstChild);
    }
  }
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
    renderRichText(note.body, body);
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

  // Create the UI structure programmatically
  const h1 = document.createElement('h1');
  h1.textContent = 'Porto Notes';
  app.appendChild(h1);

  // Create form
  const form = document.createElement('form');
  form.id = 'note-form';

  const titleDiv = document.createElement('div');
  const titleLabel = document.createElement('label');
  titleLabel.setAttribute('for', 'title');
  titleLabel.textContent = 'Title';
  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.id = 'title';
  titleInput.required = true;
  titleDiv.appendChild(titleLabel);
  titleDiv.appendChild(titleInput);
  form.appendChild(titleDiv);

  const bodyDiv = document.createElement('div');
  const bodyLabel = document.createElement('label');
  bodyLabel.setAttribute('for', 'body');
  bodyLabel.textContent = 'Body';
  const bodyTextarea = document.createElement('textarea');
  bodyTextarea.id = 'body';
  bodyTextarea.required = true;
  bodyDiv.appendChild(bodyLabel);
  bodyDiv.appendChild(bodyTextarea);
  form.appendChild(bodyDiv);

  const avatarDiv = document.createElement('div');
  const avatarLabel = document.createElement('label');
  avatarLabel.setAttribute('for', 'avatar');
  avatarLabel.textContent = 'Avatar URL (optional)';
  const avatarInput = document.createElement('input');
  avatarInput.type = 'text';
  avatarInput.id = 'avatar';
  avatarDiv.appendChild(avatarLabel);
  avatarDiv.appendChild(avatarInput);
  form.appendChild(avatarDiv);

  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.textContent = 'Add Note';
  form.appendChild(submitButton);

  app.appendChild(form);

  // Create search section
  const searchDiv = document.createElement('div');
  const searchLabel = document.createElement('label');
  searchLabel.setAttribute('for', 'search');
  searchLabel.textContent = 'Search';
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.id = 'search';
  searchDiv.appendChild(searchLabel);
  searchDiv.appendChild(searchInput);
  app.appendChild(searchDiv);

  // Create results line
  const resultsLine = document.createElement('p');
  resultsLine.id = 'results-line';
  app.appendChild(resultsLine);

  // Create feed section
  const feed = document.createElement('section');
  feed.id = 'feed';
  app.appendChild(feed);

  // Set up form handler
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const newNote: Note = {
      id: getNextId(),
      title: titleInput.value,
      body: bodyTextarea.value,
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
