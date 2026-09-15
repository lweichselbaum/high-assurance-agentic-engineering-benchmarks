import DOMPurify from 'dompurify';
import fixtures from '../fixtures.json';

type Note = {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt?: string;
};

let notes: Note[] = [];

const STORAGE_KEY = 'porto-notes';
const saved = localStorage.getItem(STORAGE_KEY);
if (saved) {
  notes = JSON.parse(saved);
} else {
  notes = fixtures as Note[];
  saveNotes();
}

function saveNotes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function getNextId() {
  if (notes.length === 0) return 1;
  return Math.max(...notes.map(n => n.id)) + 1;
}

const feed = document.getElementById('feed')!;
const noteForm = document.getElementById('note-form') as HTMLFormElement;
const titleInput = document.getElementById('title') as HTMLInputElement;
const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
const avatarInput = document.getElementById('avatar') as HTMLInputElement;
const searchInput = document.getElementById('search') as HTMLInputElement;
const resultsLine = document.getElementById('results-line')!;

let currentQuery = '';
let selectedNoteId: number | null = null;

function parseHash() {
  const hash = window.location.hash;
  if (!hash) {
    currentQuery = '';
    selectedNoteId = null;
    return;
  }
  const params = new URLSearchParams(hash.slice(1));
  currentQuery = params.get('q') || '';
  const noteParam = params.get('note');
  selectedNoteId = noteParam ? parseInt(noteParam, 10) : null;
}

function updateHash() {
  const params = new URLSearchParams();
  if (currentQuery) {
    params.set('q', currentQuery);
  }
  if (selectedNoteId) {
    params.set('note', selectedNoteId.toString());
  }
  const str = params.toString();
  window.history.replaceState(null, '', str ? `#${str}` : window.location.pathname);
}

function configureDOMPurify() {
  DOMPurify.setConfig({
    ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'a', 'br'],
    ALLOWED_ATTR: ['href']
  });
}
configureDOMPurify();

function render() {
  let filtered = notes;
  if (currentQuery) {
    const q = currentQuery.toLowerCase();
    filtered = notes.filter(n => 
      n.title.toLowerCase().includes(q) || 
      n.body.toLowerCase().includes(q)
    );
    resultsLine.textContent = `results for "${currentQuery}"`;
  } else {
    resultsLine.textContent = '';
  }

  const sorted = [...filtered].sort((a, b) => b.id - a.id);
  feed.replaceChildren();
  
  for (const note of sorted) {
    const article = document.createElement('article');
    article.className = 'note';
    article.setAttribute('data-note-id', note.id.toString());
    if (note.id === selectedNoteId) {
      article.setAttribute('aria-current', 'true');
    }

    if (note.avatar) {
      const img = document.createElement('img');
      img.className = 'note-avatar';
      img.src = note.avatar; // It can be data URL, but let's assume it's safe URL. We should use secure setup if needed, but for now src is ok.
      article.appendChild(img);
    }
    
    const h3 = document.createElement('h3');
    h3.className = 'note-title';
    h3.innerHTML = DOMPurify.sanitize(note.title);

    const div = document.createElement('div');
    div.className = 'note-body';
    div.innerHTML = DOMPurify.sanitize(note.body.replace(/\n/g, '<br>'));
    
    article.appendChild(h3);
    article.appendChild(div);
    feed.appendChild(article);
  }
}

noteForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const id = getNextId();
  const title = titleInput.value;
  const body = bodyInput.value;
  const avatar = avatarInput.value;
  
  notes.push({ id, title, body, avatar, createdAt: new Date().toISOString() });
  saveNotes();
  noteForm.reset();
  render();
});

searchInput.addEventListener('input', (e) => {
  currentQuery = searchInput.value;
  updateHash();
  render();
});

feed.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const titleEl = target.closest('.note-title');
  if (titleEl) {
    const article = titleEl.closest('.note');
    if (article) {
      const idStr = article.getAttribute('data-note-id');
      if (idStr) {
        selectedNoteId = parseInt(idStr, 10);
        updateHash();
        render();
      }
    }
  }
});

window.addEventListener('hashchange', () => {
  parseHash();
  searchInput.value = currentQuery;
  render();
});

// Initial boot
parseHash();
searchInput.value = currentQuery;
render();

