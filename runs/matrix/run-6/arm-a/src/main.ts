import fixtures from './fixtures.json';
import './style.css';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto-notes';

const ALLOWED_INLINE_TAGS = new Set(['b', 'strong', 'i', 'em']);

function isSafeLinkUrl(href: string): boolean {
  try {
    const url = new URL(href, window.location.href);
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:';
  } catch {
    return false;
  }
}

function isSafeImageUrl(src: string): boolean {
  try {
    const url = new URL(src, window.location.href);
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'data:';
  } catch {
    return false;
  }
}

function appendTextWithBreaks(text: string, target: Node): void {
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    if (line) target.appendChild(document.createTextNode(line));
    if (index < lines.length - 1) target.appendChild(document.createElement('br'));
  });
}

function appendSanitized(source: Node, target: Node): void {
  for (const node of Array.from(source.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      appendTextWithBreaks(node.textContent ?? '', target);
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;

    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    if (tag === 'br') {
      target.appendChild(document.createElement('br'));
      continue;
    }

    if (ALLOWED_INLINE_TAGS.has(tag)) {
      const clone = document.createElement(tag);
      appendSanitized(el, clone);
      target.appendChild(clone);
      continue;
    }

    if (tag === 'a') {
      const href = el.getAttribute('href') ?? '';
      const a = document.createElement('a');
      if (isSafeLinkUrl(href)) {
        a.setAttribute('href', href);
        a.setAttribute('rel', 'noopener noreferrer');
        a.setAttribute('target', '_blank');
      }
      appendSanitized(el, a);
      target.appendChild(a);
      continue;
    }

    // Any other tag is unwrapped: keep its text/children, drop the tag itself.
    appendSanitized(el, target);
  }
}

function renderRichText(raw: string, target: HTMLElement): void {
  target.textContent = '';
  const doc = new DOMParser().parseFromString(raw, 'text/html');
  appendSanitized(doc.body, target);
}

function plainText(raw: string): string {
  const container = document.createElement('div');
  renderRichText(raw, container);
  return container.textContent ?? '';
}

function loadNotes(): Note[] {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed as Note[];
    } catch {
      // fall through to seed data
    }
  }
  const seeded = (fixtures as Note[]).map((note) => ({ avatar: '', ...note }));
  saveNotes(seeded);
  return seeded;
}

function saveNotes(notes: Note[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function sortNewestFirst(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return diff !== 0 ? diff : b.id - a.id;
  });
}

interface UrlState {
  query: string;
  noteId: number | null;
}

function readUrlState(): UrlState {
  const params = new URLSearchParams(location.hash.slice(1));
  const query = params.get('q') ?? '';
  const noteIdRaw = params.get('note');
  const noteId = noteIdRaw !== null && /^-?\d+$/.test(noteIdRaw) ? Number(noteIdRaw) : null;
  return { query, noteId };
}

function writeUrlState(state: UrlState): void {
  const params = new URLSearchParams();
  if (state.query) params.set('q', state.query);
  if (state.noteId !== null) params.set('note', String(state.noteId));
  const hash = params.toString();
  const url = location.pathname + location.search + (hash ? `#${hash}` : '');
  history.replaceState(null, '', url);
}

let notes = loadNotes();
const state: UrlState = readUrlState();

const form = document.querySelector<HTMLFormElement>('#note-form')!;
const titleInput = document.querySelector<HTMLInputElement>('#title')!;
const bodyInput = document.querySelector<HTMLTextAreaElement>('#body')!;
const avatarInput = document.querySelector<HTMLInputElement>('#avatar')!;
const searchInput = document.querySelector<HTMLInputElement>('#search')!;
const resultsLine = document.querySelector<HTMLParagraphElement>('#results-line')!;
const feed = document.querySelector<HTMLElement>('#feed')!;

searchInput.value = state.query;

function render(): void {
  resultsLine.textContent = state.query ? `results for "${state.query}"` : '';

  const query = state.query.trim().toLowerCase();
  const visible = query
    ? sortNewestFirst(notes).filter(
        (note) => note.title.toLowerCase().includes(query) || plainText(note.body).toLowerCase().includes(query),
      )
    : sortNewestFirst(notes);

  feed.textContent = '';
  for (const note of visible) {
    const article = document.createElement('article');
    article.className = 'note';
    article.dataset.noteId = String(note.id);
    if (state.noteId === note.id) article.setAttribute('aria-current', 'true');

    if (note.avatar && isSafeImageUrl(note.avatar)) {
      const img = document.createElement('img');
      img.className = 'note-avatar';
      img.src = note.avatar;
      img.alt = `Avatar for ${note.title}`;
      article.appendChild(img);
    }

    const titleButton = document.createElement('button');
    titleButton.type = 'button';
    titleButton.className = 'note-title';
    titleButton.textContent = note.title;
    titleButton.addEventListener('click', () => {
      state.noteId = note.id;
      writeUrlState(state);
      render();
    });
    article.appendChild(titleButton);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'note-body';
    renderRichText(note.body, bodyEl);
    article.appendChild(bodyEl);

    feed.appendChild(article);
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  if (!title || !body) return;

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
  state.query = searchInput.value;
  writeUrlState(state);
  render();
});

window.addEventListener('hashchange', () => {
  const next = readUrlState();
  state.query = next.query;
  state.noteId = next.noteId;
  searchInput.value = state.query;
  render();
});

render();
