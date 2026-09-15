import './style.css';
import seedFixtures from '../fixtures.json';

export interface Note {
  id: number;
  title: string;
  body: string;
  avatar?: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto_notes_data';

/**
 * Load notes from localStorage or seed with fixtures.json if no saved notes exist.
 */
function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error parsing stored notes from localStorage:', err);
  }

  // Seed with fixtures on first load
  const initial = (seedFixtures as Note[]).map((note) => ({ ...note }));
  saveNotes(initial);
  return initial;
}

/**
 * Persist notes array to localStorage.
 */
function saveNotes(notes: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch (err) {
    console.error('Error saving notes to localStorage:', err);
  }
}

/**
 * Sanitize URLs for links, allowing only safe protocols or relative paths.
 */
function sanitizeUrl(urlStr: string): string | null {
  const trimmed = urlStr.trim();
  if (!trimmed || /[\x00-\x1F\x7F]/.test(trimmed)) {
    return null;
  }
  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('../') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('?')
  ) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed, 'https://example.com');
    const protocol = parsed.protocol.toLowerCase();
    if (['http:', 'https:', 'mailto:', 'tel:'].includes(protocol)) {
      if (/^[a-z0-9+.-]+:/i.test(trimmed)) {
        const origProtoMatch = trimmed.match(/^([a-z0-9+.-]+):/i);
        if (origProtoMatch) {
          const origProto = origProtoMatch[1].toLowerCase() + ':';
          if (!['http:', 'https:', 'mailto:', 'tel:'].includes(origProto)) {
            return null;
          }
        }
      }
      return trimmed;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Sanitize avatar URL, permitting safe image data URIs or HTTP/HTTPS image links.
 */
function sanitizeAvatarUrl(urlStr: string): string | null {
  const trimmed = urlStr.trim();
  if (!trimmed || /[\x00-\x1F\x7F]/.test(trimmed)) {
    return null;
  }
  if (/^data:image\/(?:png|jpeg|jpg|gif|svg\+xml|webp);/i.test(trimmed)) {
    return trimmed;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return trimmed;
      }
    } catch {
      return null;
    }
  }
  if (trimmed.startsWith('/') || trimmed.startsWith('./')) {
    return trimmed;
  }
  return null;
}

/**
 * Safely parse rich text supporting <b>, <strong>, <i>, <em>, <a href="...">, <br>, and newlines.
 * Never sets innerHTML directly on user-visible elements.
 */
function appendSanitizedRichText(rawText: string, targetParent: HTMLElement): void {
  targetParent.replaceChildren();
  if (!rawText) return;

  // Normalize newlines to <br>
  const htmlWithLineBreaks = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\n/g, '<br>');

  const parser = new DOMParser();
  const parsedDoc = parser.parseFromString(`<body>${htmlWithLineBreaks}</body>`, 'text/html');

  function walk(source: Node, destination: Node): void {
    for (const child of Array.from(source.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        destination.appendChild(document.createTextNode(child.nodeValue || ''));
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        const tag = el.tagName.toLowerCase();

        if (tag === 'b' || tag === 'strong' || tag === 'i' || tag === 'em' || tag === 'br') {
          const safeEl = document.createElement(tag);
          walk(el, safeEl);
          destination.appendChild(safeEl);
        } else if (tag === 'a') {
          const safeEl = document.createElement('a');
          const href = el.getAttribute('href');
          if (href) {
            const safeHref = sanitizeUrl(href);
            if (safeHref) {
              safeEl.setAttribute('href', safeHref);
              if (/^https?:\/\//i.test(safeHref)) {
                safeEl.setAttribute('target', '_blank');
                safeEl.setAttribute('rel', 'noopener noreferrer');
              }
            }
          }
          walk(el, safeEl);
          destination.appendChild(safeEl);
        } else if (
          [
            'script',
            'style',
            'iframe',
            'object',
            'embed',
            'template',
            'noscript',
            'meta',
            'link',
            'base',
            'form',
            'input',
            'button',
            'select',
            'textarea',
          ].includes(tag)
        ) {
          // Dangerous elements: completely discard
        } else {
          // Other tags: render their text/safe children
          walk(el, destination);
        }
      }
    }
  }

  walk(parsedDoc.body, targetParent);
}

/**
 * Parse URL hash fragment parameters (e.g. #q=port&note=3).
 */
function parseHash(): { query: string; noteId: number | null } {
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (!hash) {
    return { query: '', noteId: null };
  }
  const params = new URLSearchParams(hash);
  const query = params.get('q') || '';
  const noteStr = params.get('note');
  const noteId = noteStr && !isNaN(Number(noteStr)) ? parseInt(noteStr, 10) : null;
  return { query, noteId };
}

/**
 * Update URL hash fragment without reloading the page.
 */
function updateHash(query: string, noteId: number | null): void {
  const params = new URLSearchParams();
  if (query) {
    params.set('q', query);
  }
  if (noteId !== null) {
    params.set('note', String(noteId));
  }
  const hashStr = params.toString();
  const targetHash = hashStr ? `#${hashStr}` : '';
  if (window.location.hash !== targetHash) {
    const newUrl = targetHash
      ? `${window.location.pathname}${window.location.search}${targetHash}`
      : `${window.location.pathname}${window.location.search}`;
    history.replaceState(null, '', newUrl);
  }
}

// Application State
let notes: Note[] = [];
let searchQuery = '';
let selectedNoteId: number | null = null;

