import { sanitizeHtml } from 'safevalues';
import { setElementInnerHtml } from 'safevalues/dom';
import fixtures from '../fixtures.json';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar?: string;
  createdAt?: string;
}

const LOCAL_STORAGE_KEY = 'porto_notes';
let notes: Note[] = [];

try {
  const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (saved) {
    notes = JSON.parse(saved);
  } else {
    // Note: fixtures is already imported, we clone it to be safe
    notes = JSON.parse(JSON.stringify(fixtures));
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(notes));
  }
} catch (e) {
  notes = JSON.parse(JSON.stringify(fixtures));
}

const form = document.getElementById('note-form') as HTMLFormElement;
const titleInput = document.getElementById('title') as HTMLInputElement;
const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
const avatarInput = document.getElementById('avatar') as HTMLInputElement;
const searchInput = document.getElementById('search') as HTMLInputElement;
const resultsLine = document.getElementById('results-line') as HTMLParagraphElement;
const feed = document.getElementById('feed') as HTMLElement;

let currentQuery = '';
let selectedNoteId: number | null = null;

function readFragment() {
  const hash = window.location.hash.replace(/^#/, '');
  const params = new URLSearchParams(hash);
  currentQuery = params.get('q') || '';
  const noteIdStr = params.get('note');
  selectedNoteId = noteIdStr ? parseInt(noteIdStr, 10) : null;
  
  if (searchInput.value !== currentQuery) {
    searchInput.value = currentQuery;
  }
}

function updateFragment(replace = false) {
  const params = new URLSearchParams();
  if (currentQuery) {
    params.set('q', currentQuery);
  }
  if (selectedNoteId !== null) {
    params.set('note', selectedNoteId.toString());
  }
  let newHash = params.toString();
  if (newHash) {
    newHash = '#' + newHash;
  } else {
    newHash = window.location.pathname + window.location.search;
  }
  
  if (replace) {
    window.history.replaceState(null, '', newHash);
  } else {
    window.history.pushState(null, '', newHash);
  }
  
  // also manually fire if we used pushState/replaceState
  // wait, to be simpler, let's just use window.location.hash
  if (newHash.startsWith('#')) {
    window.location.hash = newHash;
  } else {
    window.history.replaceState(null, '', newHash);
  }
}

function isValidAvatarUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('data:image/');
}

function render() {
  if (currentQuery) {
    resultsLine.textContent = `results for "${currentQuery}"`;
  } else {
    resultsLine.textContent = '';
  }

  feed.textContent = '';
  const q = currentQuery.toLowerCase();
  
  // newest first
  const displayNotes = [...notes].sort((a, b) => b.id - a.id).filter(note => {
    if (!q) return true;
    return note.title.toLowerCase().includes(q) || note.body.toLowerCase().includes(q);
  });

  for (const note of displayNotes) {
    const article = document.createElement('article');
    article.className = 'note';
    article.setAttribute('data-note-id', note.id.toString());
    if (note.id === selectedNoteId) {
      article.setAttribute('aria-current', 'true');
    }

    const titleEl = document.createElement('h2');
    titleEl.className = 'note-title';
    // User formatting allowed in title too?
    setElementInnerHtml(titleEl, sanitizeHtml(note.title));
    titleEl.addEventListener('click', () => {
      selectedNoteId = note.id;
      // build hash manually to avoid reloading page
      const params = new URLSearchParams();
      if (currentQuery) params.set('q', currentQuery);
      params.set('note', selectedNoteId.toString());
      window.location.hash = params.toString();
      // the hashchange event will trigger render, but doing it here is fine too
      render();
    });
    article.appendChild(titleEl);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'note-body';
    
    // newlines to <br>
    const bodyHtml = note.body.replace(/\n/g, '<br>');
    setElementInnerHtml(bodyEl, sanitizeHtml(bodyHtml));
    
    article.appendChild(bodyEl);

    if (note.avatar && isValidAvatarUrl(note.avatar)) {
      const img = document.createElement('img');
      img.className = 'note-avatar';
      img.src = note.avatar;
      article.appendChild(img);
    }

    feed.appendChild(article);
  }
}

window.addEventListener('hashchange', () => {
  readFragment();
  render();
});

searchInput.addEventListener('input', () => {
  currentQuery = searchInput.value;
  // keep selectedNoteId unchanged
  const params = new URLSearchParams();
  if (currentQuery) params.set('q', currentQuery);
  if (selectedNoteId !== null) params.set('note', selectedNoteId.toString());
  
  const newHash = params.toString();
  if (newHash) {
    window.history.replaceState(null, '', '#' + newHash);
  } else {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  render();
});

form.addEventListener('submit', (e) => {
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
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(notes));
  
  form.reset();
  render();
});

// Init
readFragment();
render();
