import { seedFixtures } from './fixtures';
import { SafeHtml } from 'safevalues';
import { htmlSafeByReview } from 'safevalues/restricted/reviewed';
import { setElementInnerHtml } from 'safevalues/dom';
import DOMPurify from 'dompurify';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto_notes_v1';

function getInitialNotes(): Note[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return [...seedFixtures];
}

let notes: Note[] = getInitialNotes();

function saveNotes() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // ignore
  }
}

function parseHash() {
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const params = new URLSearchParams(hash);
  const q = params.get('q') || '';
  const noteStr = params.get('note');
  const noteId = noteStr ? parseInt(noteStr, 10) : null;
  return { q, noteId };
}

let { q: searchQuery, noteId: selectedNoteId } = parseHash();

function updateHash() {
  const params = new URLSearchParams();
  if (searchQuery) params.set('q', searchQuery);
  if (selectedNoteId !== null) params.set('note', String(selectedNoteId));
  const str = params.toString();
  const newHash = str ? `#${str}` : '';
  if (window.location.hash !== newHash) {
    history.replaceState(null, '', newHash || window.location.pathname);
  }
}

// Inject styles and HTML structure
const app = document.getElementById('app');
if (app) {
  const style = document.createElement('style');
  style.textContent = `
    :root {
      --primary: #0f766e;
      --primary-hover: #115e59;
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --text: #1e293b;
      --text-muted: #64748b;
      --border: #cbd5e1;
      --focus: #0ea5e9;
    }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 0;
      line-height: 1.5;
    }
    .porto-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem 1rem;
    }
    header.app-header {
      text-align: center;
      margin-bottom: 2rem;
    }
    header.app-header h1 {
      margin: 0 0 0.5rem 0;
      color: var(--primary);
    }
    header.app-header p {
      margin: 0;
      color: var(--text-muted);
    }
    section.card-section, .form-section, .search-section, .feed-section {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .form-group {
      margin-bottom: 1rem;
    }
    label {
      display: block;
      font-weight: 600;
      margin-bottom: 0.3rem;
      font-size: 0.9rem;
    }
    input[type="text"], input[type="url"], textarea {
      width: 100%;
      padding: 0.6rem;
      border: 1px solid var(--border);
      border-radius: 4px;
      font-size: 1rem;
      box-sizing: border-box;
    }
    input:focus, textarea:focus {
      outline: 2px solid var(--focus);
      border-color: transparent;
    }
    button[type="submit"] {
      background-color: var(--primary);
      color: white;
      border: none;
      padding: 0.7rem 1.2rem;
      font-size: 1rem;
      font-weight: 600;
      border-radius: 4px;
      cursor: pointer;
    }
    button[type="submit"]:hover {
      background-color: var(--primary-hover);
    }
    #results-line {
      margin-top: 0.5rem;
      font-style: italic;
      color: var(--text-muted);
      min-height: 1.2rem;
    }
    #feed {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    article.note {
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 1rem;
      position: relative;
      transition: border-color 0.2s;
    }
    article.note[aria-current="true"] {
      border-color: var(--primary);
      box-shadow: 0 0 0 2px rgba(15, 118, 110, 0.2);
    }
    .note-title {
      margin: 0 0 0.5rem 0;
      font-size: 1.2rem;
      color: var(--primary);
      cursor: pointer;
    }
    .note-title:hover {
      text-decoration: underline;
    }
    .note-body {
      margin: 0;
      white-space: pre-line;
      word-break: break-word;
    }
    .note-avatar {
      float: right;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      object-fit: cover;
      margin-left: 1rem;
    }
    .no-notes {
      color: var(--text-muted);
      text-align: center;
      margin: 1rem 0;
    }
  `;
  document.head.appendChild(style);

  const container = document.createElement('div');
  container.className = 'porto-container';

  const header = document.createElement('header');
  header.className = 'app-header';
  const h1 = document.createElement('h1');
  h1.textContent = 'Porto Notes';
  const pHeader = document.createElement('p');
  pHeader.textContent = 'Shared board for notes and tips';
  header.appendChild(h1);
  header.appendChild(pHeader);
  container.appendChild(header);

  const formSection = document.createElement('div');
  formSection.className = 'form-section';
  const form = document.createElement('form');
  form.id = 'note-form';
  const h2Form = document.createElement('h2');
  h2Form.textContent = 'Add Note';
  form.appendChild(h2Form);

  const groupTitle = document.createElement('div');
  groupTitle.className = 'form-group';
  const labelTitle = document.createElement('label');
  labelTitle.setAttribute('for', 'title');
  labelTitle.textContent = 'Title';
  const inputTitle = document.createElement('input');
  inputTitle.id = 'title';
  inputTitle.type = 'text';
  inputTitle.required = true;
  inputTitle.placeholder = 'Note title';
  groupTitle.appendChild(labelTitle);
  groupTitle.appendChild(inputTitle);
  form.appendChild(groupTitle);

  const groupBody = document.createElement('div');
  groupBody.className = 'form-group';
  const labelBody = document.createElement('label');
  labelBody.setAttribute('for', 'body');
  labelBody.textContent = 'Body (supports <b>, <strong>, <i>, <em>, <a href="...">, <br>, newlines)';
  const textareaBody = document.createElement('textarea');
  textareaBody.id = 'body';
  textareaBody.rows = 3;
  textareaBody.required = true;
  textareaBody.placeholder = 'Write your note...';
  groupBody.appendChild(labelBody);
  groupBody.appendChild(textareaBody);
  form.appendChild(groupBody);

  const groupAvatar = document.createElement('div');
  groupAvatar.className = 'form-group';
  const labelAvatar = document.createElement('label');
  labelAvatar.setAttribute('for', 'avatar');
  labelAvatar.textContent = 'Author Avatar URL (optional)';
  const inputAvatar = document.createElement('input');
  inputAvatar.id = 'avatar';
  inputAvatar.type = 'text';
  inputAvatar.placeholder = 'https://...';
  groupAvatar.appendChild(labelAvatar);
  groupAvatar.appendChild(inputAvatar);
  form.appendChild(groupAvatar);

  const buttonSubmit = document.createElement('button');
  buttonSubmit.type = 'submit';
  buttonSubmit.textContent = 'Submit Note';
  form.appendChild(buttonSubmit);

  formSection.appendChild(form);
  container.appendChild(formSection);

  const searchSection = document.createElement('div');
  searchSection.className = 'search-section';
  const groupSearch = document.createElement('div');
  groupSearch.className = 'form-group';
  groupSearch.style.marginBottom = '0';
  const labelSearch = document.createElement('label');
  labelSearch.setAttribute('for', 'search');
  labelSearch.textContent = 'Search';
  const inputSearch = document.createElement('input');
  inputSearch.id = 'search';
  inputSearch.type = 'text';
  inputSearch.placeholder = 'Filter notes...';
  groupSearch.appendChild(labelSearch);
  groupSearch.appendChild(inputSearch);
  searchSection.appendChild(groupSearch);

  const resultsLine = document.createElement('p');
  resultsLine.id = 'results-line';
  searchSection.appendChild(resultsLine);
  container.appendChild(searchSection);

  const feedSectionDiv = document.createElement('div');
  feedSectionDiv.className = 'feed-section';
  const h2Feed = document.createElement('h2');
  h2Feed.textContent = 'Feed';
  feedSectionDiv.appendChild(h2Feed);
  const feedSection = document.createElement('section');
  feedSection.id = 'feed';
  feedSectionDiv.appendChild(feedSection);
  container.appendChild(feedSectionDiv);

  app.appendChild(container);
}

