import './style.css';
import fixturesData from './fixtures.json';
import { renderRichText, sanitizeAvatarUrl, toPlainText } from './richtext';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto-notes';

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
  const seeded = fixturesData as Note[];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}

function saveNotes(list: Note[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

let notes = loadNotes();

const form = document.querySelector<HTMLFormElement>('#note-form')!;
const titleInput = document.querySelector<HTMLInputElement>('#title')!;
const bodyInput = document.querySelector<HTMLTextAreaElement>('#body')!;
const avatarInput = document.querySelector<HTMLInputElement>('#avatar')!;
const searchInput = document.querySelector<HTMLInputElement>('#search')!;
const resultsLine = document.querySelector<HTMLParagraphElement>('#results-line')!;
const feed = document.querySelector<HTMLElement>('#feed')!;

interface RouteState {
  query: string;
  noteId: number | null;
}

function parseHash(): RouteState {
  const hash = location.hash.replace(/^#/, '');
  const params = new URLSearchParams(hash);
  const query = params.get('q') ?? '';
  const noteParam = params.get('note');
  const noteId = noteParam !== null && /^\d+$/.test(noteParam) ? Number(noteParam) : null;
  return { query, noteId };
}

function writeHash(next: RouteState): void {
  const parts: string[] = [];
  if (next.query) parts.push(`q=${encodeURIComponent(next.query)}`);
  if (next.noteId !== null) parts.push(`note=${next.noteId}`);
  const newHash = parts.length ? `#${parts.join('&')}` : '';
  history.replaceState(null, '', `${location.pathname}${location.search}${newHash}`);
}

let state: RouteState = parseHash();
searchInput.value = state.query;

function matchesQuery(note: Note, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return note.title.toLowerCase().includes(q) || toPlainText(note.body).toLowerCase().includes(q);
}

function render(): void {
  resultsLine.textContent = state.query ? `results for "${state.query}"` : '';

  const visible = notes
    .filter((note) => matchesQuery(note, state.query))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.id - a.id);

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
    if (state.noteId === note.id) {
      article.setAttribute('aria-current', 'true');
    }

    const safeAvatar = sanitizeAvatarUrl(note.avatar);
    if (safeAvatar) {
      const img = document.createElement('img');
      img.className = 'note-avatar';
      img.src = safeAvatar;
      img.alt = '';
      article.appendChild(img);
    }

    const titleButton = document.createElement('button');
    titleButton.type = 'button';
    titleButton.className = 'note-title';
    titleButton.textContent = note.title;
    article.appendChild(titleButton);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'note-body';
    bodyEl.appendChild(renderRichText(note.body));
    article.appendChild(bodyEl);

    feed.appendChild(article);
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value;
  if (!title || !body.trim()) return;

  const nextId = notes.reduce((max, note) => Math.max(max, note.id), 0) + 1;
  const note: Note = {
    id: nextId,
    title,
    body,
    avatar: avatarInput.value.trim(),
    createdAt: new Date().toISOString(),
  };
  notes = [...notes, note];
  saveNotes(notes);
  form.reset();
  render();
});

searchInput.addEventListener('input', () => {
  state = { ...state, query: searchInput.value };
  writeHash(state);
  render();
});

feed.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const titleButton = target.closest('.note-title');
  if (!titleButton) return;
  const article = titleButton.closest<HTMLElement>('.note');
  if (!article) return;
  const id = Number(article.dataset.noteId);
  state = { ...state, noteId: id };
  writeHash(state);
  render();
});

window.addEventListener('hashchange', () => {
  state = parseHash();
  searchInput.value = state.query;
  render();
});

render();
