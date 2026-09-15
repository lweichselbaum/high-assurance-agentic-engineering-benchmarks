import fixtures from '../fixtures.json';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto_notes_v1';

async function loadNotes(): Promise<Note[]> {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (e) {
      console.error('Failed to parse localStorage notes', e);
    }
  }
  if (Array.isArray(fixtures)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fixtures));
    return fixtures as Note[];
  }
  return [];
}

function saveNotes(notes: Note[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function renderRichText(rawText: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawText, 'text/html');

  function sanitizeNode(node: Node): Node {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      const fragment = document.createDocumentFragment();
      const lines = text.split('\n');
      lines.forEach((line, index) => {
        if (index > 0) {
          fragment.appendChild(document.createElement('br'));
        }
        if (line) {
          fragment.appendChild(document.createTextNode(line));
        }
      });
      return fragment;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tagName = el.tagName.toLowerCase();
      const allowedTags = ['b', 'strong', 'i', 'em', 'a', 'br'];
      if (allowedTags.includes(tagName)) {
        const newEl = document.createElement(tagName);
        if (tagName === 'a') {
          const href = el.getAttribute('href');
          if (href) {
            newEl.setAttribute('href', href);
            newEl.setAttribute('target', '_blank');
            newEl.setAttribute('rel', 'noopener noreferrer');
          }
        }
        for (const child of Array.from(el.childNodes)) {
          newEl.appendChild(sanitizeNode(child));
        }
        return newEl;
      } else {
        const fragment = document.createDocumentFragment();
        for (const child of Array.from(el.childNodes)) {
          fragment.appendChild(sanitizeNode(child));
        }
        return fragment;
      }
    }
    return document.createDocumentFragment();
  }

  const container = document.createElement('div');
  for (const child of Array.from(doc.body.childNodes)) {
    container.appendChild(sanitizeNode(child));
  }
  return container.innerHTML;
}

function readStateFromHash(): { q: string; noteId: number | null } {
  const hash = window.location.hash.replace(/^#/, '');
  const params = new URLSearchParams(hash);
  const q = params.get('q') || '';
  const noteIdStr = params.get('note');
  const noteId = noteIdStr ? Number(noteIdStr) : null;
  return { q, noteId: isNaN(noteId!) ? null : noteId };
}

function updateHash(q: string, noteId: number | null) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (noteId !== null && noteId !== undefined && !isNaN(noteId)) {
    params.set('note', String(noteId));
  }
  const newHash = params.toString();
  const targetHash = newHash ? `#${newHash}` : '#';
  if (window.location.hash !== targetHash) {
    history.replaceState(null, '', targetHash);
  }
}

