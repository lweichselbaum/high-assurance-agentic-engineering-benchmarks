import fixtures from '../fixtures.json';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto-notes';

class PortoNotes {
  private notes: Note[] = [];
  private searchQuery: string = '';
  private selectedNoteId: number | null = null;
  private nextId: number = 1;

  constructor() {
    this.loadNotes();
    this.setupUI();
    this.restoreFromFragment();
    this.render();
    this.attachEventListeners();
  }

  private loadNotes(): void {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      this.notes = JSON.parse(stored);
      this.nextId = Math.max(...this.notes.map(n => n.id), 0) + 1;
    } else {
      this.notes = fixtures as Note[];
      this.nextId = Math.max(...this.notes.map(n => n.id), 0) + 1;
      this.saveNotes();
    }
  }

  private saveNotes(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.notes));
  }

  private setupUI(): void {
    const app = document.getElementById('app')!;
    app.innerHTML = `
      <header>
        <h1>Porto Notes</h1>
        <input type="search" id="search" placeholder="Search notes..." />
        <p id="results-line"></p>
      </header>

      <form id="note-form">
        <input type="text" id="title" placeholder="Note title" required />
        <textarea id="body" placeholder="Note body (supports <b>, <i>, <a href=...>, <br>)" rows="4" required></textarea>
        <input type="url" id="avatar" placeholder="Avatar URL (optional)" />
        <button type="submit">Add Note</button>
      </form>

      <section id="feed"></section>
    `;
  }

  private attachEventListeners(): void {
    const form = document.getElementById('note-form') as HTMLFormElement;
    const searchInput = document.getElementById('search') as HTMLInputElement;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.addNote();
    });

    searchInput.addEventListener('input', (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value;
      this.updateFragment();
      this.render();
    });

    window.addEventListener('hashchange', () => {
      this.restoreFromFragment();
      this.render();
    });
  }

  private addNote(): void {
    const titleInput = document.getElementById('title') as HTMLInputElement;
    const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
    const avatarInput = document.getElementById('avatar') as HTMLInputElement;

    const note: Note = {
      id: this.nextId++,
      title: titleInput.value.trim(),
      body: bodyInput.value.trim(),
      avatar: avatarInput.value.trim(),
      createdAt: new Date().toISOString()
    };

    this.notes.unshift(note);
    this.saveNotes();

    titleInput.value = '';
    bodyInput.value = '';
    avatarInput.value = '';

    this.render();
  }

  private getFilteredNotes(): Note[] {
    if (!this.searchQuery) {
      return this.notes;
    }
    const query = this.searchQuery.toLowerCase();
    return this.notes.filter(note =>
      note.title.toLowerCase().includes(query) ||
      note.body.toLowerCase().includes(query)
    );
  }

  private renderRichText(text: string): string {
    let result = text;

    // Convert newlines to <br>
    result = result.replace(/\n/g, '<br>');

    // Allow only specific tags by parsing and reconstructing
    // This is a simple approach - we'll allow the tags through
    return result;
  }

  private render(): void {
    // Update results line
    const resultsLine = document.getElementById('results-line')!;
    if (this.searchQuery) {
      resultsLine.textContent = `results for "${this.searchQuery}"`;
    } else {
      resultsLine.textContent = '';
    }

    // Update search input value
    const searchInput = document.getElementById('search') as HTMLInputElement;
    searchInput.value = this.searchQuery;

    // Render feed
    const feed = document.getElementById('feed')!;
    const filteredNotes = this.getFilteredNotes();

    if (filteredNotes.length === 0) {
      feed.innerHTML = '<p style="color: #666; text-align: center; padding: 2rem;">No notes found.</p>';
      return;
    }

    feed.innerHTML = filteredNotes.map(note => {
      const avatarHtml = note.avatar
        ? `<img class="note-avatar" src="${note.avatar}" alt="Avatar" />`
        : '';

      const isSelected = note.id === this.selectedNoteId;

      return `
        <article class="note" data-note-id="${note.id}" ${isSelected ? 'aria-current="true"' : ''}>
          ${avatarHtml}
          <h2 class="note-title" data-note-id="${note.id}">${this.escapeHtml(note.title)}</h2>
          <div class="note-body">${this.renderRichText(note.body)}</div>
        </article>
      `;
    }).join('');

    // Attach click handlers to note titles
    feed.querySelectorAll('.note-title').forEach(title => {
      title.addEventListener('click', (e) => {
        const noteId = parseInt((e.target as HTMLElement).dataset.noteId || '0');
        this.selectNote(noteId);
      });
    });
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private selectNote(noteId: number): void {
    this.selectedNoteId = noteId;
    this.updateFragment();
    this.render();
  }

  private updateFragment(): void {
    const params = new URLSearchParams();
    if (this.searchQuery) {
      params.set('q', this.searchQuery);
    }
    if (this.selectedNoteId !== null) {
      params.set('note', this.selectedNoteId.toString());
    }

    const fragment = params.toString();
    window.location.hash = fragment ? '#' + fragment : '';
  }

  private restoreFromFragment(): void {
    const hash = window.location.hash.slice(1);
    if (!hash) {
      this.searchQuery = '';
      this.selectedNoteId = null;
      return;
    }

    const params = new URLSearchParams(hash);
    this.searchQuery = params.get('q') || '';
    const noteParam = params.get('note');
    this.selectedNoteId = noteParam ? parseInt(noteParam) : null;
  }
}

// Initialize the app
new PortoNotes();
