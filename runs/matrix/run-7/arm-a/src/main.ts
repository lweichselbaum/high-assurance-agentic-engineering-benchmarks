import './style.css';
import seedNotes from './fixtures.json';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto-notes:notes';

// ---- persistence -----------------------------------------------------

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as Note[];
    }
  } catch {
    // fall through to seed
  }
  const seeded = seedNotes as Note[];
  saveNotes(seeded);
  return seeded;
}

function saveNotes(notes: Note[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function nextId(notes: Note[]): number {
  return notes.reduce((max, n) => Math.max(max, n.id), 0) + 1;
}

// ---- rich text sanitizing ---------------------------------------------
// Whitelist-only renderer: only <b>, <strong>, <i>, <em>, <a href>, <br> pass
// through as markup; everything else is HTML-escaped as plain text. A literal
// newline is also rendered as a line break.

const ALLOWED_TAGS = new Set(['b', 'strong', 'i', 'em', 'br', 'a']);
const TAG_RE = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:\s+[a-zA-Z-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>/g;
const HREF_RE = /href\s*=\s*"([^"]*)"|href\s*=\s*'([^']*)'|href\s*=\s*([^\s>]+)/i;

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function isSafeUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (/^(https?:|mailto:)/i.test(trimmed)) return true;
  if (/^[/#]/.test(trimmed)) return true;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return false;
  return true;
}

function sanitizeRichText(input: string): string {
  let out = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  TAG_RE.lastIndex = 0;
  while ((match = TAG_RE.exec(input))) {
    out += escapeText(input.slice(lastIndex, match.index));
    lastIndex = TAG_RE.lastIndex;
    const [full, rawTag, attrs] = match;
    const tag = rawTag.toLowerCase();

    if (!ALLOWED_TAGS.has(tag)) {
      out += escapeText(full);
      continue;
    }
    if (tag === 'br') {
      out += '<br>';
      continue;
    }
    if (full.startsWith('</')) {
      out += `</${tag}>`;
      continue;
    }
    if (tag === 'a') {
      const hrefMatch = HREF_RE.exec(attrs);
      const rawHref = hrefMatch ? (hrefMatch[1] ?? hrefMatch[2] ?? hrefMatch[3] ?? '') : '';
      const href = isSafeUrl(rawHref) ? rawHref.trim() : '#';
      out += `<a href="${escapeAttr(href)}" rel="noopener noreferrer" target="_blank">`;
      continue;
    }
    out += `<${tag}>`;
  }
  out += escapeText(input.slice(lastIndex));
  return out.replace(/\r\n|\r|\n/g, '<br>');
}

// ---- URL fragment state -------------------------------------------------

interface HashState {
  query: string;
  noteId: number | null;
}

function readHash(): HashState {
  const raw = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
  const params = new URLSearchParams(raw);
  const query = params.get('q') ?? '';
  const noteParam = params.get('note');
  const noteId = noteParam !== null && /^\d+$/.test(noteParam) ? Number(noteParam) : null;
  return { query, noteId };
}

function buildHash(query: string, noteId: number | null): string {
  const parts: string[] = [];
  if (query) parts.push(`q=${encodeURIComponent(query)}`);
  if (noteId != null) parts.push(`note=${noteId}`);
  return parts.length ? `#${parts.join('&')}` : '';
}

// ---- app ------------------------------------------------------------

const noteForm = document.querySelector<HTMLFormElement>('#note-form')!;
const titleInput = document.querySelector<HTMLInputElement>('#title')!;
const bodyInput = document.querySelector<HTMLTextAreaElement>('#body')!;
const avatarInput = document.querySelector<HTMLInputElement>('#avatar')!;
const searchInput = document.querySelector<HTMLInputElement>('#search')!;
const resultsLine = document.querySelector<HTMLParagraphElement>('#results-line')!;
const feed = document.querySelector<HTMLElement>('#feed')!;

const state: { notes: Note[]; query: string; selectedId: number | null } = {
  notes: [],
  query: '',
  selectedId: null,
};

function writeHash(): void {
  const hash = buildHash(state.query.trim(), state.selectedId);
  history.replaceState(null, '', `${location.pathname}${location.search}${hash}`);
}

function selectNote(id: number): void {
  state.selectedId = id;
  writeHash();
  render();
}

function render(): void {
  const query = state.query.trim();
  resultsLine.textContent = query ? `results for "${query}"` : '';

  const q = query.toLowerCase();
  const filtered = q
    ? state.notes.filter((n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))
    : state.notes;
  const sorted = [...filtered].sort((a, b) => b.id - a.id);

  feed.innerHTML = '';
  for (const note of sorted) {
    const article = document.createElement('article');
    article.className = 'note';
    article.dataset.noteId = String(note.id);
    if (state.selectedId === note.id) {
      article.setAttribute('aria-current', 'true');
    }

    if (note.avatar) {
      const img = document.createElement('img');
      img.className = 'note-avatar';
      img.src = note.avatar;
      img.alt = '';
      article.appendChild(img);
    }

    const titleBtn = document.createElement('button');
    titleBtn.type = 'button';
    titleBtn.className = 'note-title';
    titleBtn.innerHTML = sanitizeRichText(note.title);
    titleBtn.addEventListener('click', () => selectNote(note.id));
    article.appendChild(titleBtn);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'note-body';
    bodyEl.innerHTML = sanitizeRichText(note.body);
    article.appendChild(bodyEl);

    feed.appendChild(article);
  }
}

noteForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  const avatar = avatarInput.value.trim();
  if (!title || !body) return;

  const note: Note = {
    id: nextId(state.notes),
    title,
    body,
    avatar,
    createdAt: new Date().toISOString(),
  };
  state.notes.push(note);
  saveNotes(state.notes);
  noteForm.reset();
  render();
});

searchInput.addEventListener('input', () => {
  state.query = searchInput.value;
  writeHash();
  render();
});

window.addEventListener('hashchange', () => {
  const h = readHash();
  state.query = h.query;
  state.selectedId = h.noteId;
  searchInput.value = state.query;
  render();
});

function init(): void {
  state.notes = loadNotes();
  const h = readHash();
  state.query = h.query;
  state.selectedId = h.noteId;
  searchInput.value = state.query;
  render();
}

init();
