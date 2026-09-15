import seedNotes from '../fixtures.json';
import './style.css';

export interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto_notes_data';

// Load notes from localStorage or seed with fixtures
function loadNotes(): Note[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored !== null) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (e) {
      console.error('Failed to parse notes from localStorage', e);
    }
  }
  // Seed initial notes
  const initial = seedNotes as Note[];
  saveNotes(initial);
  return initial;
}

function saveNotes(notes: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch (e) {
    console.error('Failed to save notes to localStorage', e);
  }
}

// Rich Text Sanitizer & Renderer
export function sanitizeRichText(input: string): Node[] {
  if (!input) return [];

  // Convert newlines (\r\n or \n) to <br> tags
  const htmlInput = input.replace(/\r\n|\r|\n/g, '<br>');

  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlInput, 'text/html');

  const allowedTags = new Set(['B', 'STRONG', 'I', 'EM', 'A', 'BR']);
  const forbiddenTags = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'NOSCRIPT']);

  function processNode(node: Node): Node | null {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.nodeValue || '');
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tagName = el.tagName.toUpperCase();

      if (forbiddenTags.has(tagName)) {
        return null;
      }

      if (allowedTags.has(tagName)) {
        const newEl = document.createElement(tagName.toLowerCase());

        if (tagName === 'A') {
          const href = el.getAttribute('href');
          if (href) {
            const cleanHref = href.trim();
            if (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(cleanHref)) {
              newEl.setAttribute('href', cleanHref);
              newEl.setAttribute('target', '_blank');
              newEl.setAttribute('rel', 'noopener noreferrer');
            }
          }
        }

        for (const child of Array.from(el.childNodes)) {
          const processedChild = processNode(child);
          if (processedChild) {
            newEl.appendChild(processedChild);
          }
        }
        return newEl;
      } else {
        const fragment = document.createDocumentFragment();
        for (const child of Array.from(el.childNodes)) {
          const processedChild = processNode(child);
          if (processedChild) {
            fragment.appendChild(processedChild);
          }
        }
        return fragment;
      }
    }

    return null;
  }

  const nodes: Node[] = [];
  for (const child of Array.from(doc.body.childNodes)) {
    const processed = processNode(child);
    if (processed) {
      nodes.push(processed);
    }
  }
  return nodes;
}

export function renderRichText(container: HTMLElement, text: string): void {
  container.replaceChildren();
  const nodes = sanitizeRichText(text);
  for (const node of nodes) {
    container.appendChild(node);
  }
}

// URL Fragment Handling
function parseHash(): { query: string; selectedNoteId: number | null } {
  const rawHash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  const params = new URLSearchParams(rawHash);
  const query = params.get('q') || '';
  const noteParam = params.get('note');
  let selectedNoteId: number | null = null;
  if (noteParam !== null && noteParam !== '') {
    const parsed = parseInt(noteParam, 10);
    if (!isNaN(parsed)) {
      selectedNoteId = parsed;
    }
  }
  return { query, selectedNoteId };
}

