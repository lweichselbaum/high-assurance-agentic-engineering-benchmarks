import './style.css';
import DOMPurify from 'dompurify';
import { sanitizeHtml } from 'safevalues';
import { setElementInnerHtml } from 'safevalues/dom';
import initialFixtures from '../fixtures.json';

export interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto_notes';

let allNotes: Note[] = [];
let searchQuery = '';
let selectedNoteId: number | null = null;

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as Note[];
      }
    }
  } catch {
    // Fallback on storage errors
  }
  const seeded = [...(initialFixtures as Note[])];
  saveNotes(seeded);
  return seeded;
}

function saveNotes(notes: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // Ignore storage quota or access errors
  }
}

function sortNewestFirst(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function isSafeAvatarUrl(url: string | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (/^\s*(?:javascript|vbscript|data(?!:image\/))/i.test(trimmed)) {
    return false;
  }
  if (/[\u0000-\u001F"']/.test(trimmed)) {
    return false;
  }
  if (/^data:image\/(?:png|jpeg|jpg|gif|webp|svg\+xml)(?:;[a-z0-9=+;% -]+)?,/i.test(trimmed)) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function renderBodyInto(container: HTMLElement, rawBody: string): void {
  const withBreaks = rawBody.replace(/\r?\n/g, '<br>');
  const purified = DOMPurify.sanitize(withBreaks, {
    ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 's', 'a', 'br'],
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
  });
  const safeHtml = sanitizeHtml(purified);
  setElementInnerHtml(container, safeHtml);

  // Defense-in-depth sanitization of handlers and dangerous protocols
  const allChildren = container.querySelectorAll('*');
  for (const el of Array.from(allChildren)) {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.toLowerCase().startsWith('on')) {
        el.removeAttribute(attr.name);
      }
    }
  }
  const anchors = container.querySelectorAll('a');
  for (const a of Array.from(anchors)) {
    const href = a.getAttribute('href');
    if (href) {
      if (/^\s*javascript:/i.test(href) || /[\u0000-\u001F]/.test(href)) {
        a.removeAttribute('href');
      } else {
        try {
          const parsed = new URL(href, window.location.origin);
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:' && parsed.protocol !== 'mailto:') {
            a.removeAttribute('href');
          }
        } catch {
          a.removeAttribute('href');
        }
      }
    }
  }
}

function createNoteElement(note: Note, isSelected: boolean): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.setAttribute('data-note-id', String(note.id));
  if (isSelected) {
    article.setAttribute('aria-current', 'true');
  }

  const header = document.createElement('div');
  header.className = 'note-header';

  if (isSafeAvatarUrl(note.avatar)) {
    const img = document.createElement('img');
    img.className = 'note-avatar';
    img.src = note.avatar.trim();
    img.alt = `${note.title} avatar`;
    header.appendChild(img);
  }

  const titleWrap = document.createElement('div');
  titleWrap.className = 'note-title-wrap';

  const titleEl = document.createElement('h2');
  titleEl.className = 'note-title';
  titleEl.textContent = note.title;
  titleEl.setAttribute('role', 'button');
  titleEl.setAttribute('tabindex', '0');
  titleEl.addEventListener('click', () => {
    selectNote(note.id);
  });
  titleEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectNote(note.id);
    }
  });

  titleWrap.appendChild(titleEl);
  header.appendChild(titleWrap);
  article.appendChild(header);

  const bodyEl = document.createElement('div');
  bodyEl.className = 'note-body';
  renderBodyInto(bodyEl, note.body);
  article.appendChild(bodyEl);

  return article;
}

function parseFragment(): { query: string; noteId: number | null } {
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (!hash) {
    return { query: '', noteId: null };
  }
  const params = new URLSearchParams(hash);
  const q = params.get('q') ?? '';
  const noteParam = params.get('note');
  const parsedId = noteParam ? parseInt(noteParam, 10) : null;
  const noteId = parsedId !== null && !isNaN(parsedId) ? parsedId : null;
  return { query: q, noteId };
}

function updateUrlFragment(): void {
  const params = new URLSearchParams();
  if (searchQuery !== '') {
    params.set('q', searchQuery);
  }
  if (selectedNoteId !== null) {
    params.set('note', String(selectedNoteId));
  }
  const hashStr = params.toString();
  const target = hashStr ? `#${hashStr}` : window.location.pathname + window.location.search;
  window.history.replaceState(null, '', target);
}

function selectNote(id: number): void {
  selectedNoteId = id;
  updateSelectionUi();
  updateUrlFragment();
}

function updateSelectionUi(): void {
  const feed = document.getElementById('feed');
  if (!feed) return;
  const articles = feed.querySelectorAll<HTMLElement>('article.note');
  articles.forEach((art) => {
    const idAttr = art.getAttribute('data-note-id');
    if (idAttr && Number(idAttr) === selectedNoteId) {
      art.setAttribute('aria-current', 'true');
    } else {
      art.removeAttribute('aria-current');
    }
  });
}

function renderFeed(): void {
  const feed = document.getElementById('feed');
  const resultsLine = document.getElementById('results-line');
  if (!feed || !resultsLine) return;

  if (searchQuery !== '') {
    resultsLine.textContent = `results for "${searchQuery}"`;
  } else {
    resultsLine.textContent = '';
  }

  const q = searchQuery.toLowerCase();
  const sorted = sortNewestFirst(allNotes);
  const filtered = q
    ? sorted.filter((n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))
    : sorted;

  feed.replaceChildren();
  for (const note of filtered) {
    const noteEl = createNoteElement(note, note.id === selectedNoteId);
    feed.appendChild(noteEl);
  }
}

function init(): void {
  allNotes = loadNotes();

  const searchInput = document.getElementById('search') as HTMLInputElement | null;
  const noteForm = document.getElementById('note-form') as HTMLFormElement | null;
  const titleInput = document.getElementById('title') as HTMLInputElement | null;
  const bodyInput = document.getElementById('body') as HTMLTextAreaElement | null;
  const avatarInput = document.getElementById('avatar') as HTMLInputElement | null;

  const initialFragment = parseFragment();
  searchQuery = initialFragment.query;
  selectedNoteId = initialFragment.noteId;

  if (searchInput) {
    searchInput.value = searchQuery;
    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value;
      renderFeed();
      updateUrlFragment();
    });
  }

  if (noteForm && titleInput && bodyInput && avatarInput) {
    noteForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = titleInput.value.trim();
      const body = bodyInput.value;
      const avatar = avatarInput.value.trim();
      if (!title && !body.trim()) return;

      const newNote: Note = {
        id: Math.max(0, ...allNotes.map((n) => n.id)) + 1,
        title,
        body,
        avatar,
        createdAt: new Date().toISOString(),
      };

      allNotes.unshift(newNote);
      saveNotes(allNotes);

      titleInput.value = '';
      bodyInput.value = '';
      avatarInput.value = '';

      renderFeed();
    });
  }

  window.addEventListener('hashchange', () => {
    const updated = parseFragment();
    if (updated.query !== searchQuery || updated.noteId !== selectedNoteId) {
      searchQuery = updated.query;
      selectedNoteId = updated.noteId;
      if (searchInput) {
        searchInput.value = searchQuery;
      }
      renderFeed();
    }
  });

  renderFeed();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
