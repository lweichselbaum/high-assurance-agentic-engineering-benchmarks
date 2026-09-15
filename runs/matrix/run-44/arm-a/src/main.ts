import './style.css';
import { Note } from './types';
import seedFixtures from '../fixtures.json';

const STORAGE_KEY = 'porto_notes';

let notes: Note[] = [];
let currentQuery = '';
let selectedNoteId: number | null = null;

/**
 * Loads notes from localStorage, or seeds from fixtures.json if no saved notes exist.
 */
function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      const initial = seedFixtures as Note[];
      saveNotes(initial);
      return [...initial];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (e) {
    console.error('Failed to parse notes from localStorage', e);
  }
  return [...(seedFixtures as Note[])];
}

/**
 * Persists notes to localStorage.
 */
function saveNotes(notesToSave: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notesToSave));
  } catch (e) {
    console.error('Failed to save notes to localStorage', e);
  }
}

/**
 * Returns the next available integer id for a new note.
 */
function getNextId(allNotes: Note[]): number {
  if (!allNotes || allNotes.length === 0) return 1;
  const ids = allNotes
    .map((n) => (typeof n.id === 'number' ? n.id : parseInt(String(n.id), 10)))
    .filter((id) => !isNaN(id));
  return ids.length > 0 ? Math.max(...ids) + 1 : 1;
}

/**
 * Parses URL fragment parameters (e.g. #q=port&note=3 or #note=3).
 */
function parseHash(): { q: string; noteId: number | null } {
  const raw = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (!raw) {
    return { q: '', noteId: null };
  }
  const params = new URLSearchParams(raw);
  const q = params.get('q') || '';
  const noteParam = params.get('note');
  const noteId = noteParam !== null ? parseInt(noteParam, 10) : null;
  return {
    q,
    noteId: noteId !== null && !isNaN(noteId) ? noteId : null,
  };
}

/**
 * Synchronizes the URL fragment with current search query and selected note.
 */
function syncUrlHash(): void {
  const params = new URLSearchParams();
  const trimmed = currentQuery.trim();
  if (trimmed) {
    params.set('q', trimmed);
  }
  if (selectedNoteId !== null) {
    params.set('note', String(selectedNoteId));
  }
  const str = params.toString();
  const targetHash = str ? `#${str}` : '';

  if (window.location.hash !== targetHash) {
    if (!targetHash) {
      // Remove hash without scrolling or reload
      history.replaceState(null, '', window.location.pathname + window.location.search);
    } else {
      window.location.hash = targetHash;
    }
  }
}

/**
 * Validates whether an href attribute is safe to render on <a> elements.
 */
function isSafeHref(href: string): boolean {
  if (!href) return false;
  const trimmed = href.trim();
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    return false;
  }
  return true;
}

/**
 * Renders user rich text (supports <b>, <strong>, <i>, <em>, <a>, <br>, and newlines)
 * safely into a DocumentFragment without using innerHTML assignment.
 */
function renderRichText(input: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  if (!input) return fragment;

  // Convert literal newlines (\r\n, \n) into <br> tags
  const withLineBreaks = input.replace(/\r\n|\n/g, '<br>');

  const parser = new DOMParser();
  const parsedDoc = parser.parseFromString(withLineBreaks, 'text/html');

  function sanitizeAndAppend(sourceNode: Node, targetContainer: Node): void {
    for (const child of Array.from(sourceNode.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        if (child.textContent) {
          targetContainer.appendChild(document.createTextNode(child.textContent));
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        const tag = el.tagName.toUpperCase();

        if (tag === 'B' || tag === 'STRONG') {
          const strongEl = document.createElement(tag === 'B' ? 'b' : 'strong');
          sanitizeAndAppend(el, strongEl);
          targetContainer.appendChild(strongEl);
        } else if (tag === 'I' || tag === 'EM') {
          const emEl = document.createElement(tag === 'I' ? 'i' : 'em');
          sanitizeAndAppend(el, emEl);
          targetContainer.appendChild(emEl);
        } else if (tag === 'BR') {
          targetContainer.appendChild(document.createElement('br'));
        } else if (tag === 'A') {
          const aEl = document.createElement('a');
          const rawHref = el.getAttribute('href') || '';
          if (isSafeHref(rawHref)) {
            aEl.setAttribute('href', rawHref);
            aEl.setAttribute('rel', 'noopener noreferrer');
          }
          sanitizeAndAppend(el, aEl);
          targetContainer.appendChild(aEl);
        } else {
          // Skip dangerous tags entirely
          if (
            tag !== 'SCRIPT' &&
            tag !== 'STYLE' &&
            tag !== 'IFRAME' &&
            tag !== 'OBJECT' &&
            tag !== 'EMBED'
          ) {
            sanitizeAndAppend(el, targetContainer);
          }
        }
      }
    }
  }

  sanitizeAndAppend(parsedDoc.body, fragment);
  return fragment;
}

/**
 * Checks if a note matches the search query (case-insensitive on title or body).
 */
function matchesQuery(note: Note, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const titleLower = (note.title || '').toLowerCase();
  const bodyLower = (note.body || '').toLowerCase();
  if (titleLower.includes(q) || bodyLower.includes(q)) {
    return true;
  }

  const strippedTitle = (note.title || '').replace(/<[^>]*>/g, '').toLowerCase();
  const strippedBody = (note.body || '').replace(/<[^>]*>/g, '').toLowerCase();
  return strippedTitle.includes(q) || strippedBody.includes(q);
}

/**
 * Sorts notes newest-first (descending by createdAt or id).
 */
function getSortedNotes(): Note[] {
  return [...notes].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (timeB !== timeA) {
      return timeB - timeA;
    }
    return b.id - a.id;
  });
}