async function init() {
  const appEl = document.getElementById('app');
  if (!appEl) return;

  appEl.innerHTML = `
    <div class="porto-container">
      <header class="porto-header">
        <h1>Porto Notes</h1>
        <p class="subtitle">Shared notes board for OWASP AppSec Days Porto</p>
      </header>

      <div class="porto-layout">
        <aside class="porto-sidebar">
          <section class="card">
            <h2>Add Note</h2>
            <form id="note-form">
              <div class="form-group">
                <label for="title">Title</label>
                <input id="title" type="text" required placeholder="Note title" />
              </div>
              <div class="form-group">
                <label for="body">Body (supports &lt;b&gt;, &lt;i&gt;, &lt;a href&gt;, &lt;br&gt;)</label>
                <textarea id="body" required rows="4" placeholder="Write note body..."></textarea>
              </div>
              <div class="form-group">
                <label for="avatar">Author Avatar URL (optional)</label>
                <input id="avatar" type="text" placeholder="https://example.com/avatar.png" />
              </div>
              <button type="submit" class="btn-primary">Post Note</button>
            </form>
          </section>
        </aside>

        <main class="porto-main">
          <section class="search-section">
            <div class="search-box-wrapper">
              <input id="search" type="text" placeholder="Search notes by title or body..." />
            </div>
            <p id="results-line"></p>
          </section>

          <section id="feed" class="feed-section" aria-label="Notes feed">
            <!-- Notes rendered here -->
          </section>
        </main>
      </div>
    </div>
  `;

  // Inject styles
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    :root {
      --primary: #0f766e;
      --primary-hover: #115e59;
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --text: #1e293b;
      --text-muted: #64748b;
      --border: #cbd5e1;
      --selected-border: #0f766e;
      --selected-bg: #f0fdfa;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 1.5rem;
    }
    .porto-container {
      max-width: 1200px;
      margin: 0 auto;
    }
    .porto-header {
      margin-bottom: 2rem;
      text-align: center;
    }
    .porto-header h1 {
      font-size: 2.25rem;
      color: var(--primary);
      margin-bottom: 0.25rem;
    }
    .subtitle {
      color: var(--text-muted);
      font-size: 1.05rem;
    }
    .porto-layout {
      display: grid;
      grid-template-columns: 350px 1fr;
      gap: 2rem;
    }
    @media (max-width: 850px) {
      .porto-layout {
        grid-template-columns: 1fr;
      }
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      position: sticky;
      top: 1.5rem;
    }
    .card h2 {
      font-size: 1.25rem;
      margin-bottom: 1rem;
      color: var(--primary);
    }
    .form-group {
      margin-bottom: 1rem;
    }
    .form-group label {
      display: block;
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 0.375rem;
      color: var(--text);
    }
    .form-group input,
    .form-group textarea {
      width: 100%;
      padding: 0.625rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 0.95rem;
      font-family: inherit;
    }
    .form-group input:focus,
    .form-group textarea:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.15);
    }
    .btn-primary {
      width: 100%;
      background-color: var(--primary);
      color: white;
      border: none;
      border-radius: 6px;
      padding: 0.75rem;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    .btn-primary:hover {
      background-color: var(--primary-hover);
    }
    .search-section {
      margin-bottom: 1.5rem;
    }
    .search-box-wrapper input {
      width: 100%;
      padding: 0.75rem 1rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 1rem;
      background: var(--card-bg);
    }
    .search-box-wrapper input:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.15);
    }
    #results-line {
      margin-top: 0.5rem;
      font-size: 0.9rem;
      color: var(--text-muted);
      font-style: italic;
    }
    .feed-section {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .note {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.25rem 1.5rem;
      display: flex;
      gap: 1rem;
      align-items: flex-start;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
      transition: border-color 0.2s, background-color 0.2s;
    }
    .note[aria-current="true"] {
      border-color: var(--selected-border);
      background-color: var(--selected-bg);
      box-shadow: 0 0 0 2px var(--selected-border);
    }
    .note-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
      background: #e2e8f0;
    }
    .note-content {
      flex: 1;
      min-width: 0;
    }
    .note-title {
      font-size: 1.15rem;
      font-weight: 600;
      color: var(--primary);
      cursor: pointer;
      margin-bottom: 0.35rem;
      display: inline-block;
    }
    .note-title:hover {
      text-decoration: underline;
    }
    .note-body {
      color: var(--text);
      word-break: break-word;
    }
    .note-body a {
      color: var(--primary);
      text-decoration: underline;
    }
    .note-meta {
      margin-top: 0.5rem;
      font-size: 0.75rem;
      color: var(--text-muted);
    }
  `;
  document.head.appendChild(styleEl);

  let notes = await loadNotes();
  let initialState = readStateFromHash();
  let searchQuery = initialState.q;
  let selectedNoteId = initialState.noteId;

  const searchInput = document.getElementById('search') as HTMLInputElement;
  const resultsLine = document.getElementById('results-line') as HTMLParagraphElement;
  const noteForm = document.getElementById('note-form') as HTMLFormElement;
  const titleInput = document.getElementById('title') as HTMLInputElement;
  const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
  const avatarInput = document.getElementById('avatar') as HTMLInputElement;
  const feedSection = document.getElementById('feed') as HTMLElement;

  if (searchInput) {
    searchInput.value = searchQuery;
  }

  function renderFeed() {
    const q = searchQuery.trim().toLowerCase();
    let filtered = notes;
    if (q) {
      filtered = notes.filter(
        (n) =>
          n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)
      );
      resultsLine.textContent = `results for "${searchQuery}"`;
    } else {
      resultsLine.textContent = '';
    }

    // Newest first (sort by createdAt desc, then id desc)
    const sorted = [...filtered].sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      if (timeB !== timeA) return timeB - timeA;
      return b.id - a.id;
    });

    if (sorted.length === 0) {
      feedSection.innerHTML = `<p class="no-notes" style="color: var(--text-muted); text-align: center; padding: 2rem;">No notes found.</p>`;
      return;
    }

    feedSection.innerHTML = sorted
      .map((note) => {
        const isSelected = note.id === selectedNoteId;
        const avatarHtml = note.avatar
          ? `<img class="note-avatar" src="${escapeHtml(note.avatar)}" alt="" />`
          : '';
        const dateStr = note.createdAt
          ? new Date(note.createdAt).toLocaleString()
          : '';

        return `
        <article class="note" data-note-id="${note.id}" ${
          isSelected ? 'aria-current="true"' : ''
        }>
          ${avatarHtml}
          <div class="note-content">
            <h3 class="note-title" role="button" tabindex="0">${escapeHtml(
              note.title
            )}</h3>
            <div class="note-body">${renderRichText(note.body)}</div>
            ${dateStr ? `<div class="note-meta">${dateStr}</div>` : ''}
          </div>
        </article>
      `;
      })
      .join('');

    // Attach click listeners to note titles
    feedSection.querySelectorAll('.note').forEach((article) => {
      const noteIdAttr = article.getAttribute('data-note-id');
      const titleEl = article.querySelector('.note-title');
      if (noteIdAttr && titleEl) {
        const id = Number(noteIdAttr);
        const selectNote = () => {
          selectedNoteId = id;
          updateHash(searchQuery, selectedNoteId);
          renderFeed();
        };
        titleEl.addEventListener('click', selectNote);
        titleEl.addEventListener('keydown', (e: Event) => {
          const ke = e as KeyboardEvent;
          if (ke.key === 'Enter' || ke.key === ' ') {
            ke.preventDefault();
            selectNote();
          }
        });
      }
    });
  }

  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Event listeners
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    updateHash(searchQuery, selectedNoteId);
    renderFeed();
  });

  noteForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    const body = bodyInput.value.trim();
    const avatar = avatarInput.value.trim();

    if (!title || !body) return;

    const newId = notes.length > 0 ? Math.max(...notes.map((n) => n.id)) + 1 : 1;
    const newNote: Note = {
      id: newId,
      title,
      body,
      avatar,
      createdAt: new Date().toISOString(),
    };

    notes.push(newNote);
    saveNotes(notes);

    noteForm.reset();
    selectedNoteId = newId;
    updateHash(searchQuery, selectedNoteId);
    renderFeed();

    setTimeout(() => {
      const el = feedSection.querySelector(`[data-note-id="${newId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 50);
  });

  window.addEventListener('hashchange', () => {
    const state = readStateFromHash();
    searchQuery = state.q;
    selectedNoteId = state.noteId;
    if (searchInput.value !== searchQuery) {
      searchInput.value = searchQuery;
    }
    renderFeed();
  });

  renderFeed();
}

init();
