import defaultFixtures from './fixtures.json';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar?: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto_notes';

// Allowed tags and disallowed tags for rich text sanitization
const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'A', 'BR']);
const DISCARD_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'IFRAME', 'OBJECT']);

/**
 * Recursively sanitize DOM nodes to allow only safe inline formatting tags:
 * <b>, <strong>, <i>, <em>, <a href="...">, and <br>.
 */
function sanitizeNode(node: Node): Node | Node[] | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return document.createTextNode(node.nodeValue || '');
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement;
    const tagName = el.tagName.toUpperCase();

    if (DISCARD_TAGS.has(tagName)) {
      return null;
    }

    if (ALLOWED_TAGS.has(tagName)) {
      const cleanEl = document.createElement(tagName.toLowerCase());

      if (tagName === 'A') {
        const href = el.getAttribute('href');
        if (href) {
          const trimmedHref = href.trim();
          if (!/^javascript:/i.test(trimmedHref) && !/^data:/i.test(trimmedHref)) {
            cleanEl.setAttribute('href', trimmedHref);
          }
        }
      }

      el.childNodes.forEach((child) => {
        const sanitizedChild = sanitizeNode(child);
        if (Array.isArray(sanitizedChild)) {
          sanitizedChild.forEach((c) => cleanEl.appendChild(c));
        } else if (sanitizedChild) {
          cleanEl.appendChild(sanitizedChild);
        }
      });

      return cleanEl;
    } else {
      // Disallowed element node: unwrap it and sanitize its children
      const resultNodes: Node[] = [];
      el.childNodes.forEach((child) => {
        const sanitizedChild = sanitizeNode(child);
        if (Array.isArray(sanitizedChild)) {
          resultNodes.push(...sanitizedChild);
        } else if (sanitizedChild) {
          resultNodes.push(sanitizedChild);
        }
      });
      return resultNodes;
    }
  }

  return null;
}

/**
 * Render text with inline rich-text formatting and line breaks into container.
 */
function renderRichText(rawContent: string, container: HTMLElement): void {
  container.replaceChildren();

  if (!rawContent) return;

  // Convert newlines (\n, \r\n, \r) into <br> tags
  const formattedHtml = rawContent.replace(/\r\n|\r|\n/g, '<br>');

  const parser = new DOMParser();
  const doc = parser.parseFromString(formattedHtml, 'text/html');

  doc.body.childNodes.forEach((child) => {
    const sanitized = sanitizeNode(child);
    if (Array.isArray(sanitized)) {
      sanitized.forEach((c) => container.appendChild(c));
    } else if (sanitized) {
      container.appendChild(sanitized);
    }
  });
}

/**
 * Storage helpers
 */
function loadNotesFromStorage(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to parse notes from localStorage:', e);
  }

  // Seed data on first load when no saved notes yet
  const initialNotes: Note[] = defaultFixtures;
  saveNotesToStorage(initialNotes);
  return initialNotes;
}

function saveNotesToStorage(notes: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch (e) {
    console.error('Failed to save notes to localStorage:', e);
  }
}

/**
 * Fragment URL parsing and updating helpers
 */
function parseFragment(): { query: string; noteId: number | null } {
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  const params = new URLSearchParams(hash);
  const query = params.get('q') || '';
  const noteStr = params.get('note');
  const parsedId = noteStr ? parseInt(noteStr, 10) : null;
  const noteId = parsedId !== null && !isNaN(parsedId) ? parsedId : null;
  return { query, noteId };
}

function syncURLFragment(query: string, noteId: number | null): void {
  const params = new URLSearchParams();
  if (query) {
    params.set('q', query);
  }
  if (noteId !== null) {
    params.set('note', String(noteId));
  }

  const hashString = params.toString();
  const newHash = hashString ? '#' + hashString : '';

  if (window.location.hash !== newHash) {
    history.replaceState(null, '', newHash || window.location.pathname + window.location.search);
  }
}

/**
 * App initialization & state management
 */
