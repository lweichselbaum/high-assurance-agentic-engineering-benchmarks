import './style.css';
import seedFixtures from '../fixtures.json';

export interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto_notes';

function isSafeAvatarUrl(url: string | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  // Reject dangerous protocols
  const normalized = trimmed.replace(/[\x00-\x20\s]+/g, '').toLowerCase();
  if (
    normalized.startsWith('javascript:') ||
    normalized.startsWith('vbscript:') ||
    normalized.startsWith('blob:') ||
    normalized.startsWith('file:')
  ) {
    return false;
  }

  // Only permit safe image MIME types for data URLs
  if (normalized.startsWith('data:')) {
    return /^data:image\/(?:png|jpeg|jpg|gif|webp|svg\+xml)(?:;[a-zA-Z0-9=._-]+)*,/i.test(trimmed);
  }

  // Allow http: and https: protocols
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  // Allow safe relative paths
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return true;
  }

  return false;
}

function getSafeHref(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  const normalized = trimmed.replace(/[\x00-\x20\s]+/g, '').toLowerCase();
  if (
    normalized.startsWith('javascript:') ||
    normalized.startsWith('vbscript:') ||
    normalized.startsWith('data:') ||
    normalized.startsWith('file:')
  ) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:') {
      return trimmed;
    }
    return null;
  } catch {
    if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
      return trimmed;
    }
    if (trimmed.startsWith('#') || trimmed.startsWith('?')) {
      return trimmed;
    }
    return null;
  }
}

function renderRichTextToNodes(rawText: string): Node[] {
  const formatted = rawText.replace(/\r?\n/g, '<br>');
  const parser = new DOMParser();
  const doc = parser.parseFromString(formatted, 'text/html');

  function convertNode(node: Node): Node[] {
    if (node.nodeType === Node.TEXT_NODE) {
      return [document.createTextNode(node.nodeValue ?? '')];
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();

      if (tag === 'script' || tag === 'style' || tag === 'template' || tag === 'noscript') {
        return [];
      }

      if (tag === 'b' || tag === 'strong') {
        const out = document.createElement(tag);
        for (const child of Array.from(el.childNodes)) {
          for (const converted of convertNode(child)) {
            out.appendChild(converted);
          }
        }
        return [out];
      }

      if (tag === 'i' || tag === 'em') {
        const out = document.createElement(tag);
        for (const child of Array.from(el.childNodes)) {
          for (const converted of convertNode(child)) {
            out.appendChild(converted);
          }
        }
        return [out];
      }

      if (tag === 'br') {
        return [document.createElement('br')];
      }

      if (tag === 'a') {
        const rawHref = el.getAttribute('href') ?? '';
        const safeHref = getSafeHref(rawHref);
        if (safeHref !== null) {
          const a = document.createElement('a');
          a.href = safeHref;
          a.rel = 'noopener noreferrer';
          for (const child of Array.from(el.childNodes)) {
            for (const converted of convertNode(child)) {
              a.appendChild(converted);
            }
          }
          return [a];
        } else {
          const results: Node[] = [];
          for (const child of Array.from(el.childNodes)) {
            results.push(...convertNode(child));
          }
          return results;
        }
      }

      if (
        tag === 'img' ||
        tag === 'iframe' ||
        tag === 'svg' ||
        tag === 'object' ||
        tag === 'embed' ||
        tag === 'video' ||
        tag === 'audio' ||
        tag === 'canvas' ||
        tag === 'form' ||
        tag === 'input' ||
        tag === 'button'
      ) {
        return [];
      }

      const results: Node[] = [];
      for (const child of Array.from(el.childNodes)) {
        results.push(...convertNode(child));
      }
      return results;
    }
    return [];
  }

  const nodes: Node[] = [];
  for (const child of Array.from(doc.body.childNodes)) {
    nodes.push(...convertNode(child));
  }
  return nodes;
}

function parseFragment(): { query: string; noteId: number | null } {
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (!hash) {
    return { query: '', noteId: null };
  }
  const params = new URLSearchParams(hash);
  const query = params.get('q') ?? '';
  const noteParam = params.get('note');
  const parsedId = noteParam !== null ? parseInt(noteParam, 10) : null;
  const noteId = parsedId !== null && !Number.isNaN(parsedId) && parsedId > 0 ? parsedId : null;
  return { query, noteId };
}

function updateFragment(query: string, noteId: number | null): void {
  const params = new URLSearchParams();
  if (query) {
    params.set('q', query);
  }
  if (noteId !== null) {
    params.set('note', String(noteId));
  }
  const str = params.toString();
  const target = str ? `#${str}` : window.location.pathname + window.location.search;
  window.history.replaceState(null, '', target);
}

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as Note[];
      }
    }
  } catch (err) {
    console.error('Failed to load notes from localStorage', err);
  }
  const initial = [...seedFixtures] as Note[];
  saveNotes(initial);
  return initial;
}

