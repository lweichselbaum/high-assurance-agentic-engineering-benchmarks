import fixtures from '../fixtures.json';
import DOMPurify from 'dompurify';
import './styles.css';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar?: string;
  createdAt: string;
}

let notes: Note[] = [];

// App Elements
const app = document.getElementById('app');

function initData() {
  const stored = localStorage.getItem('porto_notes');
  if (stored) {
    try {
      notes = JSON.parse(stored);
    } catch {
      notes = fixtures as Note[];
      saveNotes();
    }
  } else {
    notes = fixtures as Note[];
    saveNotes();
  }
}

function saveNotes() {
  localStorage.setItem('porto_notes', JSON.stringify(notes));
}

function getHashState(): { q: string; note: number | null } {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  const qStr = params.get('q') || '';
  const noteStr = params.get('note');
  const note = noteStr ? parseInt(noteStr, 10) : null;
  return { q: qStr, note: isNaN(note as number) ? null : note };
}

function updateHashState(q: string, note: number | null) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (note !== null) params.set('note', note.toString());
  
  const hashStr = params.toString();
  const oldHash = window.location.hash.replace(/^#/, '');
  if (oldHash !== hashStr) {
    if (hashStr) {
      window.location.hash = hashStr;
    } else {
      history.replaceState(null, '', window.location.pathname + window.location.search);
      window.dispatchEvent(new Event('hashchange'));
    }
  }
}

function renderRichText(element: HTMLElement, text: string) {
  const textWithBr = text.replace(/\n/g, '<br>');
  const fragment = DOMPurify.sanitize(textWithBr, {
    ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'a', 'br'],
    ALLOWED_ATTR: ['href'],
    RETURN_DOM_FRAGMENT: true
  });
  element.replaceChildren(fragment);
}

function renderApp() {
  if (!app) return;
  app.replaceChildren();

  const container = document.createElement('div');
  container.className = 'container';

  // Header & Search
  const header = document.createElement('header');
  
  const searchInput = document.createElement('input');
  searchInput.id = 'search';
  searchInput.type = 'search';
  searchInput.placeholder = 'Search notes...';
  
  const resultsLine = document.createElement('p');
  resultsLine.id = 'results-line';
  
  header.appendChild(searchInput);
  header.appendChild(resultsLine);
  
  // Note Form
  const form = document.createElement('form');
  form.id = 'note-form';
  
  const titleInput = document.createElement('input');
  titleInput.id = 'title';
  titleInput.placeholder = 'Title';
  titleInput.required = true;
  
  const bodyInput = document.createElement('textarea');
  bodyInput.id = 'body';
  bodyInput.placeholder = 'Body (supports basic rich text)';
  bodyInput.required = true;
  
  const avatarInput = document.createElement('input');
  avatarInput.id = 'avatar';
  avatarInput.placeholder = 'Avatar URL (optional)';
  avatarInput.type = 'url';
  
  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.textContent = 'Add Note';
  
  form.appendChild(titleInput);
  form.appendChild(bodyInput);
  form.appendChild(avatarInput);
  form.appendChild(submitBtn);

  // Feed
  const feedSection = document.createElement('section');
  feedSection.id = 'feed';

  container.appendChild(header);
  container.appendChild(form);
  container.appendChild(feedSection);
  app.appendChild(container);
  
  // Handlers
  searchInput.addEventListener('input', () => {
    const currentState = getHashState();
    updateHashState(searchInput.value, currentState.note);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const newNote: Note = {
      id: notes.length > 0 ? Math.max(...notes.map(n => n.id)) + 1 : 1,
      title: titleInput.value,
      body: bodyInput.value,
      avatar: avatarInput.value || undefined,
      createdAt: new Date().toISOString()
    };
    notes.push(newNote);
    saveNotes();
    form.reset();
    renderFeed();
  });
  
  window.addEventListener('hashchange', () => {
    const state = getHashState();
    if (searchInput.value !== state.q) {
      searchInput.value = state.q;
    }
    renderFeed();
  });

  // Init UI base state
  const { q } = getHashState();
  searchInput.value = q;
  renderFeed();
}

function renderFeed() {
  const feed = document.getElementById('feed');
  const resultsLine = document.getElementById('results-line');
  if (!feed || !resultsLine) return;
  
  feed.replaceChildren();

  const { q, note } = getHashState();
  
  if (q) {
    resultsLine.textContent = `results for "${q}"`;
  } else {
    resultsLine.textContent = '';
  }

  const queryLower = q.toLowerCase();

  // sort newest-first
  const sortedNotes = [...notes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  const filteredNotes = sortedNotes.filter(n => {
    if (!q) return true;
    return n.title.toLowerCase().includes(queryLower) || n.body.toLowerCase().includes(queryLower);
  });

  const dompurifySanitizeUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      if (['http:', 'https:', 'data:'].includes(parsed.protocol)) {
        return url;
      }
    } catch {
      // ignore
    }
    return '';
  };

  for (const n of filteredNotes) {
    const article = document.createElement('article');
    article.className = 'note';
    article.setAttribute('data-note-id', n.id.toString());
    
    if (n.id === note) {
      article.setAttribute('aria-current', 'true');
    }

    if (n.avatar) {
      const img = document.createElement('img');
      img.className = 'note-avatar';
      const cleanUrl = dompurifySanitizeUrl(n.avatar);
      if (cleanUrl) {
          img.src = cleanUrl;
          img.alt = '';
          article.appendChild(img);
      }
    }

    const contentDiv = document.createElement('div');
    contentDiv.className = 'note-content';

    const titleDiv = document.createElement('div');
    titleDiv.className = 'note-title';
    renderRichText(titleDiv, n.title);
    
    titleDiv.addEventListener('click', () => {
      const currentState = getHashState();
      updateHashState(currentState.q, n.id);
    });

    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'note-body';
    renderRichText(bodyDiv, n.body);

    contentDiv.appendChild(titleDiv);
    contentDiv.appendChild(bodyDiv);
    
    article.appendChild(contentDiv);
    feed.appendChild(article);
  }
}

initData();
renderApp();
