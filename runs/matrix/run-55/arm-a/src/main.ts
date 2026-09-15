import DOMPurify from 'dompurify';
import fixtures from '../fixtures.json';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

let notes: Note[] = [];

function initData() {
  const stored = localStorage.getItem('notes');
  if (stored) {
    notes = JSON.parse(stored);
  } else {
    notes = fixtures as Note[];
    localStorage.setItem('notes', JSON.stringify(notes));
  }
}

initData();

const noteForm = document.getElementById('note-form') as HTMLFormElement;
const titleInput = document.getElementById('title') as HTMLInputElement;
const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
const avatarInput = document.getElementById('avatar') as HTMLInputElement;
const searchInput = document.getElementById('search') as HTMLInputElement;
const resultsLine = document.getElementById('results-line') as HTMLParagraphElement;
const feed = document.getElementById('feed') as HTMLElement;

let currentQuery = '';
let selectedNoteId: number | null = null;

function parseHash() {
  const hashInfo = window.location.hash.substring(1);
  const params = new URLSearchParams(hashInfo);
  currentQuery = params.get('q') || '';
  const noteParam = params.get('note');
  selectedNoteId = noteParam ? parseInt(noteParam, 10) : null;
  
  if (searchInput.value !== currentQuery) {
    searchInput.value = currentQuery;
  }
}

function updateHash() {
  const params = new URLSearchParams();
  if (currentQuery) {
    params.set('q', currentQuery);
  }
  if (selectedNoteId !== null) {
    params.set('note', selectedNoteId.toString());
  }
  const hashStr = params.toString();
  // if no hash, preserve search params and path
  const newUrl = hashStr 
    ? `#${hashStr}` 
    : window.location.pathname + window.location.search;
  window.history.replaceState(null, '', newUrl);
}

function renderFeed() {
  feed.innerHTML = '';
  
  if (currentQuery) {
    resultsLine.textContent = `results for "${currentQuery}"`;
  } else {
    resultsLine.textContent = '';
  }

  const q = currentQuery.toLowerCase();
  const filtered = notes.filter(n => {
    return n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q);
  });

  const sorted = filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  for (const note of sorted) {
    const article = document.createElement('article');
    article.className = 'note';
    article.setAttribute('data-note-id', note.id.toString());
    
    if (selectedNoteId === note.id) {
      article.setAttribute('aria-current', 'true');
    }

    const titleEl = document.createElement('h3');
    titleEl.className = 'note-title';
    const titleWithBr = note.title.replace(/\n/g, '<br>');
    titleEl.innerHTML = DOMPurify.sanitize(titleWithBr, {
      ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'a', 'br'],
      ALLOWED_ATTR: ['href']
    });
    titleEl.style.cursor = 'pointer';
    titleEl.addEventListener('click', () => {
      selectedNoteId = note.id;
      updateHash();
      renderFeed();
    });

    const bodyWithBr = note.body.replace(/\n/g, '<br>');
    const bodyEl = document.createElement('div');
    bodyEl.className = 'note-body';
    bodyEl.innerHTML = DOMPurify.sanitize(bodyWithBr, {
      ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'a', 'br'],
      ALLOWED_ATTR: ['href']
    });
    
    article.appendChild(titleEl);
    article.appendChild(bodyEl);

    if (note.avatar) {
      const img = document.createElement('img');
      img.className = 'note-avatar';
      if (note.avatar.startsWith('http://') || note.avatar.startsWith('https://') || note.avatar.startsWith('data:image/')) {
        img.src = note.avatar;
      }
      article.appendChild(img);
    }
    
    feed.appendChild(article);
  }
}

window.addEventListener('hashchange', () => {
  parseHash();
  renderFeed();
});

searchInput.addEventListener('input', () => {
  currentQuery = searchInput.value;
  updateHash();
  renderFeed();
});

noteForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const maxId = notes.reduce((max, n) => Math.max(max, n.id), 0);
  
  const newNote: Note = {
    id: maxId + 1,
    title: titleInput.value,
    body: bodyInput.value,
    avatar: avatarInput.value,
    createdAt: new Date().toISOString()
  };

  notes.push(newNote);
  localStorage.setItem('notes', JSON.stringify(notes));
  
  noteForm.reset();
  renderFeed();
});

parseHash();
renderFeed();
