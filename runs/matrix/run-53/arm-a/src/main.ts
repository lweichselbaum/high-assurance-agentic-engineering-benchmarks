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
let currentSearch = '';
let currentNoteId: number | null = null;

function init() {
  const saved = localStorage.getItem('porto_notes');
  if (saved) {
    try {
      notes = JSON.parse(saved);
    } catch {
      notes = fixtures;
      saveNotes();
    }
  } else {
    notes = fixtures;
    saveNotes();
  }
  
  parseHash();
  renderApp();
  
  window.addEventListener('hashchange', () => {
    parseHash();
    renderApp();
  });
  
  setupListeners();
}

function saveNotes() {
  localStorage.setItem('porto_notes', JSON.stringify(notes));
}

function parseHash() {
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash);
  currentSearch = params.get('q') || '';
  const noteParam = params.get('note');
  currentNoteId = noteParam ? parseInt(noteParam, 10) : null;
}

function updateHash() {
  const params = new URLSearchParams();
  if (currentSearch) params.set('q', currentSearch);
  if (currentNoteId !== null) params.set('note', currentNoteId.toString());
  
  const hash = params.toString();
  window.history.replaceState(null, '', hash ? `#${hash}` : window.location.pathname + window.location.search);
}

function setupListeners() {
  const form = document.getElementById('note-form') as HTMLFormElement;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const titleEl = document.getElementById('title') as HTMLInputElement;
    const bodyEl = document.getElementById('body') as HTMLTextAreaElement;
    const avatarEl = document.getElementById('avatar') as HTMLInputElement;
    
    let maxId = 0;
    for (const n of notes) {
      if (n.id > maxId) maxId = n.id;
    }
    
    const newNote: Note = {
      id: maxId + 1,
      title: titleEl.value,
      body: bodyEl.value,
      avatar: avatarEl.value,
      createdAt: new Date().toISOString()
    };
    
    notes.push(newNote);
    saveNotes();
    
    form.reset();
    renderApp();
  });

  const searchEl = document.getElementById('search') as HTMLInputElement;
  searchEl.addEventListener('input', (e) => {
    currentSearch = (e.target as HTMLInputElement).value;
    updateHash();
    renderApp();
  });
}

function insertSafeHTML(element: HTMLElement, dirtyHTML: string) {
  const clean = DOMPurify.sanitize(dirtyHTML, {
    ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'a', 'br'],
    ALLOWED_ATTR: ['href']
  });
  const doc = new DOMParser().parseFromString(clean, 'text/html');
  // clear element first, securely
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
  Array.from(doc.body.childNodes).forEach(child => {
    element.appendChild(child);
  });
}

function renderApp() {
  const searchEl = document.getElementById('search') as HTMLInputElement;
  if (searchEl.value !== currentSearch) {
    searchEl.value = currentSearch;
  }

  const resultsLine = document.getElementById('results-line') as HTMLParagraphElement;
  if (currentSearch) {
    resultsLine.textContent = `results for "${currentSearch}"`;
  } else {
    // clear securely
    resultsLine.textContent = '';
  }

  const feed = document.getElementById('feed') as HTMLElement;
  while (feed.firstChild) {
    feed.removeChild(feed.firstChild);
  }

  const filtered = notes.filter(n => {
    if (!currentSearch) return true;
    const q = currentSearch.toLowerCase();
    return n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q);
  });

  // rendering newest-first
  // Since we push new notes, reverse it
  const displayNotes = [...filtered].reverse();

  for (const n of displayNotes) {
    const article = document.createElement('article');
    article.className = 'note';
    article.dataset.noteId = n.id.toString();
    if (n.id === currentNoteId) {
      article.setAttribute('aria-current', 'true');
    }
    if (n.avatar) {
      const img = document.createElement('img');
      img.className = 'note-avatar';
      // validate avatar URL scheme basic
      if (n.avatar.startsWith('http://') || n.avatar.startsWith('https://') || n.avatar.startsWith('data:image/')) {
        img.src = n.avatar;
      }
      article.appendChild(img);
    }

    const titleDiv = document.createElement('div');
    titleDiv.className = 'note-title';
    insertSafeHTML(titleDiv, n.title);
    
    titleDiv.addEventListener('click', () => {
      currentNoteId = n.id;
      updateHash();
      renderApp();
    });

    article.appendChild(titleDiv);
    
    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'note-body';
    // a newline in the body is also a line break.
    // Replace \n with <br>.
    const processedBody = n.body.replace(/\n/g, '<br>');
    insertSafeHTML(bodyDiv, processedBody);
    article.appendChild(bodyDiv);
    
    feed.appendChild(article);
  }
}

init();