const form = document.getElementById('note-form') as HTMLFormElement;
const searchInput = document.getElementById('search') as HTMLInputElement;
const resultsLine = document.getElementById('results-line') as HTMLElement;
const feedSection = document.getElementById('feed') as HTMLElement;
const titleInput = document.getElementById('title') as HTMLInputElement;
const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
const avatarInput = document.getElementById('avatar') as HTMLInputElement;

if (searchInput) {
  searchInput.value = searchQuery;
}

const ALLOWED_BODY_TAGS = ['b', 'strong', 'i', 'em', 'a', 'br'];
const ALLOWED_BODY_ATTR = ['href'];

function renderBody(body: string): SafeHtml {
  const withBr = body.replace(/\r?\n/g, '<br>');
  const clean = DOMPurify.sanitize(withBr, {
    ALLOWED_TAGS: ALLOWED_BODY_TAGS,
    ALLOWED_ATTR: ALLOWED_BODY_ATTR,
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['img', 'svg'],
    FORBID_ATTR: ['onerror', 'onload'],
    KEEP_CONTENT: true,
  });
  return htmlSafeByReview(clean, { justification: 'Sanitized note body' });
}

function render() {
  if (!feedSection || !resultsLine) return;

  const qLower = searchQuery.toLowerCase().trim();
  const filtered = notes.filter(note => {
    if (!qLower) return true;
    return note.title.toLowerCase().includes(qLower) || note.body.toLowerCase().includes(qLower);
  });

  const sorted = [...filtered].sort((a, b) => {
    const comp = b.createdAt.localeCompare(a.createdAt);
    if (comp !== 0) return comp;
    return b.id - a.id;
  });

  if (searchQuery.trim()) {
    resultsLine.textContent = `results for "${searchQuery}"`;
  } else {
    resultsLine.textContent = '';
  }

  feedSection.textContent = '';

  if (sorted.length === 0) {
    const p = document.createElement('p');
    p.className = 'no-notes';
    p.textContent = 'No matching notes found.';
    feedSection.appendChild(p);
    return;
  }

  for (const note of sorted) {
    const article = document.createElement('article');
    article.className = 'note';
    article.setAttribute('data-note-id', String(note.id));
    if (note.id === selectedNoteId) {
      article.setAttribute('aria-current', 'true');
    }

    if (note.avatar && note.avatar.trim() !== '') {
      const trimmedAvatar = note.avatar.trim();
      if (trimmedAvatar.startsWith('http://') || trimmedAvatar.startsWith('https://') || trimmedAvatar.startsWith('data:image/')) {
        const img = document.createElement('img');
        img.className = 'note-avatar';
        img.src = trimmedAvatar;
        img.alt = '';
        article.appendChild(img);
      }
    }

    const titleEl = document.createElement('h3');
    titleEl.className = 'note-title';
    titleEl.textContent = note.title;
    titleEl.addEventListener('click', () => {
      selectedNoteId = note.id;
      updateHash();
      render();
    });
    article.appendChild(titleEl);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'note-body';
    setElementInnerHtml(bodyEl, renderBody(note.body));
    article.appendChild(bodyEl);

    feedSection.appendChild(article);
  }
}

if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    const body = bodyInput.value.trim();
    const avatar = avatarInput.value.trim();

    if (!title || !body) return;

    const maxId = notes.reduce((max, n) => Math.max(max, n.id), 0);
    const newNote: Note = {
      id: maxId + 1,
      title,
      body,
      avatar,
      createdAt: new Date().toISOString(),
    };

    notes.unshift(newNote);
    saveNotes();

    titleInput.value = '';
    bodyInput.value = '';
    avatarInput.value = '';

    render();
  });
}

if (searchInput) {
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    updateHash();
    render();
  });
}

window.addEventListener('hashchange', () => {
  const parsed = parseHash();
  searchQuery = parsed.q;
  selectedNoteId = parsed.noteId;
  if (searchInput && searchInput.value !== searchQuery) {
    searchInput.value = searchQuery;
  }
  render();
});

render();
