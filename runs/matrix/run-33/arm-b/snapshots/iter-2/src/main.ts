import fixtures from '../fixtures.json';
import { sanitizeHtml } from 'safevalues';
import { setElementInnerHtml, setAnchorHref } from 'safevalues/dom';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

const STORAGE_KEY = 'portonotes_notes_v1';

function loadNotes(): Note[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // fallback to fixtures
  }
  return fixtures as Note[];
}

function saveNotes(notes: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // ignore
  }
}

function isValidAvatarUrl(url: string): boolean {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
  return trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:image/');
}

function parseFragment(): { query: string; noteId: number | null } {
  const hash = window.location.hash.replace(/^#/, '');
  const params = new URLSearchParams(hash);
  const q = params.get('q') || '';
  const noteParam = params.get('note');
  const noteId = noteParam ? parseInt(noteParam, 10) : null;
  return { query: q, noteId: isNaN(noteId!) ? null : noteId };
}

function updateFragment(query: string, noteId: number | null): void {
  const params = new URLSearchParams();
  if (query) {
    params.set('q', query);
  }
  if (noteId !== null) {
    params.set('note', String(noteId));
  }
  const newHash = params.toString() ? '#' + params.toString() : '#';
  if (window.location.hash !== newHash) {
    history.replaceState(null, '', newHash);
  }
}

function formatBody(body: string): string {
  let processed = body;
  if (!processed.includes('<br>')) {
    processed = processed.replace(/\r?\n/g, '<br>');
  }
  return processed;
}

class PortoNotesApp {
  private notes: Note[] = [];
  private searchQuery: string = '';
  private selectedNoteId: number | null = null;

  private appEl: HTMLElement;
  private formEl!: HTMLFormElement;
  private titleInput!: HTMLInputElement;
  private bodyTextarea!: HTMLTextAreaElement;
  private avatarInput!: HTMLInputElement;
  private searchInput!: HTMLInputElement;
  private resultsLineEl!: HTMLElement;
  private feedEl!: HTMLElement;

  constructor() {
    this.notes = loadNotes();
    const initial = parseFragment();
    this.searchQuery = initial.query;
    this.selectedNoteId = initial.noteId;

    const mainApp = document.getElementById('app');
    if (!mainApp) throw new Error('App root not found');
    this.appEl = mainApp;

    this.renderLayout();
    this.bindEvents();
    this.syncStateFromUrl();
    this.render();
  }

  private renderLayout(): void {
    this.appEl.innerHTML = `
      <div class="porto-notes-container">
        <header>
          <h1>Porto Notes</h1>
          <p class="subtitle">Shared notes board</p>
        </header>
        
        <section class="controls-section">
          <form id="note-form">
            <h2>Add a Note</h2>
            <div class="form-group">
              <label for="title">Title</label>
              <input id="title" type="text" required placeholder="Note title..." />
            </div>
            <div class="form-group">
              <label for="body">Body (supports &lt;b&gt;, &lt;i&gt;, &lt;a href="..."&gt;, &lt;br&gt;)</label>
              <textarea id="body" required rows="3" placeholder="Write your note here..."></textarea>
            </div>
            <div class="form-group">
              <label for="avatar">Author Avatar URL (optional)</label>
              <input id="avatar" type="url" placeholder="https://... or data:image/..." />
            </div>
            <button type="submit">Add Note</button>
          </form>

          <div class="search-container">
            <label for="search">Search Notes</label>
            <input id="search" type="text" placeholder="Search by title or body..." value="${this.escapeHtml(this.searchQuery)}" />
            <p id="results-line"></p>
          </div>
        </section>

        <section id="feed" class="feed-section">
        </section>
      </div>
    `;

    this.formEl = document.getElementById('note-form') as HTMLFormElement;
    this.titleInput = document.getElementById('title') as HTMLInputElement;
    this.bodyTextarea = document.getElementById('body') as HTMLTextAreaElement;
    this.avatarInput = document.getElementById('avatar') as HTMLInputElement;
    this.searchInput = document.getElementById('search') as HTMLInputElement;
    this.resultsLineEl = document.getElementById('results-line') as HTMLElement;
    this.feedEl = document.getElementById('feed') as HTMLElement;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private bindEvents(): void {
    this.formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleAddNote();
    });

    this.searchInput.addEventListener('input', () => {
      this.searchQuery = this.searchInput.value;
      updateFragment(this.searchQuery, this.selectedNoteId);
      this.render();
    });

    window.addEventListener('hashchange', () => {
      this.syncStateFromUrl();
      this.render();
    });

    this.feedEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const noteArticle = target.closest('.note') as HTMLElement;
      if (noteArticle) {
        const noteIdStr = noteArticle.getAttribute('data-note-id');
        if (noteIdStr) {
          const id = parseInt(noteIdStr, 10);
          if (!isNaN(id)) {
            this.selectedNoteId = id;
            updateFragment(this.searchQuery, this.selectedNoteId);
            this.render();
          }
        }
      }
    });
  }

  private syncStateFromUrl(): void {
    const { query, noteId } = parseFragment();
    this.searchQuery = query;
    this.selectedNoteId = noteId;
    if (this.searchInput && this.searchInput.value !== this.searchQuery) {
      this.searchInput.value = this.searchQuery;
    }
  }

  private handleAddNote(): void {
    const title = this.titleInput.value.trim();
    const body = this.bodyTextarea.value.trim();
    const avatar = this.avatarInput.value.trim();

    if (!title || !body) return;

    const maxId = this.notes.reduce((max, n) => Math.max(max, n.id), 0);
    const newNote: Note = {
      id: maxId + 1,
      title,
      body,
      avatar: isValidAvatarUrl(avatar) ? avatar : '',
      createdAt: new Date().toISOString(),
    };

    this.notes.unshift(newNote);
    saveNotes(this.notes);

    this.formEl.reset();
    this.render();
  }

  private render(): void {
    if (this.searchInput && this.searchInput.value !== this.searchQuery) {
      this.searchInput.value = this.searchQuery;
    }

    if (this.searchQuery) {
      this.resultsLineEl.textContent = `results for "${this.searchQuery}"`;
    } else {
      this.resultsLineEl.textContent = '';
    }

    const q = this.searchQuery.toLowerCase();
    const filtered = this.notes.filter((note) => {
      if (!q) return true;
      return note.title.toLowerCase().includes(q) || note.body.toLowerCase().includes(q);
    });

    filtered.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      if (timeA !== timeB) return timeB - timeA;
      return b.id - a.id;
    });

    this.feedEl.innerHTML = '';
    if (filtered.length === 0) {
      const emptyEl = document.createElement('p');
      emptyEl.className = 'no-notes';
      emptyEl.textContent = 'No notes found.';
      this.feedEl.appendChild(emptyEl);
      return;
    }

    for (const note of filtered) {
      const article = document.createElement('article');
      article.className = 'note';
      article.setAttribute('data-note-id', String(note.id));

      if (this.selectedNoteId === note.id) {
        article.setAttribute('aria-current', 'true');
      }

      if (note.avatar && isValidAvatarUrl(note.avatar)) {
        const img = document.createElement('img');
        img.className = 'note-avatar';
        img.src = note.avatar;
        img.alt = `${note.title} avatar`;
        article.appendChild(img);
      }

      const titleEl = document.createElement('h3');
      titleEl.className = 'note-title';
      titleEl.textContent = note.title;
      article.appendChild(titleEl);

      const bodyEl = document.createElement('div');
      bodyEl.className = 'note-body';
      const formatted = formatBody(note.body);
      const safeHtml = sanitizeHtml(formatted);
      setElementInnerHtml(bodyEl, safeHtml);

      const links = bodyEl.querySelectorAll('a');
      links.forEach((a) => {
        const href = a.getAttribute('href');
        if (href) {
          setAnchorHref(a, href);
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener noreferrer');
        }
      });

      article.appendChild(bodyEl);

      const metaEl = document.createElement('div');
      metaEl.className = 'note-meta';
      metaEl.textContent = new Date(note.createdAt).toLocaleString();
      article.appendChild(metaEl);

      this.feedEl.appendChild(article);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new PortoNotesApp();
});
