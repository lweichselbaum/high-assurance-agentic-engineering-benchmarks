import fixturesData from './fixtures.json';
import './style.css';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto-notes';

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as Note[];
    }
  } catch {
    // corrupt storage, fall through to reseed
  }
  const seeded = fixturesData as Note[];
  saveNotes(seeded);
  return seeded;
}

function saveNotes(notes: Note[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

const state: { notes: Note[]; query: string; selectedId: number | null } = {
  notes: loadNotes(),
  query: '',
  selectedId: null,
};

// --- URL fragment (deep link) helpers ---------------------------------

function parseHash(): { q: string; note: number | null } {
  const raw = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
  const params = new URLSearchParams(raw);
  const q = params.get('q') ?? '';
  const noteRaw = params.get('note');
  const noteId = noteRaw !== null ? Number(noteRaw) : NaN;
  return { q, note: Number.isFinite(noteId) ? noteId : null };
}

function syncHash(): void {
  const params = new URLSearchParams();
  const q = state.query.trim();
  if (q) params.set('q', q);
  if (state.selectedId !== null) params.set('note', String(state.selectedId));
  const str = params.toString();
  const newHash = str ? `#${str}` : '';
  history.replaceState(null, '', newHash || location.pathname + location.search);
}

// --- URL safety for user-supplied links/avatars ------------------------

function isSafeLinkUrl(url: string): boolean {
  const trimmed = url.trim();
  if (/^(https?:|mailto:)/i.test(trimmed)) return true;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return false;
  return true;
}

function isSafeImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (/^(https?:|data:image\/)/i.test(trimmed)) return true;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return false;
  return true;
}

// --- Rich text rendering -------------------------------------------------
// Body text is plain text typed by the user that may contain a small allow-list
// of inline tags (<b> <strong> <i> <em> <a href="..."> <br>) plus real newlines.
// We tokenize and build DOM nodes directly (never via innerHTML) so anything
// outside the allow-list is rendered as inert text, not parsed as markup.

const RICH_TEXT_TOKEN = /<(b|strong|i|em)>|<\/(b|strong|i|em)>|<br\s*\/?>|<a\s+href="([^"]*)"\s*>|<\/a>|\n/gi;

function renderRichText(container: HTMLElement, text: string): void {
  container.textContent = '';
  const stack: HTMLElement[] = [container];
  const top = () => stack[stack.length - 1];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  RICH_TEXT_TOKEN.lastIndex = 0;
  while ((match = RICH_TEXT_TOKEN.exec(text))) {
    if (match.index > lastIndex) {
      top().appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    }
    const [full, openTag, closeTag, href] = match;
    if (openTag) {
      const el = document.createElement(openTag);
      top().appendChild(el);
      stack.push(el);
    } else if (closeTag) {
      if (stack.length > 1 && top().tagName.toLowerCase() === closeTag) stack.pop();
    } else if (href !== undefined) {
      const a = document.createElement('a');
      a.setAttribute('href', isSafeLinkUrl(href) ? href : '#');
      a.setAttribute('rel', 'noopener noreferrer');
      a.setAttribute('target', '_blank');
      top().appendChild(a);
      stack.push(a);
    } else if (full === '</a>') {
      if (stack.length > 1 && top().tagName.toLowerCase() === 'a') stack.pop();
    } else {
      // real newline or <br>/<br />
      top().appendChild(document.createElement('br'));
    }
    lastIndex = RICH_TEXT_TOKEN.lastIndex;
  }
  if (lastIndex < text.length) {
    top().appendChild(document.createTextNode(text.slice(lastIndex)));
  }
}

// --- Search ---------------------------------------------------------------

function matchesQuery(note: Note, query: string): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  const titleText = note.title.toLowerCase();
  const bodyText = note.body.replace(/<[^>]*>/g, ' ').toLowerCase();
  return titleText.includes(needle) || bodyText.includes(needle);
}

// --- Rendering --------------------------------------------------------------

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function createNoteElement(note: Note, selectedId: number | null): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.dataset.noteId = String(note.id);
  if (note.id === selectedId) article.setAttribute('aria-current', 'true');

  const header = document.createElement('div');
  header.className = 'note-header';

  if (note.avatar) {
    const img = document.createElement('img');
    img.className = 'note-avatar';
    img.src = isSafeImageUrl(note.avatar) ? note.avatar : '';
    img.alt = '';
    header.appendChild(img);
  }

  const heading = document.createElement('h3');
  heading.className = 'note-heading';
  const titleBtn = document.createElement('button');
  titleBtn.type = 'button';
  titleBtn.className = 'note-title';
  titleBtn.textContent = note.title;
  titleBtn.addEventListener('click', () => selectNote(note.id));
  heading.appendChild(titleBtn);
  header.appendChild(heading);

  article.appendChild(header);

  const body = document.createElement('div');
  body.className = 'note-body';
  renderRichText(body, note.body);
  article.appendChild(body);

  const time = document.createElement('time');
  time.className = 'note-time';
  time.dateTime = note.createdAt;
  time.textContent = formatDate(note.createdAt);
  article.appendChild(time);

  return article;
}

function renderResultsLine(): void {
  const el = document.getElementById('results-line')!;
  const q = state.query.trim();
  el.textContent = q ? `results for "${q}"` : '';
}

function renderFeed(): void {
  const feed = document.getElementById('feed')!;
  feed.textContent = '';
  const query = state.query.trim();
  const visible = state.notes
    .filter((n) => matchesQuery(n, query))
    .sort((a, b) => {
      const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return diff !== 0 ? diff : b.id - a.id;
    });

  if (visible.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No notes match your search.';
    feed.appendChild(empty);
    return;
  }

  for (const note of visible) {
    feed.appendChild(createNoteElement(note, state.selectedId));
  }
}

function render(): void {
  renderResultsLine();
  renderFeed();
}

// --- State mutations --------------------------------------------------------

function addNote(title: string, body: string, avatar: string): void {
  const nextId = state.notes.reduce((max, n) => Math.max(max, n.id), 0) + 1;
  state.notes.push({ id: nextId, title, body, avatar, createdAt: new Date().toISOString() });
  saveNotes(state.notes);
  render();
}

function selectNote(id: number): void {
  state.selectedId = id;
  syncHash();
  render();
}

// --- Wiring -------------------------------------------------------------

function init(): void {
  const { q, note } = parseHash();
  state.query = q;
  state.selectedId = note;

  const form = document.getElementById('note-form') as HTMLFormElement;
  const titleInput = document.getElementById('title') as HTMLInputElement;
  const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
  const avatarInput = document.getElementById('avatar') as HTMLInputElement;
  const searchInput = document.getElementById('search') as HTMLInputElement;

  searchInput.value = state.query;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    const body = bodyInput.value;
    const avatar = avatarInput.value.trim();
    if (!title || !body.trim()) return;
    addNote(title, body, avatar);
    form.reset();
    titleInput.focus();
  });

  searchInput.addEventListener('input', () => {
    state.query = searchInput.value;
    syncHash();
    render();
  });

  window.addEventListener('hashchange', () => {
    const parsed = parseHash();
    state.query = parsed.q;
    state.selectedId = parsed.note;
    searchInput.value = state.query;
    render();
  });

  render();
}

init();