/**
 * Creates an article element for a single note.
 */
function createNoteElement(note: Note, isSelected: boolean): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.dataset.noteId = String(note.id);
  article.setAttribute('data-note-id', String(note.id));

  if (isSelected) {
    article.setAttribute('aria-current', 'true');
  }

  const header = document.createElement('div');
  header.className = 'note-header';

  // Render avatar only if URL given and non-empty
  if (note.avatar && note.avatar.trim()) {
    const img = document.createElement('img');
    img.className = 'note-avatar';
    img.src = note.avatar.trim();
    img.alt = 'Author avatar';
    img.loading = 'lazy';
    header.appendChild(img);
  }

  const titleEl = document.createElement('h2');
  titleEl.className = 'note-title';
  titleEl.tabIndex = 0;
  titleEl.role = 'button';
  titleEl.setAttribute('aria-label', `Select note: ${note.title}`);
  titleEl.replaceChildren(renderRichText(note.title));

  const handleSelect = (e: Event) => {
    const target = e.target as HTMLElement;
    if (target.tagName !== 'A') {
      e.preventDefault();
      selectNote(note.id);
    }
  };

  titleEl.addEventListener('click', handleSelect);
  titleEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectNote(note.id);
    }
  });

  header.appendChild(titleEl);
  article.appendChild(header);

  const bodyEl = document.createElement('div');
  bodyEl.className = 'note-body';
  bodyEl.replaceChildren(renderRichText(note.body));
  article.appendChild(bodyEl);

  return article;
}

/**
 * Selects a note by id, updates URL fragment and UI.
 */
function selectNote(id: number): void {
  selectedNoteId = id;
  syncUrlHash();

  const feed = document.getElementById('feed');
  if (feed) {
    const articles = feed.querySelectorAll<HTMLElement>('article.note');
    articles.forEach((art) => {
      if (art.dataset.noteId === String(id) || art.getAttribute('data-note-id') === String(id)) {
        art.setAttribute('aria-current', 'true');
      } else {
        art.removeAttribute('aria-current');
      }
    });
  }
}

/**
 * Re-renders the notes feed.
 */
function renderFeed(): void {
  const feed = document.getElementById('feed');
  if (!feed) return;

  const sorted = getSortedNotes();
  const filtered = sorted.filter((note) => matchesQuery(note, currentQuery));

  const fragment = document.createDocumentFragment();

  if (filtered.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-state';
    const p = document.createElement('p');
    p.textContent = currentQuery.trim()
      ? `No notes match "${currentQuery}".`
      : 'No notes yet. Add your first note above!';
    emptyDiv.appendChild(p);
    fragment.appendChild(emptyDiv);
  } else {
    for (const note of filtered) {
      const isSelected = selectedNoteId === note.id;
      const noteArticle = createNoteElement(note, isSelected);
      fragment.appendChild(noteArticle);
    }
  }

  feed.replaceChildren(fragment);
}

/**
 * Updates search state and results-line text.
 */
function onSearchInput(val: string): void {
  currentQuery = val;
  const resultsLine = document.getElementById('results-line');
  if (resultsLine) {
    if (val.trim() === '') {
      resultsLine.textContent = '';
    } else {
      resultsLine.textContent = `results for "${val}"`;
    }
  }
  syncUrlHash();
  renderFeed();
}

/**
 * Initializes the application.
 */
function init(): void {
  notes = loadNotes();

  const { q, noteId } = parseHash();
  currentQuery = q;
  selectedNoteId = noteId;

  const searchInput = document.getElementById('search') as HTMLInputElement | null;
  if (searchInput) {
    searchInput.value = q;
    searchInput.addEventListener('input', () => {
      onSearchInput(searchInput.value);
    });
  }

  const resultsLine = document.getElementById('results-line');
  if (resultsLine) {
    resultsLine.textContent = q.trim() ? `results for "${q}"` : '';
  }

  const noteForm = document.getElementById('note-form') as HTMLFormElement | null;
  const titleInput = document.getElementById('title') as HTMLInputElement | null;
  const bodyInput = document.getElementById('body') as HTMLTextAreaElement | null;
  const avatarInput = document.getElementById('avatar') as HTMLInputElement | null;

  if (noteForm && titleInput && bodyInput && avatarInput) {
    noteForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = titleInput.value;
      const body = bodyInput.value;
      const avatar = avatarInput.value.trim();

      if (!title.trim() && !body.trim()) {
        return;
      }

      const newNote: Note = {
        id: getNextId(notes),
        title,
        body,
        avatar,
        createdAt: new Date().toISOString(),
      };

      notes = [newNote, ...notes];
      saveNotes(notes);

      // Clear form
      titleInput.value = '';
      bodyInput.value = '';
      avatarInput.value = '';
      noteForm.reset();

      renderFeed();
    });
  }

  // Handle browser navigation / hash change
  window.addEventListener('hashchange', () => {
    const parsed = parseHash();
    let shouldRender = false;

    if (parsed.q !== currentQuery) {
      currentQuery = parsed.q;
      if (searchInput && searchInput.value !== parsed.q) {
        searchInput.value = parsed.q;
      }
      if (resultsLine) {
        resultsLine.textContent = parsed.q.trim() ? `results for "${parsed.q}"` : '';
      }
      shouldRender = true;
    }

    if (parsed.noteId !== selectedNoteId) {
      selectedNoteId = parsed.noteId;
      shouldRender = true;
    }

    if (shouldRender) {
      renderFeed();
    }
  });

  renderFeed();
}

// Start app on DOMContentLoaded or immediately if already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
