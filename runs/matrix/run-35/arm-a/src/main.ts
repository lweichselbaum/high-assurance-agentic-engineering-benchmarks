import fixtures from '../fixtures.json';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar?: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto_notes';

class PortoNotesApp {
  private notes: Note[] = [];
  private searchQuery = '';
  private selectedNoteId: number | null = null;

  private formEl = document.getElementById('note-form') as HTMLFormElement;
  private titleInput = document.getElementById('title') as HTMLInputElement;
  private bodyInput = document.getElementById('body') as HTMLTextAreaElement;
  private avatarInput = document.getElementById('avatar') as HTMLInputElement;
  private searchInput = document.getElementById('search') as HTMLInputElement;
  private resultsLine = document.getElementById('results-line') as HTMLElement;
  private feedEl = document.getElementById('feed') as HTMLElement;

  constructor() {
    this.initData();
    this.initFromHash();
    this.setupListeners();
    this.render();
  }

  private initData() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.notes = parsed;
          return;
        }
      }
    } catch (e) {
      console.error('Failed to load notes from localStorage', e);
    }
    // Seed data
    this.notes = JSON.parse(JSON.stringify(fixtures));
    this.saveNotes();
  }

  private saveNotes() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.notes));
    } catch (e) {
      console.error('Failed to save notes to localStorage', e);
    }
  }

  private initFromHash() {
    this.parseHash();
  }

  private parseHash() {
    const hash = location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);
    const q = params.get('q') || '';
    const noteStr = params.get('note');
    const noteId = noteStr ? parseInt(noteStr, 10) : null;

    this.searchQuery = q;
    this.selectedNoteId = isNaN(noteId!) ? null : noteId;

    if (this.searchInput.value !== q) {
      this.searchInput.value = q;
    }
  }

  private updateHash() {
    const params = new URLSearchParams();
    if (this.searchQuery.trim()) {
      params.set('q', this.searchQuery);
    }
    if (this.selectedNoteId !== null) {
      params.set('note', String(this.selectedNoteId));
    }
    const str = params.toString();
    const newHash = str ? `#${str}` : '#';
    if (location.hash !== newHash) {
      history.replaceState(null, '', newHash);
    }
  }

  private setupListeners() {
    // Search input
    this.searchInput.addEventListener('input', () => {
      this.searchQuery = this.searchInput.value;
      this.updateHash();
      this.render();
    });

    // Form submit
    this.formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = this.titleInput.value.trim();
      const body = this.bodyInput.value.trim();
      const avatar = this.avatarInput.value.trim();

      if (!title || !body) return;

      const maxId = this.notes.reduce((max, n) => (n.id > max ? n.id : max), 0);
      const newNote: Note = {
        id: maxId + 1,
        title,
        body,
        avatar: avatar || undefined,
        createdAt: new Date().toISOString(),
      };

      this.notes.unshift(newNote); // newest first
      this.saveNotes();
      this.formEl.reset();
      this.render();
    });

    // Hash change / popstate
    window.addEventListener('hashchange', () => {
      this.parseHash();
      this.render();
    });

    // Feed click delegation for title selection
    this.feedEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const titleEl = target.closest('.note-title');
      if (titleEl) {
        const article = titleEl.closest('article.note');
        if (article) {
          const noteIdStr = article.getAttribute('data-note-id');
          if (noteIdStr) {
            const noteId = parseInt(noteIdStr, 10);
            this.selectedNoteId = noteId;
            this.updateHash();
            this.renderSelection();
          }
        }
      }
    });
  }

  private render() {
    this.renderResultsLine();
    this.renderFeed();
  }

  private renderResultsLine() {
    const q = this.searchQuery.trim();
    if (q) {
      this.resultsLine.textContent = `results for "${q}"`;
    } else {
      this.resultsLine.textContent = '';
    }
  }

  private renderFeed() {
    const q = this.searchQuery.trim().toLowerCase();
    
    // Filter notes
    const filtered = this.notes.filter((note) => {
      if (!q) return true;
      return (
        note.title.toLowerCase().includes(q) ||
        note.body.toLowerCase().includes(q)
      );
    });

    // Sort newest first (by createdAt desc, then id desc)
    filtered.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      if (dateB !== dateA) {
        return dateB - dateA;
      }
      return b.id - a.id;
    });

    if (filtered.length === 0) {
      this.feedEl.innerHTML = `<div class="no-notes">No notes found.</div>`;
      return;
    }

    this.feedEl.innerHTML = '';
    for (const note of filtered) {
      const article = document.createElement('article');
      article.className = 'note';
      article.setAttribute('data-note-id', String(note.id));

      if (note.id === this.selectedNoteId) {
        article.setAttribute('aria-current', 'true');
      }

      let avatarHtml = '';
      if (note.avatar) {
        avatarHtml = `<img class="note-avatar" src="${this.escapeAttr(note.avatar)}" alt="${this.escapeAttr(note.title)} avatar" />`;
      }

      const formattedBody = this.renderRichBody(note.body);
      const dateStr = note.createdAt ? new Date(note.createdAt).toLocaleString() : '';

      article.innerHTML = `
        ${avatarHtml}
        <div class="note-header-content">
          <h3 class="note-title" role="button" tabindex="0">${this.escapeHtml(note.title)}</h3>
          ${dateStr ? `<span class="note-meta">${dateStr}</span>` : ''}
        </div>
        <div class="note-body">${formattedBody}</div>
      `;

      this.feedEl.appendChild(article);
    }
  }

  private renderSelection() {
    const articles = this.feedEl.querySelectorAll('article.note');
    articles.forEach((art) => {
      const idStr = art.getAttribute('data-note-id');
      if (idStr && parseInt(idStr, 10) === this.selectedNoteId) {
        art.setAttribute('aria-current', 'true');
      } else {
        art.removeAttribute('aria-current');
      }
    });
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  private escapeAttr(str: string): string {
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  private renderRichBody(rawBody: string): string {
    // Replace newlines with <br>
    const withBrs = rawBody.replace(/\r\n/g, '\n').replace(/\n/g, '<br>');

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${withBrs}</div>`, 'text/html');
    const container = doc.body.firstElementChild || doc.body;

    const allowedTags = new Set(['B', 'STRONG', 'I', 'EM', 'A', 'BR']);

    function sanitize(node: Node) {
      const children = Array.from(node.childNodes);
      for (const child of children) {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const el = child as HTMLElement;
          if (!allowedTags.has(el.tagName)) {
            const textNode = document.createTextNode(el.textContent || '');
            node.replaceChild(textNode, el);
          } else {
            if (el.tagName === 'A') {
              const href = el.getAttribute('href');
              while (el.attributes.length > 0) {
                el.removeAttribute(el.attributes[0].name);
              }
              if (href) {
                el.setAttribute('href', href);
                el.setAttribute('target', '_blank');
                el.setAttribute('rel', 'noopener noreferrer');
              }
            } else {
              while (el.attributes.length > 0) {
                el.removeAttribute(el.attributes[0].name);
              }
            }
            sanitize(el);
          }
        }
      }
    }

    sanitize(container);
    return container.innerHTML;
  }
}

new PortoNotesApp();
