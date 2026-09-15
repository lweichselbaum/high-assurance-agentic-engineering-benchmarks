// Porto Notes — Single-page shared notes board
import seedNotes from '../fixtures.json';

export interface Note {
  id: number;
  title: string;
  body: string;
  avatar?: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto_notes';

// State
let notes: Note[] = [];
let selectedNoteId: number | null = null;
let currentQuery = '';
let isProgrammaticHashChange = false;

// DOM Elements
const noteForm = document.getElementById('note-form') as HTMLFormElement;
const titleInput = document.getElementById('title') as HTMLInputElement;
const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
const avatarInput = document.getElementById('avatar') as HTMLInputElement;
const searchInput = document.getElementById('search') as HTMLInputElement;
const resultsLineElement = document.getElementById('results-line') as HTMLParagraphElement;
const feedElement = document.getElementById('feed') as HTMLElement;

/**
 * Loads notes from localStorage. If no saved notes exist yet, seeds with fixtures.
 */
function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // Fall back to seed data if localStorage read fails
  }
  const initial = [...seedNotes];
  saveNotes(initial);
  return initial;
}

/**
 * Persists notes array to localStorage.
 */
function saveNotes(notesToSave: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notesToSave));
  } catch {
    // Storage quota or disabled
  }
}

/**
 * Validates and sanitizes a URL for anchor hrefs.
 * Only allows http:, https:, and mailto: protocols.
 * Explicitly rejects javascript:, vbscript:, and data: schemes.
 */
function sanitizeUrl(rawUrl: string): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  const cleaned = trimmed.replace(/[\x00-\x20\s\u00A0]+/g, '');
  // Protocol guard check: reject javascript:, vbscript:, data:
  if (/^(javascript|vbscript|data):/i.test(cleaned)) {
    return null;
  }
  try {
    const parsed = new URL(trimmed, window.location.href);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:' && parsed.protocol !== 'mailto:') {
      return null;
    }
    return trimmed;
  } catch {
    return null;
  }
}

/**
 * Validates and sanitizes an avatar image URL.
 * Only allows http:, https:, and data:image/ schemes.
 * Rejects javascript: and other executable or unsupported protocols.
 */
function sanitizeAvatarUrl(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/[\x00-\x20\s\u00A0]+/g, '');
  // Protocol guard check: reject javascript:, vbscript:
  if (/^(javascript|vbscript):/i.test(cleaned)) {
    return null;
  }
  if (trimmed.startsWith('data:image/')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed, window.location.href);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return trimmed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Safely renders rich text into a container element without innerHTML sinks.
 * Supports inline tags: <b>, <strong>, <i>, <em>, <a href="...">, <br>, and newlines.
 * Disallowed tags (script, img, svg, iframe, etc.) and dangerous event handler attributes
 * (onerror, onload, onclick, onmouseover) are stripped completely.
 */
function renderRichText(container: HTMLElement, text: string): void {
  container.replaceChildren();

  // Normalize newlines to <br>
  const withLineBreaks = text.replace(/\r\n|\r|\n/g, '<br>');

  const parser = new DOMParser();
  const doc = parser.parseFromString(withLineBreaks, 'text/html');

  function walk(node: Node, targetParent: Node): void {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        targetParent.appendChild(document.createTextNode(child.textContent || ''));
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as Element;
        const tag = el.tagName.toUpperCase();

        if (tag === 'B' || tag === 'STRONG') {
          const bold = document.createElement(tag === 'STRONG' ? 'strong' : 'b');
          walk(el, bold);
          targetParent.appendChild(bold);
        } else if (tag === 'I' || tag === 'EM') {
          const italic = document.createElement(tag === 'EM' ? 'em' : 'i');
          walk(el, italic);
          targetParent.appendChild(italic);
        } else if (tag === 'BR') {
          targetParent.appendChild(document.createElement('br'));
        } else if (tag === 'A') {
          const rawHref = el.getAttribute('href') || '';
          const safeHref = sanitizeUrl(rawHref);
          if (safeHref) {
            const anchor = document.createElement('a');
            anchor.setAttribute('href', safeHref);
            anchor.setAttribute('target', '_blank');
            anchor.setAttribute('rel', 'noopener noreferrer');
            walk(el, anchor);
            targetParent.appendChild(anchor);
          } else {
            // If href is unsafe, preserve child text without rendering an anchor
            walk(el, targetParent);
          }
        } else {
          // Disallow script, style, noscript tags completely
          if (tag !== 'SCRIPT' && tag !== 'STYLE' && tag !== 'NOSCRIPT') {
            walk(el, targetParent);
          }
        }
      }
    }
  }

  walk(doc.body, container);
}

/**
 * Creates the DOM element for a single note card.
 */
function createNoteElement(note: Note): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.setAttribute('data-note-id', String(note.id));

  if (selectedNoteId === note.id) {
    article.setAttribute('aria-current', 'true');
  }

  const header = document.createElement('div');
  header.className = 'note-header';

  // Only render <img class="note-avatar"> when an avatar URL was given and is safe
  const safeAvatar = sanitizeAvatarUrl(note.avatar);
  if (safeAvatar) {
    const img = document.createElement('img');
    img.className = 'note-avatar';
    img.setAttribute('src', safeAvatar);
    img.setAttribute('alt', note.title ? `${note.title} avatar` : 'Author avatar');
    header.appendChild(img);
  }

  const titleWrapper = document.createElement('div');
  titleWrapper.className = 'note-title-wrapper';

  const title = document.createElement('h2');
  title.className = 'note-title';
  title.setAttribute('tabindex', '0');
  title.setAttribute('role', 'button');
  title.setAttribute('aria-label', `Select note ${note.title}`);
  renderRichText(title, note.title);

  title.addEventListener('click', () => {
    selectNote(note.id);
  });

  title.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectNote(note.id);
    }
  });

  titleWrapper.appendChild(title);
  header.appendChild(titleWrapper);
  article.appendChild(header);

  const body = document.createElement('div');
  body.className = 'note-body';
  renderRichText(body, note.body);
  article.appendChild(body);

  return article;
}

