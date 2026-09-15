// Porto Notes — shared notes board (see CLAUDE.md).
import './style.css';
import rawFixtures from './fixtures.json';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto-notes-v1';
const fixtures = rawFixtures as Note[];

const noteForm = document.getElementById('note-form') as HTMLFormElement;
const titleInput = document.getElementById('title') as HTMLInputElement;
const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
const avatarInput = document.getElementById('avatar') as HTMLInputElement;
const searchInput = document.getElementById('search') as HTMLInputElement;
const resultsLine = document.getElementById('results-line') as HTMLParagraphElement;
const feedEl = document.getElementById('feed') as HTMLElement;

const state: { selectedId: number | null } = { selectedId: null };

// ---- persistence ----

function loadNotes(): Note[] | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Note[]) : null;
  } catch {
    return null;
  }
}

function saveNotes(list: Note[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

const storedNotes = loadNotes();
const notes: Note[] = storedNotes ?? fixtures.map((n) => ({ ...n }));
if (!storedNotes) saveNotes(notes);

function nextId(): number {
  return notes.reduce((max, n) => Math.max(max, n.id), 0) + 1;
}

// ---- rich text: escape everything, then re-enable a small tag allowlist ----

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeHref(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(trimmed)?.[1]?.toLowerCase();
  if (scheme && scheme !== 'http' && scheme !== 'https' && scheme !== 'mailto') return null;
  return trimmed;
}

function sanitizeAvatarSrc(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(trimmed)?.[1]?.toLowerCase();
  if (scheme && scheme !== 'http' && scheme !== 'https' && scheme !== 'data') return null;
  return trimmed;
}

const TAG_RE = /<br\s*\/?>|<\/(b|strong|i|em|a)>|<(b|strong|i|em)>|<a\s+href=("[^"]*"|'[^']*')\s*>/gi;

function renderRichText(input: string): string {
  let out = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  TAG_RE.lastIndex = 0;
  while ((match = TAG_RE.exec(input))) {
    out += escapeHtml(input.slice(lastIndex, match.index)).replace(/\n/g, '<br>');
    const full = match[0];
    if (/^<br/i.test(full)) {
      out += '<br>';
    } else if (match[1]) {
      out += `</${match[1].toLowerCase()}>`;
    } else if (match[2]) {
      out += `<${match[2].toLowerCase()}>`;
    } else if (match[3]) {
      const raw = match[3].slice(1, -1);
      const safe = sanitizeHref(raw);
      out += safe ? `<a href="${escapeHtml(safe)}" rel="noopener noreferrer">` : '<a>';
    }
    lastIndex = TAG_RE.lastIndex;
  }
  out += escapeHtml(input.slice(lastIndex)).replace(/\n/g, '<br>');
  return out;
}

function plainText(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?(b|strong|i|em)>/gi, '')
    .replace(/<a\s+href=("[^"]*"|'[^']*')\s*>/gi, '')
    .replace(/<\/a>/gi, '');
}

// ---- URL fragment (deep links) ----

function parseHash(): { q: string; note: number | null } {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  const q = params.get('q') ?? '';
  const noteRaw = params.get('note');
  const noteId = noteRaw !== null && Number.isFinite(Number(noteRaw)) ? Number(noteRaw) : null;
  return { q, note: noteId };
}

function syncHash(): void {
  const query = searchInput.value.trim();
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (state.selectedId !== null) params.set('note', String(state.selectedId));
  const str = params.toString();
  const url = location.pathname + location.search + (str ? `#${str}` : '');
  history.replaceState(null, '', url);
}

// ---- rendering ----

function buildNoteEl(note: Note): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.dataset.noteId = String(note.id);
  if (state.selectedId === note.id) {
    article.setAttribute('aria-current', 'true');
  }

  const header = document.createElement('div');
  header.className = 'note-header';

  const avatarUrl = note.avatar && note.avatar.trim() ? sanitizeAvatarSrc(note.avatar) : null;
  if (avatarUrl) {
    const img = document.createElement('img');
    img.className = 'note-avatar';
    img.src = avatarUrl;
    img.alt = '';
    header.appendChild(img);
  }

  const titleBtn = document.createElement('button');
  titleBtn.type = 'button';
  titleBtn.className = 'note-title';
  titleBtn.innerHTML = renderRichText(note.title);
  titleBtn.setAttribute('aria-label', `Select note: ${plainText(note.title)}`);
  header.appendChild(titleBtn);

  article.appendChild(header);

  const body = document.createElement('div');
  body.className = 'note-body';
  body.innerHTML = renderRichText(note.body);
  article.appendChild(body);

  return article;
}

function renderAll(): void {
  const query = searchInput.value.trim();
  const queryLower = query.toLowerCase();
  resultsLine.textContent = query ? `results for "${query}"` : '';

  const filtered = notes
    .filter(
      (n) =>
        !queryLower ||
        plainText(n.title).toLowerCase().includes(queryLower) ||
        plainText(n.body).toLowerCase().includes(queryLower),
    )
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : b.id - a.id));

  feedEl.innerHTML = '';
  if (filtered.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'feed-empty';
    empty.textContent = query ? 'No notes match your search.' : 'No notes yet.';
    feedEl.appendChild(empty);
    return;
  }
  for (const note of filtered) {
    feedEl.appendChild(buildNoteEl(note));
  }
}

function selectNote(id: number): void {
  state.selectedId = id;
  syncHash();
  renderAll();
}

// ---- wiring ----

noteForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  const avatar = avatarInput.value.trim();
  if (!title || !body) return;

  notes.push({
    id: nextId(),
    title,
    body,
    avatar,
    createdAt: new Date().toISOString(),
  });
  saveNotes(notes);
  noteForm.reset();
  renderAll();
});

searchInput.addEventListener('input', () => {
  syncHash();
  renderAll();
});

feedEl.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>('.note-title');
  if (!btn) return;
  const article = btn.closest<HTMLElement>('.note');
  if (!article) return;
  const id = Number(article.dataset.noteId);
  if (!Number.isNaN(id)) selectNote(id);
});

window.addEventListener('hashchange', () => {
  const parsed = parseHash();
  state.selectedId = parsed.note;
  searchInput.value = parsed.q;
  renderAll();
});

// ---- init ----

const initial = parseHash();
state.selectedId = initial.note;
searchInput.value = initial.q;
renderAll();
