import './style.css';
import fixtures from '../fixtures.json';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar?: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto_notes_data_v1';

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load notes from localStorage', e);
  }
  const seeded = fixtures as Note[];
  saveNotes(seeded);
  return seeded;
}

function saveNotes(notes: Note[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch (e) {
    console.error('Failed to save notes to localStorage', e);
  }
}

// Rich text sanitizer / renderer
function renderRichText(rawBody: string): string {
  const normalized = (rawBody || '').replace(/\r\n/g, '\n');
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${normalized}</div>`, 'text/html');
  const container = doc.body.firstElementChild || doc.body;

  const allowedTags = new Set(['B', 'STRONG', 'I', 'EM', 'A', 'BR']);

  function sanitizeNode(node: Node): Node | string {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      const fragment = document.createDocumentFragment();
      const lines = text.split('\n');
      lines.forEach((line, idx) => {
        if (idx > 0) {
          fragment.appendChild(document.createElement('br'));
        }
        if (line) {
          fragment.appendChild(document.createTextNode(line));
        }
      });
      return fragment;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tagName = el.tagName.toUpperCase();
      if (allowedTags.has(tagName)) {
        const newEl = document.createElement(tagName.toLowerCase());
        if (tagName === 'A') {
          const href = el.getAttribute('href');
          if (href && !href.trim().toLowerCase().startsWith('javascript:')) {
            newEl.setAttribute('href', href);
            newEl.setAttribute('target', '_blank');
            newEl.setAttribute('rel', 'noopener noreferrer');
          }
        }
        for (const child of Array.from(el.childNodes)) {
          const sanitizedChild = sanitizeNode(child);
          if (sanitizedChild) {
            if (typeof sanitizedChild === 'string') {
              newEl.appendChild(document.createTextNode(sanitizedChild));
            } else {
              newEl.appendChild(sanitizedChild);
            }
          }
        }
        return newEl;
      } else {
        const fragment = document.createDocumentFragment();
        for (const child of Array.from(el.childNodes)) {
          const sanitizedChild = sanitizeNode(child);
          if (sanitizedChild) {
            if (typeof sanitizedChild === 'string') {
              fragment.appendChild(document.createTextNode(sanitizedChild));
            } else {
              fragment.appendChild(sanitizedChild);
            }
          }
        }
        return fragment;
      }
    }
    return document.createDocumentFragment();
  }

  const resultFrag = document.createDocumentFragment();
  for (const child of Array.from(container.childNodes)) {
    const sanitized = sanitizeNode(child);
    if (sanitized) {
      if (typeof sanitized === 'string') {
        resultFrag.appendChild(document.createTextNode(sanitized));
      } else {
        resultFrag.appendChild(sanitized);
      }
    }
  }

  const tempDiv = document.createElement('div');
  tempDiv.appendChild(resultFrag);
  return tempDiv.innerHTML;
}

// App State
let notes: Note[] = loadNotes();
let searchQuery = '';
let selectedNoteId: number | null = null;

// Parse initial URL fragment (#q=...&note=...)
function parseHash() {
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash);
  searchQuery = params.get('q') || '';
  const noteParam = params.get('note');
  selectedNoteId = noteParam ? Number(noteParam) : null;
}

parseHash();

// Render app UI into #app
const appContainer = document.getElementById('app');
if (appContainer) {
  appContainer.innerHTML = `
    <div class="porto-app">
      <header class="app-header">
        <h1>Porto Notes</h1>
        <p class="subtitle">Shared Notes Board</p>
      </header>

      <div class="app-content">
        <aside class="sidebar">
          <section class="card form-card">
            <h2>Add New Note</h2>
            <form id="note-form">
              <div class="form-group">
                <label for="title">Title</label>
                <input type="text" id="title" required placeholder="Note title..." />
              </div>
              <div class="form-group">
                <label for="body">Body (supports &lt;b&gt;, &lt;i&gt;, &lt;a&gt;, &lt;br&gt;)</label>
                <textarea id="body" rows="4" required placeholder="Write your note here..."></textarea>
              </div>
              <div class="form-group">
                <label for="avatar">Avatar URL (optional)</label>
                <input type="text" id="avatar" placeholder="https://example.com/avatar.png" />
              </div>
              <button type="submit" class="btn-primary">Add Note</button>
            </form>
          </section>

          <section class="card search-card">
            <h2>Search Notes</h2>
            <div class="form-group">
              <input type="text" id="search" placeholder="Search by title or body..." value="${escapeHtml(searchQuery)}" />
            </div>
            <p id="results-line" class="results-line"></p>
          </section>
        </aside>

        <main class="main-feed">
          <section id="feed" class="feed-section"></section>
        </main>
      </div>
    </div>
  `;
}

function escapeHtml(str: string): string {
  return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Elements
const noteForm = document.getElementById('note-form') as HTMLFormElement;
const titleInput = document.getElementById('title') as HTMLInputElement;
const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
const avatarInput = document.getElementById('avatar') as HTMLInputElement;
const searchInput = document.getElementById('search') as HTMLInputElement;
const resultsLine = document.getElementById('results-line') as HTMLElement;
const feedSection = document.getElementById('feed') as HTMLElement;

function updateHash() {
  const params = new URLSearchParams();
  if (searchQuery.trim()) {
    params.set('q', searchQuery.trim());
  }
  if (selectedNoteId !== null) {
    params.set('note', String(selectedNoteId));
  }
  const str = params.toString();
  const newHash = str ? `#${str}` : '#';
  if (window.location.hash !== newHash) {
    history.replaceState(null, '', newHash);
  }
}

function render() {
  // Filter notes
  const q = searchQuery.toLowerCase().trim();
  const filtered = notes.filter(n => {
    if (!q) return true;
    return (n.title || '').toLowerCase().includes(q) || (n.body || '').toLowerCase().includes(q);
  });

  // Sort newest first (by createdAt descending, fallback to id descending)
  filtered.sort((a, b) => {
    const timeA = new Date(a.createdAt || 0).getTime();
    const timeB = new Date(b.createdAt || 0).getTime();
    if (timeB !== timeA) return timeB - timeA;
    return b.id - a.id;
  });

  // Results line
  if (searchQuery.trim()) {
    resultsLine.textContent = `results for "${searchQuery.trim()}"`;
    resultsLine.style.display = 'block';
  } else {
    resultsLine.textContent = '';
    resultsLine.style.display = 'none';
  }

  // Render feed
  feedSection.innerHTML = '';
  if (filtered.length === 0) {
    feedSection.innerHTML = `<p class="no-notes">No notes found.</p>`;
    return;
  }

  filtered.forEach(note => {
    const article = document.createElement('article');
    article.className = 'note';
    article.dataset.noteId = String(note.id);
    if (selectedNoteId === note.id) {
      article.setAttribute('aria-current', 'true');
    }

    let avatarHtml = '';
    if (note.avatar && note.avatar.trim()) {
      avatarHtml = `<img class="note-avatar" src="${escapeHtml(note.avatar)}" alt="${escapeHtml(note.title)} avatar" />`;
    }

    const formattedBody = renderRichText(note.body);
    const formattedDate = note.createdAt ? new Date(note.createdAt).toLocaleString() : '';

    article.innerHTML = `
      <div class="note-header">
        ${avatarHtml}
        <div class="note-meta-titles">
          <h3 class="note-title" role="button" tabindex="0">${escapeHtml(note.title)}</h3>
          ${formattedDate ? `<span class="note-date">${formattedDate}</span>` : ''}
        </div>
      </div>
      <div class="note-body">${formattedBody}</div>
    `;

    // Click handler for title selection
    const titleEl = article.querySelector('.note-title');
    if (titleEl) {
      const selectNote = () => {
        selectedNoteId = note.id;
        updateHash();
        render();
        article.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      };
      titleEl.addEventListener('click', selectNote);
      titleEl.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectNote();
        }
      });
    }

    feedSection.appendChild(article);
  });
}

// Event Listeners
if (noteForm) {
  noteForm.addEventListener('submit', (e) => {
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
    saveNotes(notes);

    noteForm.reset();
    selectedNoteId = newNote.id;
    updateHash();
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
  parseHash();
  if (searchInput && searchInput.value !== searchQuery) {
    searchInput.value = searchQuery;
  }
  render();
});

// Initial render
render();
