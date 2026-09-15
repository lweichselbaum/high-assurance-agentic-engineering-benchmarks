import fixturesData from '../fixtures.json';
import { sanitizeHtml } from 'safevalues';
import { setElementInnerHtml } from 'safevalues/dom';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto_notes_v1';

function getStoredNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // fallback to fixtures
  }
  const fixtures: Note[] = fixturesData as Note[];
  saveNotes(fixtures);
  return fixtures;
}

function saveNotes(notes: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // ignore
  }
}

function isValidAvatar(url: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  return (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('data:')
  );
}

function formatBody(bodyText: string): string {
  // Convert newlines to <br>
  return bodyText.replace(/\r?\n/g, '<br>');
}

function main() {
  let notes: Note[] = getStoredNotes();
  let searchQuery = '';
  let selectedNoteId: number | null = null;

  const searchInput = document.getElementById('search') as HTMLInputElement | null;
  const resultsLine = document.getElementById('results-line') as HTMLParagraphElement | null;
  const noteForm = document.getElementById('note-form') as HTMLFormElement | null;
  const titleInput = document.getElementById('title') as HTMLInputElement | null;
  const bodyInput = document.getElementById('body') as HTMLTextAreaElement | null;
  const avatarInput = document.getElementById('avatar') as HTMLInputElement | null;
  const feedSection = document.getElementById('feed') as HTMLElement | null;

  function parseHash() {
    const hash = location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);
    const q = params.get('q') ?? '';
    const noteParam = params.get('note');
    const noteId = noteParam ? parseInt(noteParam, 10) : null;
    return { q, noteId: Number.isNaN(noteId) ? null : noteId };
  }

  function updateHash() {
    const params = new URLSearchParams();
    if (searchQuery.trim()) {
      params.set('q', searchQuery.trim());
    }
    if (selectedNoteId !== null) {
      params.set('note', String(selectedNoteId));
    }
    const newHash = params.toString();
    const currentHash = location.hash.replace(/^#/, '');
    if (newHash !== currentHash) {
      history.replaceState(null, '', newHash ? `#${newHash}` : location.pathname + location.search);
    }
  }

  function render() {
    if (!feedSection || !resultsLine || !searchInput) return;

    // Filter notes
    const q = searchQuery.trim().toLowerCase();
    const filtered = notes.filter((n) => {
      if (!q) return true;
      return n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q);
    });

    // Sort newest first
    const sorted = [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    // Results line
    if (q) {
      resultsLine.textContent = `results for "${searchQuery.trim()}"`;
    } else {
      resultsLine.textContent = '';
    }

    // Search input value sync if out of sync
    if (searchInput.value !== searchQuery) {
      searchInput.value = searchQuery;
    }

    // Render feed
    feedSection.innerHTML = '';

    if (sorted.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.textContent = 'No notes found.';
      emptyMsg.style.color = '#64748b';
      emptyMsg.style.fontStyle = 'italic';
      feedSection.appendChild(emptyMsg);
      return;
    }

    for (const note of sorted) {
      const article = document.createElement('article');
      article.className = 'note';
      article.setAttribute('data-note-id', String(note.id));

      if (selectedNoteId === note.id) {
        article.setAttribute('aria-current', 'true');
      } else {
        article.removeAttribute('aria-current');
      }

      const header = document.createElement('div');
      header.className = 'note-header';

      if (note.avatar && isValidAvatar(note.avatar)) {
        const img = document.createElement('img');
        img.className = 'note-avatar';
        img.src = note.avatar.trim();
        img.alt = `${note.title} avatar`;
        header.appendChild(img);
      }

      const titleEl = document.createElement('h3');
      titleEl.className = 'note-title';
      titleEl.textContent = note.title;
      titleEl.addEventListener('click', () => {
        selectedNoteId = note.id;
        updateHash();
        render();
      });
      header.appendChild(titleEl);

      article.appendChild(header);

      const bodyEl = document.createElement('div');
      bodyEl.className = 'note-body';
      const formattedHtml = formatBody(note.body);
      setElementInnerHtml(bodyEl, sanitizeHtml(formattedHtml));

      article.appendChild(bodyEl);
      feedSection.appendChild(article);
    }
  }

  function handleStateFromHash() {
    const { q, noteId } = parseHash();
    searchQuery = q;
    selectedNoteId = noteId;
    render();
  }

  // Event Listeners
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value;
      updateHash();
      render();
    });
  }

  if (noteForm && titleInput && bodyInput && avatarInput) {
    noteForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = titleInput.value.trim();
      const body = bodyInput.value;
      const avatar = avatarInput.value.trim();

      if (!title || !body) return;

      const maxId = notes.reduce((max, n) => Math.max(max, n.id), 0);
      const newNote: Note = {
        id: maxId + 1,
        title,
        body,
        avatar: isValidAvatar(avatar) ? avatar : '',
        createdAt: new Date().toISOString(),
      };

      notes.push(newNote);
      saveNotes(notes);

      titleInput.value = '';
      bodyInput.value = '';
      avatarInput.value = '';

      selectedNoteId = newNote.id;
      updateHash();
      render();
    });
  }

  window.addEventListener('hashchange', () => {
    handleStateFromHash();
  });

  // Initial load state from hash
  handleStateFromHash();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