// DOM Elements
const noteForm = document.getElementById('note-form') as HTMLFormElement;
const titleInput = document.getElementById('title') as HTMLInputElement;
const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
const avatarInput = document.getElementById('avatar') as HTMLInputElement;
const searchInput = document.getElementById('search') as HTMLInputElement;
const resultsLine = document.getElementById('results-line') as HTMLElement;
const feedSection = document.getElementById('feed') as HTMLElement;

/**
 * Render the search results status line.
 */
function renderResultsLine(): void {
  if (searchQuery) {
    resultsLine.textContent = `results for "${searchQuery}"`;
  } else {
    resultsLine.textContent = '';
  }
}

/**
 * Update aria-current on rendered note articles.
 */
function updateSelectionState(): void {
  const articles = feedSection.querySelectorAll('article.note');
  articles.forEach((art) => {
    const idAttr = art.getAttribute('data-note-id');
    if (idAttr && parseInt(idAttr, 10) === selectedNoteId) {
      art.setAttribute('aria-current', 'true');
    } else {
      art.removeAttribute('aria-current');
    }
  });
}

/**
 * Select a note by ID and synchronize hash.
 */
function selectNote(id: number): void {
  selectedNoteId = id;
  updateHash(searchQuery, selectedNoteId);
  updateSelectionState();
}

/**
 * Render the notes feed, newest-first, applying search filters.
 */
function renderFeed(): void {
  feedSection.replaceChildren();

  // Sort notes newest-first (descending by createdAt, or id fallback)
  const sortedNotes = [...notes].sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) {
      return timeB - timeA;
    }
    return b.id - a.id;
  });

  // Filter notes by search query if active
  const filtered = searchQuery
    ? sortedNotes.filter((note) => {
        const q = searchQuery.toLowerCase();
        return note.title.toLowerCase().includes(q) || note.body.toLowerCase().includes(q);
      })
    : sortedNotes;

  if (filtered.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.className = 'empty-feed';
    emptyMsg.textContent = searchQuery
      ? `No notes matching "${searchQuery}".`
      : 'No notes yet. Add your first note above!';
    feedSection.appendChild(emptyMsg);
    return;
  }

  for (const note of filtered) {
    const article = document.createElement('article');
    article.className = 'note';
    article.setAttribute('data-note-id', String(note.id));
    if (note.id === selectedNoteId) {
      article.setAttribute('aria-current', 'true');
    }

    const headerRow = document.createElement('div');
    headerRow.className = 'note-header-row';

    // Avatar
    if (note.avatar && note.avatar.trim()) {
      const safeAvatar = sanitizeAvatarUrl(note.avatar);
      if (safeAvatar) {
        const img = document.createElement('img');
        img.className = 'note-avatar';
        img.setAttribute('src', safeAvatar);
        img.setAttribute('alt', `${note.title} avatar`);
        headerRow.appendChild(img);
      }
    }

    // Title container
    const titleContainer = document.createElement('div');
    titleContainer.className = 'note-title-container';

    const titleEl = document.createElement('h3');
    titleEl.className = 'note-title';
    titleEl.setAttribute('role', 'button');
    titleEl.setAttribute('tabindex', '0');
    titleEl.setAttribute('aria-label', `Select note: ${note.title}`);
    appendSanitizedRichText(note.title, titleEl);

    // Title selection handlers
    titleEl.addEventListener('click', () => {
      selectNote(note.id);
    });
    titleEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectNote(note.id);
      }
    });

    titleContainer.appendChild(titleEl);
    headerRow.appendChild(titleContainer);
    article.appendChild(headerRow);

    // Body
    const bodyEl = document.createElement('div');
    bodyEl.className = 'note-body';
    appendSanitizedRichText(note.body, bodyEl);
    article.appendChild(bodyEl);

    feedSection.appendChild(article);
  }
}

/**
 * Handle new note form submission.
 */
function handleNoteSubmit(e: Event): void {
  e.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  const avatar = avatarInput.value.trim();

  if (!title || !body) {
    return;
  }

  const nextId = notes.length > 0 ? Math.max(...notes.map((n) => n.id)) + 1 : 1;
  const newNote: Note = {
    id: nextId,
    title: titleInput.value,
    body: bodyInput.value,
    avatar: avatar || '',
    createdAt: new Date().toISOString(),
  };

  notes.unshift(newNote);
  saveNotes(notes);

  noteForm.reset();
  renderFeed();
}

/**
 * Handle search input change.
 */
function handleSearchInput(): void {
  searchQuery = searchInput.value;
  updateHash(searchQuery, selectedNoteId);
  renderResultsLine();
  renderFeed();
}

/**
 * Initialize application state and event listeners.
 */
function init(): void {
  notes = loadNotes();

  // Restore state from URL fragment
  const { query, noteId } = parseHash();
  searchQuery = query;
  selectedNoteId = noteId;

  if (searchInput) {
    searchInput.value = searchQuery;
    searchInput.addEventListener('input', handleSearchInput);
  }

  if (noteForm) {
    noteForm.addEventListener('submit', handleNoteSubmit);
  }

  // Handle browser navigation / external hash change
  const handleLocationChange = () => {
    const parsed = parseHash();
    searchQuery = parsed.query;
    selectedNoteId = parsed.noteId;
    if (searchInput && searchInput.value !== searchQuery) {
      searchInput.value = searchQuery;
    }
    renderResultsLine();
    renderFeed();
  };

  window.addEventListener('hashchange', handleLocationChange);
  window.addEventListener('popstate', handleLocationChange);

  renderResultsLine();
  renderFeed();
}

// Run init on DOMContentLoaded or immediately if already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