function saveNotes(notes: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch (err) {
    console.error('Failed to save notes to localStorage', err);
  }
}

function getFilteredNotes(allNotes: Note[], query: string): Note[] {
  if (!query) {
    return allNotes;
  }
  const q = query.toLowerCase();
  return allNotes.filter((note) => {
    const titleMatch = note.title.toLowerCase().includes(q);
    const bodyMatch = note.body.toLowerCase().includes(q);
    return titleMatch || bodyMatch;
  });
}

function initApp(): void {
  const feedEl = document.getElementById('feed');
  const formEl = document.getElementById('note-form') as HTMLFormElement | null;
  const titleInput = document.getElementById('title') as HTMLInputElement | null;
  const bodyInput = document.getElementById('body') as HTMLTextAreaElement | null;
  const avatarInput = document.getElementById('avatar') as HTMLInputElement | null;
  const searchInput = document.getElementById('search') as HTMLInputElement | null;
  const resultsLine = document.getElementById('results-line');

  if (!feedEl || !formEl || !titleInput || !bodyInput || !avatarInput || !searchInput || !resultsLine) {
    console.error('Required DOM elements missing for Porto Notes');
    return;
  }

  const notes: Note[] = loadNotes();
  const initialFragment = parseFragment();
  let currentQuery = initialFragment.query;
  let selectedNoteId: number | null = initialFragment.noteId;

  function updateResultsLine(query: string): void {
    if (query) {
      resultsLine!.textContent = `results for "${query}"`;
    } else {
      resultsLine!.textContent = '';
    }
  }

  function renderFeed(): void {
    const filtered = getFilteredNotes(notes, currentQuery);
    const sorted = [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);

    const noteElements: HTMLElement[] = [];

    for (const note of sorted) {
      const article = document.createElement('article');
      article.className = 'note';
      article.dataset.noteId = String(note.id);

      if (selectedNoteId === note.id) {
        article.setAttribute('aria-current', 'true');
      }

      if (isSafeAvatarUrl(note.avatar)) {
        const img = document.createElement('img');
        img.className = 'note-avatar';
        img.src = note.avatar;
        img.alt = '';
        article.appendChild(img);
      }

      const contentDiv = document.createElement('div');
      contentDiv.className = 'note-content';

      const titleEl = document.createElement('h3');
      titleEl.className = 'note-title';
      titleEl.tabIndex = 0;
      titleEl.setAttribute('role', 'button');
      titleEl.replaceChildren(...renderRichTextToNodes(note.title));

      const handleSelect = (e: Event): void => {
        e.preventDefault();
        selectedNoteId = note.id;
        updateFragment(currentQuery, selectedNoteId);
        renderFeed();
      };

      titleEl.addEventListener('click', handleSelect);
      titleEl.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleSelect(e);
        }
      });

      contentDiv.appendChild(titleEl);

      const bodyEl = document.createElement('div');
      bodyEl.className = 'note-body';
      bodyEl.replaceChildren(...renderRichTextToNodes(note.body));
      contentDiv.appendChild(bodyEl);

      article.appendChild(contentDiv);
      noteElements.push(article);
    }

    feedEl!.replaceChildren(...noteElements);
  }

  searchInput.value = currentQuery;
  updateResultsLine(currentQuery);

  searchInput.addEventListener('input', () => {
    currentQuery = searchInput.value;
    updateResultsLine(currentQuery);
    updateFragment(currentQuery, selectedNoteId);
    renderFeed();
  });

  formEl.addEventListener('submit', (e: Event) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    const body = bodyInput.value.trim();
    const avatar = avatarInput.value.trim();

    if (!title || !body) {
      return;
    }

    const nextId = notes.reduce((max, n) => (n.id > max ? n.id : max), 0) + 1;
    const newNote: Note = {
      id: nextId,
      title: titleInput.value,
      body: bodyInput.value,
      avatar,
      createdAt: new Date().toISOString(),
    };

    notes.unshift(newNote);
    saveNotes(notes);

    formEl.reset();
    titleInput.value = '';
    bodyInput.value = '';
    avatarInput.value = '';

    renderFeed();
  });

  const handleHashOrPopState = (): void => {
    const { query, noteId } = parseFragment();
    currentQuery = query;
    selectedNoteId = noteId;
    searchInput.value = query;
    updateResultsLine(query);
    renderFeed();
  };

  window.addEventListener('hashchange', handleHashOrPopState);
  window.addEventListener('popstate', handleHashOrPopState);

  renderFeed();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
