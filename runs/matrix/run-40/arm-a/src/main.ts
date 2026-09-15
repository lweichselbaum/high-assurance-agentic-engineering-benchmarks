import './style.css';
import defaultNotes from '../fixtures.json';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar?: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto_notes';

// Application state
let notes: Note[] = [];
let searchQuery = '';
let selectedNoteId: number | null = null;

// DOM Elements
const searchInput = document.getElementById('search') as HTMLInputElement;
const resultsLine = document.getElementById('results-line') as HTMLParagraphElement;
const noteForm = document.getElementById('note-form') as HTMLFormElement;
const titleInput = document.getElementById('title') as HTMLInputElement;
const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
const avatarInput = document.getElementById('avatar') as HTMLInputElement;
const feedSection = document.getElementById('feed') as HTMLElement;

/**
 * Loads notes from localStorage or seeds from fixtures.json
 */
function loadNotes(): Note[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw !== null) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (e) {
      // Ignore parse error and fall back to seed data
    }
  }
  // Seed with fixtures on first load
  const seededNotes = defaultNotes as Note[];
  saveNotes(seededNotes);
  return [...seededNotes];
}

/**
 * Saves notes to localStorage
 */
function saveNotes(notesToSave: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notesToSave));
  } catch (e) {
    // Ignore storage errors
  }
}

/**
 * Renders rich text safely using DOMParser and safe DOM APIs.
 * Supports: <b>, <strong>, <i>, <em>, <a href="...">, <br>, and newlines (\n).
 */
function renderRichText(input: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  if (!input) return fragment;

  // Convert newlines (\n) to <br> tags before HTML parsing
  const htmlInput = input.replace(/\r\n|\n/g, '<br>');
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlInput, 'text/html');

  const ALLOWED_INLINE = new Set(['B', 'STRONG', 'I', 'EM', 'BR']);
  const DANGEROUS_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED']);

  function appendSanitizedNode(node: Node, parent: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent) {
        parent.appendChild(document.createTextNode(node.textContent));
      }
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const elNode = node as HTMLElement;
      const tagName = elNode.tagName.toUpperCase();

      if (ALLOWED_INLINE.has(tagName)) {
        const newEl = document.createElement(tagName.toLowerCase());
        for (const child of Array.from(elNode.childNodes)) {
          appendSanitizedNode(child, newEl);
        }
        parent.appendChild(newEl);
      } else if (tagName === 'A') {
        const newEl = document.createElement('a');
        const href = elNode.getAttribute('href');
        if (href) {
          const trimmed = href.trim();
          const isDangerous = /^(javascript|data|vbscript):/i.test(trimmed);
          if (!isDangerous) {
            newEl.setAttribute('href', trimmed);
            if (/^https?:\/\//i.test(trimmed)) {
              newEl.setAttribute('target', '_blank');
              newEl.setAttribute('rel', 'noopener noreferrer');
            }
          }
        }
        for (const child of Array.from(elNode.childNodes)) {
          appendSanitizedNode(child, newEl);
        }
        parent.appendChild(newEl);
      } else {
        if (!DANGEROUS_TAGS.has(tagName)) {
          for (const child of Array.from(elNode.childNodes)) {
            appendSanitizedNode(child, parent);
          }
        }
      }
    }
  }

  for (const child of Array.from(doc.body.childNodes)) {
    appendSanitizedNode(child, fragment);
  }

  return fragment;
}

/**
 * Updates URL fragment based on current search query and selected note ID.
 */
function updateUrlHash(): void {
  const params = new URLSearchParams();
  if (searchQuery.trim()) {
    params.set('q', searchQuery.trim());
  }
  if (selectedNoteId !== null) {
    params.set('note', String(selectedNoteId));
  }

  const str = params.toString();
  const newHash = str ? `#${str}` : '';

  if (window.location.hash !== newHash) {
    history.replaceState(null, '', newHash || window.location.pathname + window.location.search);
  }
}

/**
 * Parses URL fragment and updates state.
 */
