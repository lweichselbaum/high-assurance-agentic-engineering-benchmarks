import './style.css';

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

const form = document.getElementById('note-form') as HTMLFormElement;
const titleInput = document.getElementById('title') as HTMLInputElement;
const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
const avatarInput = document.getElementById('avatar') as HTMLInputElement;
const searchInput = document.getElementById('search') as HTMLInputElement;
const resultsLine = document.getElementById('results-line') as HTMLParagraphElement;
const feed = document.getElementById('feed') as HTMLElement;

function loadNotes(): void {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    notes = JSON.parse(stored);
    if (notes.length > 0) {
      nextId = Math.max(...notes.map(n => n.id)) + 1;
    }
  } else {
    // Seed with fixtures
    fetch('/fixtures.json')
      .then(res => res.json())
      .then((fixtures: Note[]) => {
        notes = fixtures;
        if (notes.length > 0) {
          nextId = Math.max(...notes.map(n => n.id)) + 1;
        }
        saveNotes();
        render();
      });
    return;
  }
}

function saveNotes(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function parseRichText(text: string): string {
  // Escape HTML first
  let result = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // Replace newlines with <br>
  result = result.replace(/\n/g, '<br>');

  // Restore allowed tags
  result = result.replace(/&lt;b&gt;/g, '<b>');
  result = result.replace(/&lt;\/b&gt;/g, '</b>');
  result = result.replace(/&lt;strong&gt;/g, '<strong>');
  result = result.replace(/&lt;\/strong&gt;/g, '</strong>');
  result = result.replace(/&lt;i&gt;/g, '<i>');
  result = result.replace(/&lt;\/i&gt;/g, '</i>');
  result = result.replace(/&lt;em&gt;/g, '<em>');
  result = result.replace(/&lt;\/em&gt;/g, '</em>');
  result = result.replace(/&lt;br&gt;/g, '<br>');
  result = result.replace(/&lt;br\/&gt;/g, '<br>');
  result = result.replace(/&lt;br\s*\/&gt;/g, '<br>');

  // Handle <a href="...">text</a>
  result = result.replace(
    /&lt;a\s+href=&quot;([^&"]+)&quot;&gt;/g,
    '<a href="$1">'
  );
  result = result.replace(/&lt;\/a&gt;/g, '</a>');

  return result;
}

function filterNotes(): Note[] {
  if (!currentQuery) return notes;
  const query = currentQuery.toLowerCase();
  return notes.filter(note =>
    note.title.toLowerCase().includes(query) ||
    note.body.toLowerCase().includes(query)
  );
}

function updateResultsLine(): void {
  if (currentQuery) {
    resultsLine.textContent = `results for "${currentQuery}"`;
  } else {
    resultsLine.textContent = '';
  }
}

function updateFragment(): void {
  const params = new URLSearchParams();
  if (currentQuery) {
    params.set('q', currentQuery);
  }
  if (selectedNoteId !== null) {
    params.set('note', selectedNoteId.toString());
  }
  const fragment = params.toString();
  window.location.hash = fragment;
}

function parseFragment(): void {
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash);

  const query = params.get('q');
  if (query !== null) {
    currentQuery = query;
    searchInput.value = query;
  }

  const noteId = params.get('note');
  if (noteId !== null) {
    selectedNoteId = parseInt(noteId, 10);
  }
}

function render(): void {
  const filtered = filterNotes();
  // Sort newest first
  const sorted = [...filtered].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  feed.innerHTML = '';

  sorted.forEach(note => {
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
    title.addEventListener('click', () => {
      selectedNoteId = note.id;
      updateFragment();
      render();
    });

    const body = document.createElement('div');
    body.className = 'note-body';
    body.innerHTML = parseRichText(note.body);

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

form.addEventListener('submit', (e) => {
  e.preventDefault();

  const newNote: Note = {
    id: nextId++,
    title: titleInput.value,
    body: bodyInput.value,
    avatar: avatarInput.value,
    createdAt: new Date().toISOString()
  };

  notes.push(newNote);
  saveNotes();

  form.reset();
  render();
});

searchInput.addEventListener('input', () => {
  currentQuery = searchInput.value;
  updateFragment();
  render();
});

window.addEventListener('hashchange', () => {
  parseFragment();
  render();
});

// Initialize
parseFragment();
loadNotes();
render();