function initApp(): void {
  const formEl = document.getElementById('note-form') as HTMLFormElement | null;
  const titleInput = document.getElementById('title') as HTMLInputElement | null;
  const bodyInput = document.getElementById('body') as HTMLTextAreaElement | null;
  const avatarInput = document.getElementById('avatar') as HTMLInputElement | null;
  const searchInput = document.getElementById('search') as HTMLInputElement | null;
  const resultsLineEl = document.getElementById('results-line') as HTMLParagraphElement | null;
  const feedEl = document.getElementById('feed') as HTMLElement | null;

  if (!formEl || !titleInput || !bodyInput || !avatarInput || !searchInput || !resultsLineEl || !feedEl) {
    console.error('Required DOM elements missing');
    return;
  }

  let notes: Note[] = loadNotesFromStorage();
  const initialFragment = parseFragment();
  let searchQuery: string = initialFragment.query;
  let selectedNoteId: number | null = initialFragment.noteId;

  // Restore initial search input value
  searchInput.value = searchQuery;

  function render(): void {
    // 1. Update results line
    if (searchQuery) {
      resultsLineEl!.textContent = `results for "${searchQuery}"`;
    } else {
      resultsLineEl!.textContent = '';
    }

    // 2. Filter notes
    const lowerQuery = searchQuery.toLowerCase();
    const filteredNotes = searchQuery
      ? notes.filter(
          (note) =>
            note.title.toLowerCase().includes(lowerQuery) ||
            note.body.toLowerCase().includes(lowerQuery)
        )
      : [...notes];

    // 3. Sort newest-first (by createdAt descending, fallback by id descending)
    filteredNotes.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) {
        return timeB - timeA;
      }
      return b.id - a.id;
    });

    // 4. Render feed
    feedEl!.replaceChildren();

    if (filteredNotes.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'empty-feed';
      emptyMsg.textContent = searchQuery ? 'No notes match your search.' : 'No notes yet. Add one above!';
      feedEl!.appendChild(emptyMsg);
      return;
    }

    filteredNotes.forEach((note) => {
      const article = document.createElement('article');
      article.className = 'note';
      article.setAttribute('data-note-id', String(note.id));

      if (selectedNoteId !== null && note.id === selectedNoteId) {
        article.setAttribute('aria-current', 'true');
      }

      const header = document.createElement('header');
      header.className = 'note-header';

      const titleEl = document.createElement('h3');
      titleEl.className = 'note-title';
      titleEl.tabIndex = 0;
      titleEl.setAttribute('role', 'button');
      renderRichText(note.title, titleEl);
      header.appendChild(titleEl);

      if (note.avatar && note.avatar.trim()) {
        const img = document.createElement('img');
        img.className = 'note-avatar';
        img.src = note.avatar.trim();
        img.alt = `${note.title} avatar`;
        header.appendChild(img);
      }

      const bodyEl = document.createElement('div');
      bodyEl.className = 'note-body';
      renderRichText(note.body, bodyEl);

      article.appendChild(header);
      article.appendChild(bodyEl);
      feedEl!.appendChild(article);
    });
  }

  function setSelectedNote(id: number): void {
    selectedNoteId = id;
    syncURLFragment(searchQuery, selectedNoteId);
    render();
  }

  // Handle Form Submit
  formEl.addEventListener('submit', (e: Event) => {
    e.preventDefault();

    const titleVal = titleInput.value.trim();
    const bodyVal = bodyInput.value;
    const avatarVal = avatarInput.value.trim();

    if (!titleVal || !bodyVal) return;

    const maxId = notes.reduce((max, n) => Math.max(max, typeof n.id === 'number' ? n.id : 0), 0);
    const newNote: Note = {
      id: maxId + 1,
      title: titleVal,
      body: bodyVal,
      avatar: avatarVal || undefined,
      createdAt: new Date().toISOString()
    };

    notes.push(newNote);
    saveNotesToStorage(notes);

    // Clear form
    titleInput.value = '';
    bodyInput.value = '';
    avatarInput.value = '';

    render();
  });

  // Handle Search Input
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    syncURLFragment(searchQuery, selectedNoteId);
    render();
  });

  // Handle Note Title Click / Keydown via Delegation on #feed
  feedEl.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const titleEl = target.closest('.note-title');
    if (titleEl) {
      const article = titleEl.closest('article.note');
      if (article) {
        const idAttr = article.getAttribute('data-note-id');
        if (idAttr) {
          const noteId = parseInt(idAttr, 10);
          if (!isNaN(noteId)) {
            setSelectedNote(noteId);
          }
        }
      }
    }
  });

  feedEl.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const target = e.target as HTMLElement;
      if (target.classList.contains('note-title') || target.closest('.note-title')) {
        e.preventDefault();
        const article = target.closest('article.note');
        if (article) {
          const idAttr = article.getAttribute('data-note-id');
          if (idAttr) {
            const noteId = parseInt(idAttr, 10);
            if (!isNaN(noteId)) {
              setSelectedNote(noteId);
            }
          }
        }
      }
    }
  });

  // Listen for external fragment changes (e.g. browser back/forward buttons)
  window.addEventListener('hashchange', () => {
    const { query, noteId } = parseFragment();
    searchQuery = query;
    selectedNoteId = noteId;
    if (searchInput.value !== searchQuery) {
      searchInput.value = searchQuery;
    }
    render();
  });

  // Initial render
  syncURLFragment(searchQuery, selectedNoteId);
  render();
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
