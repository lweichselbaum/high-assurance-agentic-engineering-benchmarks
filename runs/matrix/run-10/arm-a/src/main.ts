import seedNotes from './fixtures.json';
import './style.css';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto-notes:notes';

const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'A', 'BR']);
const DROPPED_TAGS = new Set(['SCRIPT', 'STYLE']);
const ALLOWED_URL_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

function loadNotes(): Note[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as Note[];
    } catch {
      // fall through to reseed
    }
  }
  const seeded = seedNotes as Note[];
  saveNotes(seeded);
  return seeded;
}

function saveNotes(notes: Note[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

let notes: Note[] = loadNotes();

function nextId(): number {
  return notes.reduce((max, n) => Math.max(max, n.id), 0) + 1;
}

// --- rich text rendering -------------------------------------------------

function isSafeUrl(href: string): boolean {
  try {
    const url = new URL(href, window.location.href);
    return ALLOWED_URL_SCHEMES.has(url.protocol);
  } catch {
    return false;
  }
}

function appendTextWithBreaks(target: Node, text: string): void {
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (i > 0) target.appendChild(document.createElement('br'));
    if (line) target.appendChild(document.createTextNode(line));
  });
}

function sanitizeInto(source: Node, target: Node): void {
  source.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      appendTextWithBreaks(target, child.textContent ?? '');
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const el = child as Element;
    if (DROPPED_TAGS.has(el.tagName)) return;
    if (!ALLOWED_TAGS.has(el.tagName)) {
      sanitizeInto(el, target);
      return;
    }
    const clone = document.createElement(el.tagName.toLowerCase());
    if (el.tagName === 'A') {
      const href = el.getAttribute('href') ?? '';
      if (isSafeUrl(href)) {
        clone.setAttribute('href', href);
        clone.setAttribute('rel', 'noopener noreferrer');
        clone.setAttribute('target', '_blank');
      }
    }
    sanitizeInto(el, clone);
    target.appendChild(clone);
  });
}

function renderRichText(raw: string): DocumentFragment {
  const template = document.createElement('template');
  template.innerHTML = raw;
  const fragment = document.createDocumentFragment();
  sanitizeInto(template.content, fragment);
  return fragment;
}

function plainText(raw: string): string {
  const template = document.createElement('template');
  template.innerHTML = raw;
  return template.content.textContent ?? '';
}

// --- URL fragment state ---------------------------------------------------

interface HashState {
  q: string;
  note: number | null;
}

function readHash(): HashState {
  const hash = window.location.hash.replace(/^#/, '');
  const params = new URLSearchParams(hash);
  const q = params.get('q') ?? '';
  const noteParam = params.get('note');
  const note = noteParam !== null && /^\d+$/.test(noteParam) ? Number(noteParam) : null;
  return { q, note };
}

function writeHash(state: HashState): void {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.note !== null) params.set('note', String(state.note));
  const url = new URL(window.location.href);
  url.hash = params.toString();
  history.replaceState(null, '', url.toString());
}

// --- app state -------------------------------------------------------------

const initialHash = readHash();
let query = initialHash.q;
let selectedId: number | null = initialHash.note;

// --- DOM references ----------------------------------------------------

const form = document.querySelector<HTMLFormElement>('#note-form')!;
const titleInput = document.querySelector<HTMLInputElement>('#title')!;
const bodyInput = document.querySelector<HTMLTextAreaElement>('#body')!;
const avatarInput = document.querySelector<HTMLInputElement>('#avatar')!;
const searchInput = document.querySelector<HTMLInputElement>('#search')!;
const resultsLine = document.querySelector<HTMLParagraphElement>('#results-line')!;
const feed = document.querySelector<HTMLElement>('#feed')!;

searchInput.value = query;

// --- rendering ---------------------------------------------------------

function matchesQuery(note: Note, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    note.title.toLowerCase().includes(needle) || plainText(note.body).toLowerCase().includes(needle)
  );
}

function render(): void {
  resultsLine.textContent = query ? `results for "${query}"` : '';

  const visible = notes.filter((n) => matchesQuery(n, query)).sort((a, b) => b.id - a.id);

  feed.innerHTML = '';

  if (visible.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No notes found.';
    feed.appendChild(empty);
    return;
  }

  for (const note of visible) {
    const article = document.createElement('article');
    article.className = 'note';
    article.dataset.noteId = String(note.id);
    if (note.id === selectedId) {
      article.setAttribute('aria-current', 'true');
    }

    if (note.avatar) {
      const img = document.createElement('img');
      img.className = 'note-avatar';
      img.src = note.avatar;
      img.alt = '';
      article.appendChild(img);
    }

    const heading = document.createElement('h2');
    const titleButton = document.createElement('button');
    titleButton.type = 'button';
    titleButton.className = 'note-title';
    titleButton.textContent = note.title;
    titleButton.addEventListener('click', () => selectNote(note.id));
    heading.appendChild(titleButton);
    article.appendChild(heading);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'note-body';
    bodyEl.appendChild(renderRichText(note.body));
    article.appendChild(bodyEl);

    const meta = document.createElement('p');
    meta.className = 'note-meta';
    const time = document.createElement('time');
    time.dateTime = note.createdAt;
    time.textContent = new Date(note.createdAt).toLocaleString();
    meta.appendChild(time);
    article.appendChild(meta);

    feed.appendChild(article);
  }
}

function selectNote(id: number): void {
  selectedId = id;
  writeHash({ q: query, note: selectedId });
  render();
}

// --- event wiring --------------------------------------------------------

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  if (!title || !body) return;

  const note: Note = {
    id: nextId(),
    title,
    body,
    avatar: avatarInput.value.trim(),
    createdAt: new Date().toISOString(),
  };
  notes.push(note);
  saveNotes(notes);
  form.reset();
  render();
});

searchInput.addEventListener('input', () => {
  query = searchInput.value;
  writeHash({ q: query, note: selectedId });
  render();
});

window.addEventListener('hashchange', () => {
  const state = readHash();
  query = state.q;
  selectedId = state.note;
  searchInput.value = query;
  render();
});

render();
