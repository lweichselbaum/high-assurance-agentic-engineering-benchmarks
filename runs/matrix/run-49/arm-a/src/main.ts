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
  if (raw !== null) {
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

function saveNotes(notesToSave: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notesToSave));
  } catch {
    // Storage full or restricted
  }
}

function nextId(existingNotes: Note[]): number {
  return existingNotes.reduce((max, n) => Math.max(max, n.id), 0) + 1;
}

// ---- safe rich text & url handling --------------------------------------

function isSafeLinkUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  // Strip whitespace and ASCII control characters
  const clean = trimmed.replace(/[\u0000-\u001F\u007F-\u009F\s]/g, '');
  if (/^(?:javascript|data|vbscript|file|blob):/i.test(clean)) {
    return false;
  }
  if (/^https?:\/\//i.test(clean)) return true;
  if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+/i.test(clean)) return true;
  if (clean.startsWith('/') || clean.startsWith('#')) return true;
  return false;
}

function isSafeAvatarUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (/["'<>\s]/.test(trimmed)) return false;
  const clean = trimmed.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
  if (
    /^(?:javascript|data|vbscript|file|blob):/i.test(clean) &&
    !/^data:image\/(?:png|jpeg|jpg|gif|webp|svg\+xml)[;,]/i.test(clean)
  ) {
    return false;
  }
  if (/^https?:\/\//i.test(clean)) return true;
  if (/^data:image\/(?:png|jpeg|jpg|gif|webp|svg\+xml)[;,]/i.test(clean)) return true;
  return false;
}

function appendSanitizedNodes(sourceNode: Node, target: Node, allowLinks: boolean): void {
  for (const child of Array.from(sourceNode.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      target.appendChild(document.createTextNode(child.textContent ?? ''));
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (tag === 'b' || tag === 'strong') {
        const safeEl = document.createElement(tag);
        appendSanitizedNodes(el, safeEl, allowLinks);
        target.appendChild(safeEl);
      } else if (tag === 'i' || tag === 'em') {
        const safeEl = document.createElement(tag);
        appendSanitizedNodes(el, safeEl, allowLinks);
        target.appendChild(safeEl);
      } else if (tag === 'br') {
        target.appendChild(document.createElement('br'));
      } else if (tag === 'a' && allowLinks) {
        const href = el.getAttribute('href') ?? '';
        if (isSafeLinkUrl(href)) {
          const safeA = document.createElement('a');
          safeA.href = href.trim();
          safeA.target = '_blank';
          safeA.rel = 'noopener noreferrer';
          appendSanitizedNodes(el, safeA, allowLinks);
          target.appendChild(safeA);
        } else {
          // Unsafe link: strip <a> element and keep sanitized children
          appendSanitizedNodes(el, target, allowLinks);
        }
      } else if (
        tag === 'script' ||
        tag === 'style' ||
        tag === 'iframe' ||
        tag === 'object' ||
        tag === 'embed'
      ) {
        // Discard dangerous elements and their children entirely
        continue;
      } else {
        // Any other element: unwrap and process its children
        appendSanitizedNodes(el, target, allowLinks);
      }
    }
  }
}

function renderRichTextInto(target: HTMLElement, raw: string, allowLinks: boolean): void {
  target.replaceChildren();
  const withBreaks = raw.replace(/\r\n/g, '<br>').replace(/[\r\n]/g, '<br>');
  const doc = new DOMParser().parseFromString(withBreaks, 'text/html');
  appendSanitizedNodes(doc.body, target, allowLinks);
}

// ---- URL fragment state --------------------------------------------------

interface HashState {
  query: string;
  noteId: number | null;
}

function parseHash(): HashState {
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (!hash) return { query: '', noteId: null };
  const params = new URLSearchParams(hash);
  const noteParam = params.get('note');
  const noteId = noteParam !== null && /^\d+$/.test(noteParam) ? Number(noteParam) : null;
  return {
    query: params.get('q') ?? '',
    noteId,
  };
}

function updateHash(q: string, noteId: number | null): void {
  const params = new URLSearchParams();
  if (q) {
    params.set('q', q);
  }
  if (noteId !== null) {
    params.set('note', String(noteId));
  }
  const str = params.toString();
  const hash = str ? '#' + str : '';
  const target = hash ? hash : `${window.location.pathname}${window.location.search}`;
  const currentHash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (currentHash !== str) {
    history.replaceState(null, '', target);
  }
}

// ---- app state & initialization ------------------------------------------

function initApp(): void {
  let notes: Note[] = loadNotes();
  const initial = parseHash();
  let searchQuery = initial.query;
  let selectedNoteId: number | null = initial.noteId;

  const form = document.getElementById('note-form') as HTMLFormElement;
  const titleInput = document.getElementById('title') as HTMLInputElement;
  const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
  const avatarInput = document.getElementById('avatar') as HTMLInputElement;
  const searchInput = document.getElementById('search') as HTMLInputElement;
  const resultsLine = document.getElementById('results-line') as HTMLParagraphElement;
  const feed = document.getElementById('feed') as HTMLElement;

  function matchesQuery(note: Note, q: string): boolean {
    if (!q) return true;
    const needle = q.toLowerCase();
    return note.title.toLowerCase().includes(needle) || note.body.toLowerCase().includes(needle);
  }

  function updateSelection(): void {
    const articles = feed.querySelectorAll<HTMLElement>('article.note');
    for (const article of articles) {
      const noteId = Number(article.dataset.noteId);
      if (selectedNoteId !== null && noteId === selectedNoteId) {
        article.setAttribute('aria-current', 'true');
      } else {
        article.removeAttribute('aria-current');
      }
    }
  }

  function selectNote(id: number): void {
    selectedNoteId = id;
    updateHash(searchQuery, selectedNoteId);
    updateSelection();
  }

  function renderFeed(): void {
    resultsLine.textContent = searchQuery ? `results for "${searchQuery}"` : '';

    const visible = searchQuery ? notes.filter((n) => matchesQuery(n, searchQuery)) : notes;
    const sorted = [...visible].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    feed.replaceChildren();

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
      if (selectedNoteId !== null && note.id === selectedNoteId) {
        article.setAttribute('aria-current', 'true');
      }

      if (note.avatar && isSafeAvatarUrl(note.avatar)) {
        const img = document.createElement('img');
        img.className = 'note-avatar';
        img.src = note.avatar.trim();
        img.alt = '';
        article.appendChild(img);
      }

      const heading = document.createElement('h2');
      const titleBtn = document.createElement('button');
      titleBtn.type = 'button';
      titleBtn.className = 'note-title';
      renderRichTextInto(titleBtn, note.title, false);
      titleBtn.addEventListener('click', () => selectNote(note.id));
      heading.appendChild(titleBtn);
      article.appendChild(heading);

      const bodyEl = document.createElement('div');
      bodyEl.className = 'note-body';
      renderRichTextInto(bodyEl, note.body, true);
      article.appendChild(bodyEl);

      const time = document.createElement('time');
      time.className = 'note-date';
      time.dateTime = note.createdAt;
      time.textContent = new Date(note.createdAt).toLocaleString();
      article.appendChild(time);

      feed.appendChild(article);
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
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

    notes.unshift(note);
    saveNotes(notes);
    form.reset();
    renderFeed();
  });

  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    updateHash(searchQuery, selectedNoteId);
    renderFeed();
  });

  window.addEventListener('hashchange', () => {
    const state = parseHash();
    searchQuery = state.query;
    selectedNoteId = state.noteId;
    searchInput.value = searchQuery;
    renderFeed();
  });

  window.addEventListener('popstate', () => {
    const state = parseHash();
    searchQuery = state.query;
    selectedNoteId = state.noteId;
    searchInput.value = searchQuery;
    renderFeed();
  });

  searchInput.value = searchQuery;
  renderFeed();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
