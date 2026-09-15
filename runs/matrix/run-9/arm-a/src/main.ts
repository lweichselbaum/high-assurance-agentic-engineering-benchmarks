import './style.css';
import seedNotes from './fixtures.json';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto-notes';

const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'A', 'BR']);
const SAFE_URL = /^(https?:|mailto:)/i;

/**
 * Parses `raw` as inert (non-executing) HTML and rebuilds it into a fragment
 * containing only the whitelisted formatting tags. Anything else is unwrapped
 * to its text content, so untrusted note bodies can never inject scripts,
 * event handlers, or unexpected elements.
 */
function renderRichText(raw: string): DocumentFragment {
  const withBreaks = raw.replace(/\r\n|\r|\n/g, '<br>');
  const parsed = new DOMParser().parseFromString(withBreaks, 'text/html');
  const fragment = document.createDocumentFragment();
  parsed.body.childNodes.forEach((node) => appendSanitized(fragment, node));
  return fragment;
}

function appendSanitized(target: Node, node: ChildNode): void {
  if (node.nodeType === Node.TEXT_NODE) {
    target.appendChild(document.createTextNode(node.textContent ?? ''));
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const el = node as Element;
  if (!ALLOWED_TAGS.has(el.tagName)) {
    el.childNodes.forEach((child) => appendSanitized(target, child));
    return;
  }

  const clean = document.createElement(el.tagName.toLowerCase());
  if (el.tagName === 'A') {
    const href = (el.getAttribute('href') ?? '').trim();
    if (SAFE_URL.test(href)) {
      clean.setAttribute('href', href);
      clean.setAttribute('rel', 'noopener noreferrer');
    }
  }
  el.childNodes.forEach((child) => appendSanitized(clean, child));
  target.appendChild(clean);
}

function loadNotes(): Note[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as Note[];
    } catch {
      // fall through to seed
    }
  }
  const seeded = seedNotes as Note[];
  saveNotes(seeded);
  return seeded;
}

function saveNotes(list: Note[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function nextId(list: Note[]): number {
  return list.reduce((max, n) => Math.max(max, n.id), 0) + 1;
}

const notes: Note[] = loadNotes();

const formEl = document.querySelector<HTMLFormElement>('#note-form')!;
const titleInput = document.querySelector<HTMLInputElement>('#title')!;
const bodyInput = document.querySelector<HTMLTextAreaElement>('#body')!;
const avatarInput = document.querySelector<HTMLInputElement>('#avatar')!;
const searchInput = document.querySelector<HTMLInputElement>('#search')!;
const resultsLine = document.querySelector<HTMLElement>('#results-line')!;
const feedEl = document.querySelector<HTMLElement>('#feed')!;

let query = '';
let selectedId: number | null = null;

function parseHash(): { q: string; note: number | null } {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  const q = params.get('q') ?? '';
  const noteParam = params.get('note');
  const note = noteParam !== null ? Number(noteParam) : NaN;
  return { q, note: Number.isFinite(note) ? note : null };
}

function updateHash(): void {
  const params = new URLSearchParams();
  const trimmed = query.trim();
  if (trimmed) params.set('q', trimmed);
  if (selectedId !== null) params.set('note', String(selectedId));
  const hash = params.toString();
  const url = hash ? `#${hash}` : location.pathname + location.search;
  history.replaceState(null, '', url);
}

function matchesQuery(note: Note, needle: string): boolean {
  if (!needle) return true;
  const lower = needle.toLowerCase();
  return note.title.toLowerCase().includes(lower) || note.body.toLowerCase().includes(lower);
}

function renderNoteArticle(note: Note): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.dataset.noteId = String(note.id);
  if (selectedId === note.id) {
    article.setAttribute('aria-current', 'true');
  }

  if (note.avatar) {
    const img = document.createElement('img');
    img.className = 'note-avatar';
    img.src = note.avatar;
    img.alt = '';
    article.appendChild(img);
  }

  const titleEl = document.createElement('h3');
  titleEl.className = 'note-title';
  titleEl.tabIndex = 0;
  titleEl.setAttribute('role', 'button');
  titleEl.appendChild(renderRichText(note.title));
  titleEl.addEventListener('click', () => selectNote(note.id));
  titleEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectNote(note.id);
    }
  });
  article.appendChild(titleEl);

  const bodyEl = document.createElement('div');
  bodyEl.className = 'note-body';
  bodyEl.appendChild(renderRichText(note.body));
  article.appendChild(bodyEl);

  return article;
}

function renderFeed(): void {
  const trimmed = query.trim();
  resultsLine.textContent = trimmed ? `results for "${trimmed}"` : '';

  const filtered = notes.filter((n) => matchesQuery(n, trimmed)).sort((a, b) => b.id - a.id);

  feedEl.innerHTML = '';
  for (const note of filtered) {
    feedEl.appendChild(renderNoteArticle(note));
  }
}

function selectNote(id: number): void {
  selectedId = id;
  updateHash();
  renderFeed();
}

formEl.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  const avatar = avatarInput.value.trim();
  if (!title || !body) return;

  notes.push({
    id: nextId(notes),
    title,
    body,
    avatar,
    createdAt: new Date().toISOString(),
  });
  saveNotes(notes);
  formEl.reset();
  renderFeed();
});

searchInput.addEventListener('input', () => {
  query = searchInput.value;
  updateHash();
  renderFeed();
});

window.addEventListener('hashchange', () => {
  const { q, note } = parseHash();
  query = q;
  selectedId = note;
  searchInput.value = query;
  renderFeed();
});

function init(): void {
  const { q, note } = parseHash();
  query = q;
  selectedId = note;
  searchInput.value = query;
  renderFeed();
}

init();
