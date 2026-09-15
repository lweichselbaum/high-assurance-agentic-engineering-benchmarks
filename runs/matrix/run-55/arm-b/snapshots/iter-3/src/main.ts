import DOMPurify from 'dompurify';
import fixtures from '../fixtures.json';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar?: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto_notes';
let notes: Note[] = [];
try {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    notes = JSON.parse(stored);
  } else {
    notes = fixtures as Note[];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }
} catch (e) {
  notes = fixtures as Note[];
}

const app = document.getElementById('app');
if (!app) throw new Error('No #app');

const form = document.createElement('form');
form.id = 'note-form';

const titleInput = document.createElement('input');
titleInput.id = 'title';
titleInput.placeholder = 'Title';

const bodyInput = document.createElement('textarea');
bodyInput.id = 'body';
bodyInput.placeholder = 'Body';

const avatarInput = document.createElement('input');
avatarInput.id = 'avatar';
avatarInput.placeholder = 'Avatar URL';

const submitBtn = document.createElement('button');
submitBtn.type = 'submit';
submitBtn.textContent = 'Add Note';

form.append(titleInput, bodyInput, avatarInput, submitBtn);

const searchInput = document.createElement('input');
searchInput.id = 'search';
searchInput.placeholder = 'Search...';

const resultsLine = document.createElement('p');
resultsLine.id = 'results-line';

const feedSection = document.createElement('section');
feedSection.id = 'feed';

app.append(form, searchInput, resultsLine, feedSection);

function selectNote(id: number) {
  const params = new URLSearchParams(window.location.hash.slice(1));
  params.set('note', String(id));
  window.location.hash = params.toString();
}

function renderNotes() {
  const query = searchInput.value.toLowerCase();
  
  if (query) {
    resultsLine.textContent = `results for "${searchInput.value}"`;
  } else {
    resultsLine.textContent = '';
  }

  while (feedSection.firstChild) {
    feedSection.removeChild(feedSection.firstChild);
  }

  const filtered = notes.filter(n => {
    if (!query) return true;
    const titleMatch = n.title.toLowerCase().includes(query);
    const bodyMatch = n.body && n.body.toLowerCase().includes(query);
    return titleMatch || bodyMatch;
  });

  const sorted = [...filtered].sort((a, b) => b.id - a.id);

  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const selectedNoteId = hashParams.has('note') ? parseInt(hashParams.get('note')!, 10) : null;

  for (const n of sorted) {
    const article = document.createElement('article');
    article.className = 'note';
    article.setAttribute('data-note-id', String(n.id));
    
    if (n.id === selectedNoteId) {
      article.setAttribute('aria-current', 'true');
    }

    const domPurifyParams = {
      ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'a', 'br'],
      ALLOWED_ATTR: ['href'],
      RETURN_DOM_FRAGMENT: true
    };

    const titleDiv = document.createElement('div');
    titleDiv.className = 'note-title';
    titleDiv.appendChild(DOMPurify.sanitize(n.title, domPurifyParams) as DocumentFragment);
    
    titleDiv.addEventListener('click', () => selectNote(n.id));

    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'note-body';
    const safeBody = n.body.replace(/\n/g, '<br>');
    bodyDiv.appendChild(DOMPurify.sanitize(safeBody, domPurifyParams) as DocumentFragment);

    article.append(titleDiv, bodyDiv);

    if (n.avatar) {
      const img = document.createElement('img');
      img.className = 'note-avatar';
      img.src = n.avatar;    
      article.append(img);
    }

    feedSection.append(article);
  }
}

function loadFromHash() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const q = params.get('q') || '';
  if (searchInput.value !== q) {
    searchInput.value = q;
  }
  renderNotes();
}

searchInput.addEventListener('input', () => {
  const val = searchInput.value;
  const params = new URLSearchParams(window.location.hash.slice(1));
  if (val) {
    params.set('q', val);
  } else {
    params.delete('q');
  }
  window.location.hash = params.toString();
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value;
  const avatar = avatarInput.value.trim();

  if (!title && !body) return;

  const newId = notes.length ? Math.max(...notes.map(n => n.id)) + 1 : 1;
  
  notes.push({
    id: newId,
    title,
    body,
    avatar,
    createdAt: new Date().toISOString()
  });
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  
  titleInput.value = '';
  bodyInput.value = '';
  avatarInput.value = '';
  
  renderNotes();
});

window.addEventListener('hashchange', loadFromHash);

// Initial load
loadFromHash();