function updateUrlHash(query: string, selectedNoteId: number | null): void {
  const params = new URLSearchParams();
  if (query) {
    params.set('q', query);
  }
  if (selectedNoteId !== null && selectedNoteId !== undefined) {
    params.set('note', String(selectedNoteId));
  }
  const str = params.toString();
  const newHash = str ? `#${str}` : '';

  if (window.location.hash !== newHash) {
    if (newHash) {
      history.replaceState(null, '', newHash);
    } else {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }
}

// Main App Controller
function initApp(): void {
  const notes: Note[] = loadNotes();

  const noteForm = document.getElementById('note-form') as HTMLFormElement;
  const titleInput = document.getElementById('title') as HTMLInputElement;
  const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
  const avatarInput = document.getElementById('avatar') as HTMLInputElement;
  const searchInput = document.getElementById('search') as HTMLInputElement;
  const resultsLine = document.getElementById('results-line') as HTMLParagraphElement;
  const feedElement = document.getElementById('feed') as HTMLElement;

  if (!noteForm || !titleInput || !bodyInput || !avatarInput || !searchInput || !resultsLine || !feedElement) {
    console.error('Porto Notes: Required DOM elements missing.');
    return;
  }

  // Initial State from Hash
  const initialHash = parseHash();
  let currentQuery = initialHash.query;
  let selectedNoteId = initialHash.selectedNoteId;

  searchInput.value = currentQuery;

  function sortNotesNewestFirst(notesList: Note[]): Note[] {
    return [...notesList].sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      if (isNaN(timeA) || isNaN(timeB) || timeA === timeB) {
        return b.id - a.id;
      }
      return timeB - timeA;
    });
  }

  function render(): void {
    // Update results line
    if (currentQuery !== '') {
      resultsLine.textContent = `results for "${currentQuery}"`;
    } else {
      resultsLine.textContent = '';
    }

    // Filter notes
    const q = currentQuery.toLowerCase();
    const filtered = currentQuery
      ? notes.filter(
          (n) =>
            n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)
        )
      : notes;

    feedElement.replaceChildren();

    if (filtered.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.className = 'no-notes-message';
      emptyMsg.textContent = currentQuery
        ? `No notes matching "${currentQuery}"`
        : 'No notes available.';
      feedElement.appendChild(emptyMsg);
      return;
    }

    const sorted = sortNotesNewestFirst(filtered);

    for (const note of sorted) {
      const article = document.createElement('article');
      article.className = 'note';
      article.setAttribute('data-note-id', String(note.id));

      if (note.id === selectedNoteId) {
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
      titleEl.setAttribute('tabindex', '0');
      titleEl.setAttribute('role', 'button');
      renderRichText(titleEl, note.title);
      header.appendChild(titleEl);

      article.appendChild(header);

      const bodyEl = document.createElement('div');
      bodyEl.className = 'note-body';
      renderRichText(bodyEl, note.body);
      article.appendChild(bodyEl);

      feedElement.appendChild(article);
    }
  }

  function selectNote(id: number): void {
    selectedNoteId = id;
    updateUrlHash(currentQuery, selectedNoteId);

    const articles = feedElement.querySelectorAll<HTMLElement>('article.note');
    articles.forEach((article) => {
      const noteIdStr = article.getAttribute('data-note-id');
      if (noteIdStr && parseInt(noteIdStr, 10) === selectedNoteId) {
        article.setAttribute('aria-current', 'true');
      } else {
        article.removeAttribute('aria-current');
      }
    });
  }

  // Form Submission Handler
  noteForm.addEventListener('submit', (e: Event) => {
    e.preventDefault();

    const titleVal = titleInput.value.trim();
    const bodyVal = bodyInput.value;
    const avatarVal = avatarInput.value.trim();

    if (!titleVal || !bodyVal.trim()) {
      return;
    }

    const nextId = notes.length > 0 ? Math.max(...notes.map((n) => n.id)) + 1 : 1;
    const newNote: Note = {
      id: nextId,
      title: titleVal,
      body: bodyVal,
      avatar: avatarVal,
      createdAt: new Date().toISOString(),
    };

    notes.unshift(newNote);
    saveNotes(notes);

    noteForm.reset();
    render();
  });

  // Search Input Handler
  searchInput.addEventListener('input', () => {
    currentQuery = searchInput.value;
    updateUrlHash(currentQuery, selectedNoteId);
    render();
  });

  // Feed Click & Keyboard Handler
  feedElement.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const noteTitle = target.closest('.note-title');
    if (noteTitle) {
      const article = noteTitle.closest('article.note');
      if (article) {
        const noteIdStr = article.getAttribute('data-note-id');
        if (noteIdStr) {
          selectNote(parseInt(noteIdStr, 10));
        }
      }
    }
  });

  feedElement.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const target = e.target as HTMLElement;
      const noteTitle = target.closest('.note-title');
      if (noteTitle) {
        e.preventDefault();
        const article = noteTitle.closest('article.note');
        if (article) {
          const noteIdStr = article.getAttribute('data-note-id');
          if (noteIdStr) {
            selectNote(parseInt(noteIdStr, 10));
          }
        }
      }
    }
  });

  // URL Hash Sync Handler
  const syncFromUrl = (): void => {
    const { query, selectedNoteId: newSelectedId } = parseHash();
    currentQuery = query;
    selectedNoteId = newSelectedId;
    searchInput.value = currentQuery;
    render();
  };

  window.addEventListener('hashchange', syncFromUrl);
  window.addEventListener('popstate', syncFromUrl);

  // Initial Render
  render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
