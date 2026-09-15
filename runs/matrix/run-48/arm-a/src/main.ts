import './style.css';
import seedFixtures from './fixtures.json';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto_notes';

const DANGEROUS_TAGS = new Set([
  'script',
  'style',
  'svg',
  'iframe',
  'object',
  'embed',
  'noscript',
  'template',
  'frame',
  'frameset',
  'applet',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'base',
  'link',
  'meta',
  'img',
  'video',
  'audio',
  'canvas',
]);

function isSafeHref(href: string): boolean {
  if (!href) return false;
  const cleaned = href.replace(/[\u0000-\u0020\u007F-\u009F\s]+/g, '');
  const lower = cleaned.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('data:')
  ) {
    return false;
  }
  try {
    const parsed = new URL(href, window.location.origin);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isSafeAvatarUrl(url: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  const cleaned = trimmed.replace(/[\u0000-\u0020\u007F-\u009F\s]+/g, '');
  const lower = cleaned.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('vbscript:')) {
    return false;
  }
  if (lower.startsWith('data:image/')) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function renderNodeToTarget(srcNode: Node, target: Node): void {
  if (srcNode.nodeType === Node.TEXT_NODE) {
    const text = srcNode.textContent ?? '';
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) {
        target.appendChild(document.createElement('br'));
      }
      if (lines[i].length > 0) {
        target.appendChild(document.createTextNode(lines[i]));
      }
    }
    return;
  }

  if (srcNode.nodeType === Node.ELEMENT_NODE) {
    const el = srcNode as Element;
    const tag = el.tagName.toLowerCase();

    if (DANGEROUS_TAGS.has(tag)) {
      return;
    }

    if (tag === 'br') {
      target.appendChild(document.createElement('br'));
      return;
    }

    if (tag === 'b' || tag === 'strong' || tag === 'i' || tag === 'em') {
      const out = document.createElement(tag);
      for (const child of Array.from(el.childNodes)) {
        renderNodeToTarget(child, out);
      }
      target.appendChild(out);
      return;
    }

    if (tag === 'a') {
      const href = el.getAttribute('href') ?? '';
      if (isSafeHref(href)) {
        const out = document.createElement('a');
        out.href = href.trim();
        out.rel = 'noopener noreferrer';
        for (const child of Array.from(el.childNodes)) {
          renderNodeToTarget(child, out);
        }
        target.appendChild(out);
      } else {
        for (const child of Array.from(el.childNodes)) {
          renderNodeToTarget(child, target);
        }
      }
      return;
    }

    for (const child of Array.from(el.childNodes)) {
      renderNodeToTarget(child, target);
    }
  }
}

function renderSafeRichText(container: HTMLElement, raw: string): void {
  container.replaceChildren();
  if (!raw) return;

  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, 'text/html');
  for (const child of Array.from(doc.body.childNodes)) {
    renderNodeToTarget(child, container);
  }
}

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error loading notes from localStorage:', e);
  }
  const initial = (seedFixtures as Note[]).map((n) => ({ ...n }));
  saveNotes(initial);
  return initial;
}

function saveNotes(notesToSave: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notesToSave));
  } catch (e) {
    console.error('Error saving notes to localStorage:', e);
  }
}

function getNextId(existingNotes: Note[]): number {
  if (existingNotes.length === 0) return 1;
  return Math.max(...existingNotes.map((n) => n.id)) + 1;
}

function parseFragment(): { query: string; noteId: number | null } {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) {
    return { query: '', noteId: null };
  }
  const params = new URLSearchParams(hash);
  const query = params.get('q') ?? '';
  const noteStr = params.get('note');
  let noteId: number | null = null;
  if (noteStr) {
    const parsed = parseInt(noteStr, 10);
    if (!isNaN(parsed)) {
      noteId = parsed;
    }
  }
  return { query, noteId };
}

function updateFragment(query: string, noteId: number | null): void {
  const params = new URLSearchParams();
  if (query) {
    params.set('q', query);
  }
  if (noteId !== null && !isNaN(noteId)) {
    params.set('note', String(noteId));
  }
  const str = params.toString();
  const newHash = str ? `#${str}` : '';
  const targetUrl = newHash
    ? `${window.location.pathname}${window.location.search}${newHash}`
    : `${window.location.pathname}${window.location.search}`;

  if (window.location.hash !== newHash) {
    history.replaceState(null, '', targetUrl);
  }
}

