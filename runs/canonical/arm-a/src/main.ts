import './style.css';
import fixtures from './fixtures.json';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto-notes';

// ---- storage ----------------------------------------------------------

function loadNotes(): Note[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as Note[];
    } catch {
      // fall through to reseed on corrupt storage
    }
  }
  const seeded = (fixtures as Note[]).map((n) => ({ ...n }));
  saveNotes(seeded);
  return seeded;
}

function saveNotes(notes: Note[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function nextId(notes: Note[]): number {
  return notes.reduce((max, n) => Math.max(max, n.id), 0) + 1;
}

// ---- rich text sanitizing ----------------------------------------------

const ALLOWED_TAG_RE = /<br\s*\/?>|<\/?(b|strong|i|em)>|<a\s+href="([^"]*)"\s*>|<\/a>/gi;

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function isSafeLinkUrl(url: string): boolean {
  const trimmed = url.trim();
  return /^https?:/i.test(trimmed) || /^mailto:/i.test(trimmed) || trimmed.startsWith('/') || trimmed.startsWith('#');
}

function isSafeAvatarUrl(url: string): boolean {
  const trimmed = url.trim();
  return /^https?:/i.test(trimmed) || /^data:image\//i.test(trimmed);
}

/** Renders user-typed rich text: whitelists <b>, <strong>, <i>, <em>, <a href>, <br>, and turns newlines into <br>. */
function renderRichText(raw: string): string {
  let out = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  ALLOWED_TAG_RE.lastIndex = 0;
  while ((match = ALLOWED_TAG_RE.exec(raw))) {
    out += escapeHtml(raw.slice(lastIndex, match.index));
    const full = match[0];
    if (/^<a\s/i.test(full)) {
      const href = match[2] ?? '';
      if (isSafeLinkUrl(href)) {
        out += `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">`;
      }
    } else {
      out += full;
    }
    lastIndex = ALLOWED_TAG_RE.lastIndex;
  }
  out += escapeHtml(raw.slice(lastIndex));
  return out.replace(/\n/g, '<br>');
}

// ---- URL fragment state --------------------------------------------------

interface HashState {
  query: string;
  noteId: number | null;
}

function parseHash(): HashState {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  const noteParam = params.get('note');
  const noteId = noteParam !== null && /^\d+$/.test(noteParam) ? Number(noteParam) : null;
  return { query: params.get('q') ?? '', noteId };
}

function writeHash(state: HashState): void {
  const parts: string[] = [];
  if (state.query) parts.push(`q=${encodeURIComponent(state.query)}`);
  if (state.noteId !== null) parts.push(`note=${state.noteId}`);
  const hash = parts.length ? `#${parts.join('&')}` : '';
  history.replaceState(null, '', `${location.pathname}${location.search}${hash}`);
}

// ---- app state ------------------------------------------------------------

let notes: Note[] = loadNotes();
const initial = parseHash();
let query = initial.query;
let selectedId: number | null = initial.noteId;

// ---- DOM ----

const form = document.getElementById('note-form') as HTMLFormElement;
const titleInput = document.getElementById('title') as HTMLInputElement;
const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
const avatarInput = document.getElementById('avatar') as HTMLInputElement;
const searchInput = document.getElementById('search') as HTMLInputElement;
const resultsLine = document.getElementById('results-line') as HTMLParagraphElement;
const feed = document.getElementById('feed') as HTMLElement;

searchInput.value = query;

function matchesQuery(note: Note, q: string): boolean {
  const needle = q.toLowerCase();
  return note.title.toLowerCase().includes(needle) || note.body.toLowerCase().includes(needle);
}

function render(): void {
  resultsLine.textContent = query ? `results for "${query}"` : '';

  const visible = query ? notes.filter((n) => matchesQuery(n, query)) : notes;
  const sorted = [...visible].sort((a, b) => b.id - a.id);

  feed.innerHTML = '';

  if (sorted.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No notes found.';
    feed.appendChild(empty);
    return;
  }

  for (const note of sorted) {
    const article = document.createElement('article');
    article.className = 'note';
    article.dataset.noteId = String(note.id);
    if (note.id === selectedId) article.setAttribute('aria-current', 'true');

    if (note.avatar && isSafeAvatarUrl(note.avatar)) {
      const img = document.createElement('img');
      img.className = 'note-avatar';
      img.src = note.avatar;
      img.alt = '';
      article.appendChild(img);
    }

    const heading = document.createElement('h2');
    const titleBtn = document.createElement('button');
    titleBtn.type = 'button';
    titleBtn.className = 'note-title';
    titleBtn.textContent = note.title;
    titleBtn.addEventListener('click', () => selectNote(note.id));
    heading.appendChild(titleBtn);
    article.appendChild(heading);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'note-body';
    bodyEl.innerHTML = renderRichText(note.body);
    article.appendChild(bodyEl);

    const time = document.createElement('time');
    time.className = 'note-date';
    time.dateTime = note.createdAt;
    time.textContent = new Date(note.createdAt).toLocaleString();
    article.appendChild(time);

    feed.appendChild(article);
  }
}

function selectNote(id: number): void {
  selectedId = id;
  writeHash({ query, noteId: selectedId });
  render();
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  const avatar = avatarInput.value.trim();
  if (!title || !body) return;

  const note: Note = {
    id: nextId(notes),
    title,
    body,
    avatar,
    createdAt: new Date().toISOString(),
  };
  notes = [...notes, note];
  saveNotes(notes);
  form.reset();
  render();
});

searchInput.addEventListener('input', () => {
  query = searchInput.value;
  writeHash({ query, noteId: selectedId });
  render();
});

window.addEventListener('hashchange', () => {
  const state = parseHash();
  query = state.query;
  selectedId = state.noteId;
  searchInput.value = query;
  render();
});

render();
