import fixturesData from './fixtures.json';
import './style.css';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

const fixtures = fixturesData as Note[];
const STORAGE_KEY = 'porto-notes:v1';

// ---- persistence ----------------------------------------------------

function loadNotes(): Note[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw !== null) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as Note[];
    } catch {
      // corrupt storage, fall through to reseed
    }
  }
  const seeded = [...fixtures];
  saveNotes(seeded);
  return seeded;
}

function saveNotes(list: Note[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function nextId(list: Note[]): number {
  return list.reduce((max, n) => Math.max(max, n.id), 0) + 1;
}

// ---- rich text rendering ---------------------------------------------
// Users type <b>/<strong>/<i>/<em>/<a href="…"> and <br> (or a plain newline)
// into the body textarea. We parse that as inert HTML and rebuild only the
// allow-listed tags/attributes, so nothing else (scripts, event handlers,
// unknown tags) survives into the live DOM.

const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'A', 'BR']);
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

function isSafeHref(href: string): boolean {
  try {
    const url = new URL(href, window.location.href);
    return SAFE_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}

function appendTextWithLineBreaks(text: string, target: Node): void {
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    if (line.length > 0) target.appendChild(document.createTextNode(line));
    if (index < lines.length - 1) target.appendChild(document.createElement('br'));
  });
}

function appendSanitizedNode(node: ChildNode, target: Node): void {
  if (node.nodeType === Node.TEXT_NODE) {
    appendTextWithLineBreaks(node.textContent ?? '', target);
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const el = node as Element;
  if (!ALLOWED_TAGS.has(el.tagName)) {
    el.childNodes.forEach((child) => appendSanitizedNode(child, target));
    return;
  }
  if (el.tagName === 'BR') {
    target.appendChild(document.createElement('br'));
    return;
  }

  const clean = document.createElement(el.tagName.toLowerCase());
  if (el.tagName === 'A') {
    const href = el.getAttribute('href') ?? '';
    if (isSafeHref(href)) {
      clean.setAttribute('href', href);
      clean.setAttribute('rel', 'noopener noreferrer');
      clean.setAttribute('target', '_blank');
    }
  }
  target.appendChild(clean);
  el.childNodes.forEach((child) => appendSanitizedNode(child, clean));
}

function renderRichText(raw: string): DocumentFragment {
  const doc = new DOMParser().parseFromString(raw, 'text/html');
  const output = document.createDocumentFragment();
  doc.body.childNodes.forEach((child) => appendSanitizedNode(child, output));
  return output;
}

function plainText(raw: string): string {
  return renderRichText(raw).textContent ?? '';
}

// ---- URL fragment (deep links) ----------------------------------------

function parseHash(): { q: string; note: number | null } {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  const q = params.get('q') ?? '';
  const noteParam = params.get('note');
  const note = noteParam !== null && noteParam !== '' && !Number.isNaN(Number(noteParam)) ? Number(noteParam) : null;
  return { q, note };
}

function syncHash(): void {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (selectedId !== null) params.set('note', String(selectedId));
  const hash = params.toString();
  const url = `${location.pathname}${location.search}${hash ? `#${hash}` : ''}`;
  history.replaceState(null, '', url);
}

// ---- state & DOM refs ---------------------------------------------------

let notes: Note[] = loadNotes();
let query = '';
let selectedId: number | null = null;

const feedEl = document.querySelector<HTMLElement>('#feed')!;
const formEl = document.querySelector<HTMLFormElement>('#note-form')!;
const titleInput = document.querySelector<HTMLInputElement>('#title')!;
const bodyInput = document.querySelector<HTMLTextAreaElement>('#body')!;
const avatarInput = document.querySelector<HTMLInputElement>('#avatar')!;
const searchInput = document.querySelector<HTMLInputElement>('#search')!;
const resultsLine = document.querySelector<HTMLElement>('#results-line')!;

// ---- rendering ------------------------------------------------------

function sortedNotes(): Note[] {
  return [...notes].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.id - a.id
  );
}

function matchesQuery(note: Note, needle: string): boolean {
  if (note.title.toLowerCase().includes(needle)) return true;
  return plainText(note.body).toLowerCase().includes(needle);
}

function buildNoteEl(note: Note): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.dataset.noteId = String(note.id);
  article.setAttribute('aria-current', selectedId === note.id ? 'true' : 'false');

  if (note.avatar) {
    const img = document.createElement('img');
    img.className = 'note-avatar';
    img.src = note.avatar;
    img.alt = '';
    article.appendChild(img);
  }

  const content = document.createElement('div');
  content.className = 'note-content';

  const titleBtn = document.createElement('button');
  titleBtn.type = 'button';
  titleBtn.className = 'note-title';
  titleBtn.textContent = note.title;
  titleBtn.addEventListener('click', () => selectNote(note.id));
  content.appendChild(titleBtn);

  const bodyEl = document.createElement('p');
  bodyEl.className = 'note-body';
  bodyEl.appendChild(renderRichText(note.body));
  content.appendChild(bodyEl);

  article.appendChild(content);
  return article;
}

function renderResultsLine(): void {
  resultsLine.textContent = query ? `results for "${query}"` : '';
}

function renderFeed(): void {
  feedEl.innerHTML = '';
  const needle = query.toLowerCase();
  const visible = needle ? sortedNotes().filter((n) => matchesQuery(n, needle)) : sortedNotes();

  if (visible.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No notes found.';
    feedEl.appendChild(empty);
    return;
  }

  for (const note of visible) {
    feedEl.appendChild(buildNoteEl(note));
  }
}

function render(): void {
  renderResultsLine();
  renderFeed();
}

function selectNote(id: number): void {
  selectedId = id;
  syncHash();
  render();
}

// ---- events -----------------------------------------------------------

formEl.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value;
  const avatar = avatarInput.value.trim();
  if (!title || !body.trim()) return;

  const note: Note = {
    id: nextId(notes),
    title,
    body,
    avatar,
    createdAt: new Date().toISOString(),
  };
  notes = [...notes, note];
  saveNotes(notes);
  formEl.reset();
  render();
});

searchInput.addEventListener('input', () => {
  query = searchInput.value;
  syncHash();
  render();
});

window.addEventListener('hashchange', () => {
  const { q, note } = parseHash();
  query = q;
  selectedId = note;
  searchInput.value = query;
  render();
});

// ---- init ---------------------------------------------------------------

function init(): void {
  const { q, note } = parseHash();
  query = q;
  selectedId = note;
  searchInput.value = query;
  render();
}

init();
