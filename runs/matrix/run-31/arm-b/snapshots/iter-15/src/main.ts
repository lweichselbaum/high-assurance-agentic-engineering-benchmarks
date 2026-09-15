import { seedFixtures } from './fixtures';
import { HtmlSanitizerBuilder, sanitizeHtml, SafeHtml } from 'safevalues';
import { setElementInnerHtml } from 'safevalues/dom';

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

  const htmlContent = `
    <div class="porto-container">
      <header class="app-header">
        <h1>Porto Notes</h1>
        <p>Shared board for notes and tips</p>
      </header>

      <div class="form-section">
        <form id="note-form">
          <h2>Add Note</h2>
          <div class="form-group">
            <label for="title">Title</label>
            <input id="title" type="text" required placeholder="Note title" />
          </div>
          <div class="form-group">
            <label for="body">Body (supports &lt;b&gt;, &lt;strong&gt;, &lt;i&gt;, &lt;em&gt;, &lt;a href="..."&gt;, &lt;br&gt;, newlines)</label>
            <textarea id="body" rows="3" required placeholder="Write your note..."></textarea>
          </div>
          <div class="form-group">
            <label for="avatar">Author Avatar URL (optional)</label>
            <input id="avatar" type="text" placeholder="https://..." />
          </div>
          <button type="submit">Submit Note</button>
        </form>
      </div>

      <div class="search-section">
        <div class="form-group" style="margin-bottom: 0;">
          <label for="search">Search</label>
          <input id="search" type="text" placeholder="Filter notes..." />
        </div>
        <p id="results-line"></p>
      </div>

      <div class="feed-section">
        <h2>Feed</h2>
        <section id="feed"></section>
      </div>
    </div>
  `;
  setElementInnerHtml(app, sanitizeHtml(htmlContent));
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

const bodySanitizer = (() => {
  const b = new HtmlSanitizerBuilder();
  b.onlyAllowElements(new Set(['b', 'strong', 'i', 'em', 'a', 'br']));
  b.onlyAllowAttributes(new Set(['href']));
  return b.build();
})();

function renderBody(body: string): SafeHtml {
  const cleaned = body
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
    .replace(/onerror\s*=\s*(["']).*?\1/gi, '')
    .replace(/onload\s*=\s*(["']).*?\1/gi, '')
    .replace(/onerror\s*=\s*[^\s>]+/gi, '')
    .replace(/onload\s*=\s*[^\s>]+/gi, '');

  const withBr = cleaned.replace(/\r?\n/g, '<br>');
  return bodySanitizer.sanitize(withBr);
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
      const img = document.createElement('img');
      img.className = 'note-avatar';
      img.src = note.avatar.trim();
      img.alt = '';
      article.appendChild(img);
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
