import seedNotes from '../fixtures.json';
import { setElementInnerHtml } from 'safevalues/dom';

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
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // fallback
  }
  const initial: Note[] = (seedNotes as Note[]).map(n => ({ ...n }));
  saveNotes(initial);
  return initial;
}

function saveNotes(notes: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // ignore
  }
}

function parseFragment(): { q: string; noteId: number | null } {
  const hash = location.hash.replace(/^#/, '');
  const params = new URLSearchParams(hash);
  const q = params.get('q') || '';
  const noteStr = params.get('note');
  const noteId = noteStr ? parseInt(noteStr, 10) : null;
  return { q, noteId: isNaN(noteId!) ? null : noteId };
}

function updateFragment(q: string, noteId: number | null): void {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (noteId !== null) params.set('note', String(noteId));
  const hash = params.toString() ? '#' + params.toString() : '#';
  if (location.hash !== hash) {
    history.replaceState(null, '', hash);
  }
}

let notes = loadNotes();
let { q: currentQuery, noteId: selectedNoteId } = parseFragment();

const app = document.getElementById('app');
if (app) {
  app.replaceChildren();

  // Build UI
  const container = document.createElement('div');
  container.className = 'porto-app';

  const h1 = document.createElement('h1');
  h1.textContent = 'Porto Notes';
  container.appendChild(h1);

  // Search box
  const searchInput = document.createElement('input');
  searchInput.id = 'search';
  searchInput.type = 'text';
  searchInput.placeholder = 'Search notes...';
  searchInput.value = currentQuery;
  container.appendChild(searchInput);

  // Results line
  const resultsLine = document.createElement('p');
  resultsLine.id = 'results-line';
  container.appendChild(resultsLine);

  // Note form
  const form = document.createElement('form');
  form.id = 'note-form';

  const titleInput = document.createElement('input');
  titleInput.id = 'title';
  titleInput.type = 'text';
  titleInput.placeholder = 'Title';
  titleInput.required = true;
  form.appendChild(titleInput);

  const bodyTextarea = document.createElement('textarea');
  bodyTextarea.id = 'body';
  bodyTextarea.placeholder = 'Body (supports <b>, <i>, <a>, <br>)';
  bodyTextarea.required = true;
  form.appendChild(bodyTextarea);

  const avatarInput = document.createElement('input');
  avatarInput.id = 'avatar';
  avatarInput.type = 'text';
  avatarInput.placeholder = 'Author avatar URL (optional)';
  form.appendChild(avatarInput);

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.textContent = 'Add Note';
  form.appendChild(submitBtn);

  container.appendChild(form);

  // Feed section
  const feed = document.createElement('section');
  feed.id = 'feed';
  container.appendChild(feed);

  app.appendChild(container);

  function updateResultsLine() {
    if (currentQuery) {
      resultsLine.textContent = `results for "${currentQuery}"`;
    } else {
      resultsLine.textContent = '';
    }
  }

  function isValidAvatarUrl(url: string): boolean {
    return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image/');
  }

  function renderFeed() {
    feed.replaceChildren();
    const filtered = notes.filter(n => {
      if (!currentQuery) return true;
      const q = currentQuery.toLowerCase();
      return n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q);
    });

    // Sort newest first (by createdAt descending, or id descending)
    filtered.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      if (dateA !== dateB) return dateB - dateA;
      return b.id - a.id;
    });

    for (const note of filtered) {
      const article = document.createElement('article');
      article.className = 'note';
      article.setAttribute('data-note-id', String(note.id));

      if (note.id === selectedNoteId) {
        article.setAttribute('aria-current', 'true');
      }

      if (note.avatar && isValidAvatarUrl(note.avatar)) {
        const img = document.createElement('img');
        img.className = 'note-avatar';
        img.src = note.avatar;
        img.alt = '';
        article.appendChild(img);
      }

      const titleEl = document.createElement('h2');
      titleEl.className = 'note-title';
      titleEl.textContent = note.title;
      titleEl.style.cursor = 'pointer';
      titleEl.addEventListener('click', () => {
        selectedNoteId = note.id;
        updateFragment(currentQuery, selectedNoteId);
        renderFeed();
      });
      article.appendChild(titleEl);

      const bodyEl = document.createElement('div');
      bodyEl.className = 'note-body';
      const formattedBody = note.body.replace(/\r?\n/g, '<br>');
      setElementInnerHtml(bodyEl, formattedBody);

      article.appendChild(bodyEl);

      feed.appendChild(article);
    }
  }

  updateResultsLine();
  renderFeed();

  // Event handlers
  searchInput.addEventListener('input', () => {
    currentQuery = searchInput.value;
    updateResultsLine();
    updateFragment(currentQuery, selectedNoteId);
    renderFeed();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    const body = bodyTextarea.value;
    const avatar = avatarInput.value.trim();

    if (!title || !body) return;

    const maxId = notes.reduce((max, n) => Math.max(max, n.id), 0);
    const newNote: Note = {
      id: maxId + 1,
      title,
      body,
      avatar,
      createdAt: new Date().toISOString()
    };

    notes.unshift(newNote);
    saveNotes(notes);

    form.reset();
    renderFeed();
  });

  window.addEventListener('hashchange', () => {
    const parsed = parseFragment();
    currentQuery = parsed.q;
    selectedNoteId = parsed.noteId;
    searchInput.value = currentQuery;
    updateResultsLine();
    renderFeed();
  });
}

export {};

