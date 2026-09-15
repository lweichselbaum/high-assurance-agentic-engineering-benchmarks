import fixtures from '../fixtures.json';

export interface Note {
  id: number;
  title: string;
  body: string;
  avatar?: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto_notes';

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to parse notes from localStorage:', e);
  }
  const initial = (fixtures as Note[]).map((n) => ({ ...n }));
  saveNotes(initial);
  return initial;
}

function saveNotes(notes: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch (e) {
    console.error('Failed to save notes to localStorage:', e);
  }
}

/**
 * Parses text into safe HTML nodes supporting <b>, <strong>, <i>, <em>, <a href="...">, <br>,
 * and converts line breaks (\n) to <br>. All other tags are safely handled.
 */
export function renderRichText(text: string, targetEl: HTMLElement): void {
  targetEl.replaceChildren();
  if (!text) return;

  // Convert line breaks to <br> tags
  const textWithBrs = text.replace(/\r\n|\r|\n/g, '<br>');

  const doc = new DOMParser().parseFromString(textWithBrs, 'text/html');

  function walk(node: Node, parent: Node) {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        parent.appendChild(document.createTextNode(child.nodeValue || ''));
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        const tag = el.tagName.toLowerCase();

        // Completely disallow risky execution elements
        if (['script', 'style', 'iframe', 'object', 'embed', 'noscript'].includes(tag)) {
          continue;
        }

        if (['b', 'strong', 'i', 'em', 'br'].includes(tag)) {
          const cleanEl = document.createElement(tag);
          if (tag !== 'br') {
            walk(el, cleanEl);
          }
          parent.appendChild(cleanEl);
        } else if (tag === 'a') {
          const cleanEl = document.createElement('a');
          const href = el.getAttribute('href');
          if (href) {
            const trimmedHref = href.trim();
            if (/^(https?:|mailto:|\/|#)/i.test(trimmedHref) || !/^[a-z0-9+-.]+:/i.test(trimmedHref)) {
              cleanEl.setAttribute('href', trimmedHref);
            }
          }
          cleanEl.setAttribute('target', '_blank');
          cleanEl.setAttribute('rel', 'noopener noreferrer');
          walk(el, cleanEl);
          parent.appendChild(cleanEl);
        } else {
          // For other tags, keep text content by processing children
          walk(el, parent);
        }
      }
    }
  }

  const fragment = document.createDocumentFragment();
  walk(doc.body, fragment);
  targetEl.appendChild(fragment);
}

function getHashState(): { searchQuery: string; selectedNoteId: number | null } {
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;

  const params = new URLSearchParams(hash);
  const searchQuery = params.get('q') ?? '';
  const noteStr = params.get('note');
  const selectedNoteId = noteStr !== null && !isNaN(Number(noteStr)) ? Number(noteStr) : null;

  return { searchQuery, selectedNoteId };
}

function syncUrlHash(searchQuery: string, selectedNoteId: number | null): void {
  const params = new URLSearchParams();
  if (searchQuery) {
    params.set('q', searchQuery);
  }
  if (selectedNoteId !== null) {
    params.set('note', String(selectedNoteId));
  }

  const hashStr = params.toString();
  const targetHash = hashStr ? `#${hashStr}` : '';

  if (window.location.hash !== targetHash) {
    history.replaceState(null, '', targetHash || window.location.pathname + window.location.search);
  }
}

function matchesQuery(note: Note, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();

  const plainTitle = note.title.replace(/<[^>]*>/g, ' ').toLowerCase();
  const plainBody = note.body.replace(/<[^>]*>/g, ' ').toLowerCase();
  const rawTitle = note.title.toLowerCase();
  const rawBody = note.body.toLowerCase();

  return plainTitle.includes(q) || plainBody.includes(q) || rawTitle.includes(q) || rawBody.includes(q);
}

// App State
let notes: Note[] = [];
let currentSearchQuery = '';
let currentSelectedNoteId: number | null = null;