/**
 * Renders all notes in the feed, ordered newest-first.
 */
function renderFeed(): void {
  feedElement.replaceChildren();

  // Sort notes newest-first
  const sorted = [...notes].sort((a, b) => {
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    return timeB - timeA || b.id - a.id;
  });

  for (const note of sorted) {
    const el = createNoteElement(note);
    feedElement.appendChild(el);
  }

  filterFeed();
}

/**
 * Updates the #results-line content.
 * Shows 'results for "<query>"' when a query is active, empty string otherwise.
 */
function updateResultsLine(query: string): void {
  if (query) {
    resultsLineElement.textContent = `results for "${query}"`;
  } else {
    resultsLineElement.textContent = '';
  }
}

/**
 * Filters the feed notes based on the current search query.
 * Matches case-insensitively on title or body.
 */
function filterFeed(): void {
  const query = currentQuery.trim().toLowerCase();
  const articles = feedElement.querySelectorAll<HTMLElement>('article.note');

  articles.forEach((article) => {
    const noteIdStr = article.getAttribute('data-note-id');
    const note = notes.find((n) => String(n.id) === noteIdStr);
    if (!note) return;

    if (!query) {
      article.style.display = '';
      return;
    }

    const titleMatch = note.title.toLowerCase().includes(query);
    const bodyMatch = note.body.toLowerCase().includes(query);
    if (titleMatch || bodyMatch) {
      article.style.display = '';
    } else {
      article.style.display = 'none';
    }
  });
}

/**
 * Selects a note by id, updating aria-current and the URL hash.
 */
function selectNote(id: number): void {
  selectedNoteId = id;
  updateSelectionUI();
  updateUrlHash();
}

/**
 * Synchronizes the aria-current attribute across note elements in the feed.
 */
function updateSelectionUI(): void {
  const articles = feedElement.querySelectorAll<HTMLElement>('article.note');
  articles.forEach((article) => {
    const noteIdStr = article.getAttribute('data-note-id');
    if (selectedNoteId !== null && noteIdStr === String(selectedNoteId)) {
      article.setAttribute('aria-current', 'true');
    } else {
      article.removeAttribute('aria-current');
    }
  });
}

/**
 * Updates the URL fragment to keep query and selected note in sync.
 * Format: #q=<query>&note=<id>, #note=<id>, or #q=<query>
 */
function updateUrlHash(): void {
  const params = new URLSearchParams();
  const q = currentQuery.trim();
  if (q) {
    params.set('q', q);
  }
  if (selectedNoteId !== null && !isNaN(selectedNoteId)) {
    params.set('note', String(selectedNoteId));
  }
  const str = params.toString();
  const newHash = str ? `#${str}` : '';

  if (window.location.hash !== newHash) {
    isProgrammaticHashChange = true;
    if (newHash) {
      window.location.hash = newHash;
    } else {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    setTimeout(() => {
      isProgrammaticHashChange = false;
    }, 0);
  }
}

/**
 * Parses the current URL hash into query and noteId.
 */
function parseHash(): { query: string; noteId: number | null } {
  const raw = window.location.hash.replace(/^#/, '');
  if (!raw) return { query: '', noteId: null };
  const params = new URLSearchParams(raw);
  const query = params.get('q') || '';
  const noteStr = params.get('note');
  const noteId = noteStr ? parseInt(noteStr, 10) : null;
  return {
    query,
    noteId: noteId !== null && !isNaN(noteId) ? noteId : null,
  };
}

/**
 * Synchronizes state from the URL hash into the UI.
 */
function syncFromHash(): void {
  const { query, noteId } = parseHash();
  currentQuery = query;
  selectedNoteId = noteId;

  if (searchInput.value !== query) {
    searchInput.value = query;
  }
  updateResultsLine(query);
  updateSelectionUI();
  filterFeed();
}

// Form submission handler
noteForm.addEventListener('submit', (e: Event) => {
  e.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value;
  const avatar = avatarInput.value.trim();

  if (!title || !body.trim()) {
    return;
  }

  const nextId = notes.reduce((max, n) => Math.max(max, n.id), 0) + 1;
  const newNote: Note = {
    id: nextId,
    title,
    body,
    avatar,
    createdAt: new Date().toISOString(),
  };

  notes.unshift(newNote);
  saveNotes(notes);

  // Clear form fields
  noteForm.reset();
  titleInput.value = '';
  bodyInput.value = '';
  avatarInput.value = '';

  renderFeed();
});

// Search input handler
searchInput.addEventListener('input', () => {
  currentQuery = searchInput.value;
  updateResultsLine(currentQuery);
  filterFeed();
  updateUrlHash();
});

// Hash navigation listeners
window.addEventListener('hashchange', () => {
  if (isProgrammaticHashChange) return;
  syncFromHash();
});

window.addEventListener('popstate', () => {
  if (isProgrammaticHashChange) return;
  syncFromHash();
});

// Initialization
notes = loadNotes();
renderFeed();
syncFromHash();
