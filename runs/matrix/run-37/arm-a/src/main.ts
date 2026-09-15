import fixtures from '../fixtures.json';
import './style.css';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar?: string;
  createdAt?: string;
}

const STORAGE_KEY = 'porto_notes';

// App State
let notes: Note[] = [];
let searchQuery = '';
let selectedNoteId: number | null = null;

// Load notes from localStorage or seed with fixtures.json
function loadNotes(): Note[] {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved !== null) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (e) {
      console.error('Error parsing localStorage notes:', e);
    }
  }
  const initial = fixtures as Note[];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  return initial;
}

function saveNotes(data: Note[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Render rich text (<b>, <strong>, <i>, <em>, <a href="...">, <br>, \n line breaks)
function renderRichTextTo(input: string, container: HTMLElement): void {
  container.innerHTML = '';
  if (!input) return;

  const parser = new DOMParser();
  const doc = parser.parseFromString(input, 'text/html');

  const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'A', 'BR']);

  function walk(node: Node, parent: HTMLElement) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      const lines = text.split('\n');
      lines.forEach((line, index) => {
        if (index > 0) {
          parent.appendChild(document.createElement('br'));
        }
        if (line) {
          parent.appendChild(document.createTextNode(line));
        }
      });
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toUpperCase();

      if (ALLOWED_TAGS.has(tag)) {
        if (tag === 'BR') {
          parent.appendChild(document.createElement('br'));
          return;
        }

        let newEl: HTMLElement;
        if (tag === 'A') {
          const a = document.createElement('a');
          const href = el.getAttribute('href');
          if (href && !/^javascript:/i.test(href.trim())) {
            a.setAttribute('href', href.trim());
          }
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener noreferrer');
          newEl = a;
        } else {
          newEl = document.createElement(tag.toLowerCase());
        }

        Array.from(el.childNodes).forEach((child) => walk(child, newEl));
        parent.appendChild(newEl);
      } else {
        Array.from(el.childNodes).forEach((child) => walk(child, parent));
      }
    }
  }

  Array.from(doc.body.childNodes).forEach((child) => walk(child, container));
}

// Synchronize URL fragment hash
function syncUrlFragment(): void {
  const params = new URLSearchParams();
  if (searchQuery) {
    params.set('q', searchQuery);
  }
  if (selectedNoteId !== null) {
    params.set('note', String(selectedNoteId));
  }
  const str = params.toString();
  const targetHash = str ? '#' + str : '';

  if (window.location.hash !== targetHash) {
    if (targetHash) {
      history.replaceState(null, '', targetHash);
    } else {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }
}

// Restore state from URL fragment
function restoreFromUrlFragment(): void {
  const hash = window.location.hash.replace(/^#/, '');
  const params = new URLSearchParams(hash);

  const qParam = params.get('q');
  searchQuery = qParam !== null ? qParam : '';

  const noteParam = params.get('note');
  if (noteParam !== null) {
    const id = parseInt(noteParam, 10);
    if (!isNaN(id) && notes.some((n) => n.id === id)) {
      selectedNoteId = id;
    } else {
      selectedNoteId = null;
    }
  } else {
    selectedNoteId = null;
  }
}

// Match title or body case-insensitively
function matchesSearch(note: Note, q: string): boolean {
  if (!q) return true;
  const lowerQ = q.toLowerCase();
  return note.title.toLowerCase().includes(lowerQ) || note.body.toLowerCase().includes(lowerQ);
}

// Render feed & search state
function render(): void {
  const searchInput = document.getElementById('search') as HTMLInputElement | null;
  const resultsLine = document.getElementById('results-line') as HTMLParagraphElement | null;
  const feedEl = document.getElementById('feed') as HTMLElement | null;

  if (searchInput && searchInput.value !== searchQuery) {
    searchInput.value = searchQuery;
  }

  if (resultsLine) {
    if (searchQuery) {
      resultsLine.textContent = `results for "${searchQuery}"`;
    } else {
      resultsLine.textContent = '';
    }
  }

  if (feedEl) {
    feedEl.innerHTML = '';

    // Render newest-first (sorted by ID descending)
    const sortedNotes = notes.slice().sort((a, b) => b.id - a.id);
    const filteredNotes = sortedNotes.filter((n) => matchesSearch(n, searchQuery));

    if (filteredNotes.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-feed';
      empty.textContent = searchQuery ? 'No notes match your search.' : 'No notes yet.';
      feedEl.appendChild(empty);
      return;
    }

    filteredNotes.forEach((note) => {
      const article = document.createElement('article');
      article.className = 'note';
      article.setAttribute('data-note-id', String(note.id));

      if (selectedNoteId === note.id) {
        article.setAttribute('aria-current', 'true');
      }

      const header = document.createElement('div');
      header.className = 'note-header';

      if (note.avatar && note.avatar.trim() !== '') {
        const img = document.createElement('img');
        img.className = 'note-avatar';
        img.src = note.avatar.trim();
        img.alt = '';
        header.appendChild(img);
      }

      const titleEl = document.createElement('h3');
      titleEl.className = 'note-title';
      titleEl.tabIndex = 0;
      titleEl.setAttribute('role', 'button');
      renderRichTextTo(note.title, titleEl);

      const selectNoteHandler = (e: Event) => {
        e.preventDefault();
        selectedNoteId = note.id;
        render();
        syncUrlFragment();
      };

      titleEl.addEventListener('click', selectNoteHandler);
      titleEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          selectNoteHandler(e);
        }
      });

      header.appendChild(titleEl);
      article.appendChild(header);

      const bodyEl = document.createElement('div');
      bodyEl.className = 'note-body';
      renderRichTextTo(note.body, bodyEl);
      article.appendChild(bodyEl);

      feedEl.appendChild(article);
    });
  }
}

// App Initialization
function init(): void {
  notes = loadNotes();
  restoreFromUrlFragment();

  const noteForm = document.getElementById('note-form') as HTMLFormElement | null;
  const titleInput = document.getElementById('title') as HTMLInputElement | null;
  const bodyInput = document.getElementById('body') as HTMLTextAreaElement | null;
  const avatarInput = document.getElementById('avatar') as HTMLInputElement | null;
  const searchInput = document.getElementById('search') as HTMLInputElement | null;

  if (noteForm) {
    noteForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = titleInput?.value || '';
      const body = bodyInput?.value || '';
      const avatar = avatarInput?.value.trim() || '';

      if (!title.trim() || !body.trim()) return;

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

      render();
      syncUrlFragment();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value;
      render();
      syncUrlFragment();
    });
  }

  window.addEventListener('hashchange', () => {
    restoreFromUrlFragment();
    render();
  });

  render();
  syncUrlFragment();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