// DOM Elements
const formEl = document.getElementById('note-form') as HTMLFormElement;
const titleInput = document.getElementById('title') as HTMLInputElement;
const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
const avatarInput = document.getElementById('avatar') as HTMLInputElement;
const searchInput = document.getElementById('search') as HTMLInputElement;
const resultsLineEl = document.getElementById('results-line') as HTMLParagraphElement;
const feedEl = document.getElementById('feed') as HTMLElement;

function updateResultsLine(): void {
  if (currentSearchQuery.trim() !== '') {
    resultsLineEl.textContent = `results for "${currentSearchQuery}"`;
  } else {
    resultsLineEl.textContent = '';
  }
}

function renderFeed(): void {
  updateResultsLine();
  feedEl.replaceChildren();

  // Filter notes by search query
  const filteredNotes = notes.filter((n) => matchesQuery(n, currentSearchQuery));

  // Sort notes newest-first (by createdAt descending, fallback id descending)
  const sortedNotes = [...filteredNotes].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    if (!isNaN(dateA) && !isNaN(dateB) && dateA !== dateB) {
      return dateB - dateA;
    }
    return b.id - a.id;
  });

  if (sortedNotes.length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'empty-feed';
    emptyMessage.textContent = notes.length === 0 ? 'No notes yet. Add your first note!' : 'No notes match your search.';
    feedEl.appendChild(emptyMessage);
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const note of sortedNotes) {
    const article = document.createElement('article');
    article.className = 'note';
    article.setAttribute('data-note-id', String(note.id));

    if (currentSelectedNoteId === note.id) {
      article.setAttribute('aria-current', 'true');
    }

    const header = document.createElement('div');
    header.className = 'note-header';

    if (note.avatar && note.avatar.trim() !== '') {
      const img = document.createElement('img');
      img.className = 'note-avatar';
      img.src = note.avatar.trim();
      img.alt = 'Avatar';
      header.appendChild(img);
    }

    const titleContainer = document.createElement('div');
    titleContainer.className = 'note-title-container';

    const titleEl = document.createElement('h2');
    titleEl.className = 'note-title';
    titleEl.setAttribute('role', 'button');
    titleEl.setAttribute('tabindex', '0');
    renderRichText(note.title, titleEl);

    const handleSelect = (e: Event) => {
      e.stopPropagation();
      currentSelectedNoteId = note.id;
      syncUrlHash(currentSearchQuery, currentSelectedNoteId);
      renderFeed();
    };

    titleEl.addEventListener('click', handleSelect);
    titleEl.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSelect(e);
      }
    });

    titleContainer.appendChild(titleEl);
    header.appendChild(titleContainer);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'note-body';
    renderRichText(note.body, bodyEl);

    article.appendChild(header);
    article.appendChild(bodyEl);
    fragment.appendChild(article);
  }

  feedEl.appendChild(fragment);
}

function init(): void {
  notes = loadNotes();

  // Read deep link from URL fragment
  const { searchQuery, selectedNoteId } = getHashState();
  currentSearchQuery = searchQuery;
  currentSelectedNoteId = selectedNoteId;
  searchInput.value = currentSearchQuery;

  // Render initial view
  renderFeed();

  // Search input handler
  searchInput.addEventListener('input', () => {
    currentSearchQuery = searchInput.value;
    syncUrlHash(currentSearchQuery, currentSelectedNoteId);
    renderFeed();
  });

  // Form submit handler
  formEl.addEventListener('submit', (e: Event) => {
    e.preventDefault();

    const title = titleInput.value.trim();
    const body = bodyInput.value;
    const avatar = avatarInput.value.trim();

    if (!title || !body.trim()) return;

    const maxId = notes.reduce((max, n) => (n.id > max ? n.id : max), 0);
    const newNote: Note = {
      id: maxId + 1,
      title,
      body,
      avatar: avatar || undefined,
      createdAt: new Date().toISOString(),
    };

    notes.unshift(newNote);
    saveNotes(notes);

    formEl.reset();
    renderFeed();
  });

  // Hash change handler (browser back/forward or direct edit)
  window.addEventListener('hashchange', () => {
    const state = getHashState();
    currentSearchQuery = state.searchQuery;
    currentSelectedNoteId = state.selectedNoteId;
    searchInput.value = currentSearchQuery;
    renderFeed();
  });
}

init();