function parseUrlHash(): void {
  const rawHash = window.location.hash;
  const hash = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
  const params = new URLSearchParams(hash);
  const q = params.get('q') || '';
  const noteStr = params.get('note');
  const noteId = noteStr !== null && !isNaN(parseInt(noteStr, 10)) ? parseInt(noteStr, 10) : null;

  searchQuery = q;
  selectedNoteId = noteId;

  if (searchInput.value !== searchQuery) {
    searchInput.value = searchQuery;
  }
}

/**
 * Renders the feed based on current notes and search filter.
 */
function renderFeed(): void {
  // Update results line
  const trimmedQuery = searchQuery.trim();
  if (trimmedQuery) {
    resultsLine.textContent = `results for "${trimmedQuery}"`;
  } else {
    resultsLine.textContent = '';
  }

  // Filter notes (case-insensitive search on title or body)
  const qLower = trimmedQuery.toLowerCase();
  const filteredNotes = notes.filter((n) => {
    if (!qLower) return true;
    return (
      n.title.toLowerCase().includes(qLower) ||
      n.body.toLowerCase().includes(qLower)
    );
  });

  // Sort notes newest-first (by createdAt descending, or id descending)
  filteredNotes.sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) {
      return timeB - timeA;
    }
    return b.id - a.id;
  });

  // Clear feed section cleanly
  feedSection.replaceChildren();

  if (filteredNotes.length === 0) {
    const emptyPara = document.createElement('p');
    emptyPara.className = 'no-notes';
    emptyPara.textContent = trimmedQuery ? 'No notes match your search.' : 'No notes yet.';
    feedSection.appendChild(emptyPara);
    return;
  }

  for (const note of filteredNotes) {
    const article = document.createElement('article');
    article.className = 'note';
    article.setAttribute('data-note-id', String(note.id));

    if (selectedNoteId === note.id) {
      article.setAttribute('aria-current', 'true');
    }

    // Header container
    const headerDiv = document.createElement('div');
    headerDiv.className = 'note-header';

    const headerLeft = document.createElement('div');
    headerLeft.className = 'note-header-left';

    // Render avatar if provided and non-empty
    if (note.avatar && note.avatar.trim()) {
      const img = document.createElement('img');
      img.className = 'note-avatar';
      img.src = note.avatar.trim();
      img.alt = `${note.title} avatar`;
      headerLeft.appendChild(img);
    }

    // Title element
    const titleEl = document.createElement('h3');
    titleEl.className = 'note-title';
    titleEl.tabIndex = 0;
    titleEl.appendChild(renderRichText(note.title));

    const handleSelect = (e: Event) => {
      e.stopPropagation();
      selectedNoteId = note.id;
      updateUrlHash();
      renderFeed();
    };

    titleEl.addEventListener('click', handleSelect);
    titleEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSelect(e);
      }
    });

    headerLeft.appendChild(titleEl);
    headerDiv.appendChild(headerLeft);
    article.appendChild(headerDiv);

    // Body element
    const bodyEl = document.createElement('div');
    bodyEl.className = 'note-body';
    bodyEl.appendChild(renderRichText(note.body));
    article.appendChild(bodyEl);

    feedSection.appendChild(article);
  }
}

// Event Listeners

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value;
  updateUrlHash();
  renderFeed();
});

noteForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  const avatar = avatarInput.value.trim();

  if (!title || !body) return;

  const maxId = notes.reduce((max, n) => (n.id > max ? n.id : max), 0);
  const newNote: Note = {
    id: maxId + 1,
    title,
    body,
    avatar: avatar || undefined,
    createdAt: new Date().toISOString(),
  };

  // Add new note to the beginning of the list (newest first)
  notes.unshift(newNote);
  saveNotes(notes);

  // Clear form inputs
  noteForm.reset();

  renderFeed();
});

window.addEventListener('hashchange', () => {
  parseUrlHash();
  renderFeed();
});

// Initial Setup
notes = loadNotes();
parseUrlHash();
renderFeed();