function createNoteElement(note: Note): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.setAttribute('data-note-id', String(note.id));

  const headerBar = document.createElement('div');
  headerBar.className = 'note-header-bar';

  if (note.avatar && isSafeAvatarUrl(note.avatar)) {
    const img = document.createElement('img');
    img.className = 'note-avatar';
    img.src = note.avatar.trim();
    img.alt = 'Author avatar';
    headerBar.appendChild(img);
  }

  const titleEl = document.createElement('h2');
  titleEl.className = 'note-title';
  titleEl.setAttribute('role', 'button');
  titleEl.setAttribute('tabindex', '0');
  renderSafeRichText(titleEl, note.title);
  headerBar.appendChild(titleEl);

  article.appendChild(headerBar);

  const bodyEl = document.createElement('div');
  bodyEl.className = 'note-body';
  renderSafeRichText(bodyEl, note.body);
  article.appendChild(bodyEl);

  return article;
}

let notes: Note[] = [];
let currentQuery = '';
let selectedNoteId: number | null = null;

const feed = document.getElementById('feed') as HTMLElement;
const searchInput = document.getElementById('search') as HTMLInputElement;
const resultsLine = document.getElementById('results-line') as HTMLParagraphElement;
const noteForm = document.getElementById('note-form') as HTMLFormElement;
const titleInput = document.getElementById('title') as HTMLInputElement;
const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
const avatarInput = document.getElementById('avatar') as HTMLInputElement;

function matchesQuery(note: Note, query: string): boolean {
  const q = query.toLowerCase();
  return (note.title + ' ' + note.body).toLowerCase().includes(q);
}

function filterFeed(): void {
  if (currentQuery) {
    resultsLine.textContent = `results for "${currentQuery}"`;
  } else {
    resultsLine.textContent = '';
  }

  const articles = feed.querySelectorAll<HTMLElement>('article.note');
  articles.forEach((art) => {
    const id = parseInt(art.getAttribute('data-note-id') ?? '', 10);
    const note = notes.find((n) => n.id === id);
    if (!note) return;

    const isMatch = !currentQuery || matchesQuery(note, currentQuery);
    art.style.display = isMatch ? '' : 'none';

    if (selectedNoteId !== null && note.id === selectedNoteId) {
      art.setAttribute('aria-current', 'true');
    } else {
      art.removeAttribute('aria-current');
    }
  });
}

function renderAllNotes(): void {
  feed.replaceChildren();
  const sorted = [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const note of sorted) {
    const el = createNoteElement(note);
    feed.appendChild(el);
  }
}

function init(): void {
  notes = loadNotes();
  renderAllNotes();

  const { query, noteId } = parseFragment();
  currentQuery = query;
  selectedNoteId = noteId;
  searchInput.value = query;
  filterFeed();

  searchInput.addEventListener('input', () => {
    currentQuery = searchInput.value;
    filterFeed();
    updateFragment(currentQuery, selectedNoteId);
  });

  feed.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    const titleEl = target?.closest('.note-title');
    if (titleEl) {
      const article = titleEl.closest<HTMLElement>('article.note');
      const idStr = article?.getAttribute('data-note-id');
      if (idStr) {
        selectedNoteId = parseInt(idStr, 10);
        filterFeed();
        updateFragment(currentQuery, selectedNoteId);
      }
    }
  });

  feed.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const target = e.target as HTMLElement | null;
      if (target?.classList.contains('note-title')) {
        e.preventDefault();
        const article = target.closest<HTMLElement>('article.note');
        const idStr = article?.getAttribute('data-note-id');
        if (idStr) {
          selectedNoteId = parseInt(idStr, 10);
          filterFeed();
          updateFragment(currentQuery, selectedNoteId);
        }
      }
    }
  });

  noteForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = titleInput.value;
    const body = bodyInput.value;
    const avatar = avatarInput.value;

    const newNote: Note = {
      id: getNextId(notes),
      title,
      body,
      avatar,
      createdAt: new Date().toISOString(),
    };

    notes.unshift(newNote);
    saveNotes(notes);

    titleInput.value = '';
    bodyInput.value = '';
    avatarInput.value = '';

    renderAllNotes();
    filterFeed();
  });

  window.addEventListener('hashchange', () => {
    const { query, noteId } = parseFragment();
    if (query !== currentQuery) {
      currentQuery = query;
      searchInput.value = query;
    }
    selectedNoteId = noteId;
    filterFeed();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
