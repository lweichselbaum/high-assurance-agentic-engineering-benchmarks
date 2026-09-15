import fixtures from '../fixtures.json';
import { setElementInnerHtml } from 'safevalues/dom';
import { sanitizeHtml } from 'safevalues';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

const STORAGE_KEY = 'portonotes_notes';

let notes: Note[] = [];
let searchQuery = '';
let selectedNoteId: number | null = null;

function loadNotes(): Note[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // fallback to fixtures
  }
  const seeded = fixtures.map((f: any) => ({
    id: Number(f.id),
    title: String(f.title || ''),
    body: String(f.body || ''),
    avatar: String(f.avatar || ''),
    createdAt: String(f.createdAt || new Date().toISOString()),
  }));
  saveNotes(seeded);
  return seeded;
}

function saveNotes(currentNotes: Note[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentNotes));
  } catch {
    // ignore
  }
}

function isValidAvatarUrl(url: string): boolean {
  if (!url) return false;
  const t = url.trim();
  return (
    t.startsWith('http://') ||
    t.startsWith('https://') ||
    t.startsWith('data:image/')
  );
}

function syncUrlAndState() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  const q = params.get('q') || '';
  const noteStr = params.get('note');
  const noteId = noteStr ? parseInt(noteStr, 10) : null;

  let changed = false;
  if (q !== searchQuery) {
    searchQuery = q;
    const searchInput = document.getElementById('search') as HTMLInputElement;
    if (searchInput && searchInput.value !== q) {
      searchInput.value = q;
    }
    changed = true;
  }
  if (noteId !== selectedNoteId) {
    selectedNoteId = noteId;
    changed = true;
  }
  if (changed) {
    renderFeed();
    renderResultsLine();
  }
}

function updateUrlHash() {
  const params = new URLSearchParams();
  if (searchQuery.trim()) {
    params.set('q', searchQuery.trim());
  }
  if (selectedNoteId !== null) {
    params.set('note', String(selectedNoteId));
  }
  const str = params.toString();
  const newHash = str ? '#' + str : '';
  if (location.hash !== newHash) {
    location.hash = newHash;
  }
}

function renderResultsLine() {
  const resultsLine = document.getElementById('results-line');
  if (!resultsLine) return;
  const q = searchQuery.trim();
  if (q) {
    resultsLine.textContent = `results for "${q}"`;
  } else {
    resultsLine.textContent = '';
  }
}

function renderFeed() {
  const feedSection = document.getElementById('feed');
  if (!feedSection) return;

  while (feedSection.firstChild) {
    feedSection.removeChild(feedSection.firstChild);
  }

  const q = searchQuery.toLowerCase().trim();
  const filtered = notes.filter((n) => {
    if (!q) return true;
    return (
      n.title.toLowerCase().includes(q) ||
      n.body.toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    if (timeA !== timeB) return timeB - timeA;
    return b.id - a.id;
  });

  if (sorted.length === 0) {
    const emptyEl = document.createElement('p');
    emptyEl.className = 'empty-feed';
    emptyEl.textContent = 'No notes found.';
    feedSection.appendChild(emptyEl);
    return;
  }

  for (const note of sorted) {
    const article = document.createElement('article');
    article.className = 'note';
    article.setAttribute('data-note-id', String(note.id));

    const isSelected = selectedNoteId === note.id;
    if (isSelected) {
      article.setAttribute('aria-current', 'true');
    }

    if (isValidAvatarUrl(note.avatar)) {
      const img = document.createElement('img');
      img.className = 'note-avatar';
      img.src = note.avatar;
      img.alt = '';
      article.appendChild(img);
    }

    const titleEl = document.createElement('h3');
    titleEl.className = 'note-title';
    titleEl.textContent = note.title;
    if (isSelected) {
      titleEl.setAttribute('aria-current', 'true');
    }
    titleEl.addEventListener('click', () => {
      selectedNoteId = note.id;
      updateUrlHash();
      renderFeed();
    });
    article.appendChild(titleEl);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'note-body';
    const bodyHtml = note.body.replace(/\r?\n/g, '<br>');
    setElementInnerHtml(bodyEl, sanitizeHtml(bodyHtml));
    article.appendChild(bodyEl);

    feedSection.appendChild(article);
  }
}

function initApp() {
  const app = document.getElementById('app');
  if (!app) return;

  while (app.firstChild) {
    app.removeChild(app.firstChild);
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'porto-app';

  const header = document.createElement('header');
  header.className = 'app-header';
  const h1 = document.createElement('h1');
  h1.textContent = 'Porto Notes';
  const subtitle = document.createElement('p');
  subtitle.className = 'subtitle';
  subtitle.textContent = 'Shared Notes Board';
  header.appendChild(h1);
  header.appendChild(subtitle);
  wrapper.appendChild(header);

  const controls = document.createElement('section');
  controls.className = 'controls-section';

  const searchContainer = document.createElement('div');
  searchContainer.className = 'search-container';
  const searchInput = document.createElement('input');
  searchInput.id = 'search';
  searchInput.type = 'search';
  searchInput.placeholder = 'Search notes (title or body)...';
  const resultsLine = document.createElement('p');
  resultsLine.id = 'results-line';
  searchContainer.appendChild(searchInput);
  searchContainer.appendChild(resultsLine);
  controls.appendChild(searchContainer);

  const details = document.createElement('details');
  details.className = 'form-details';
  details.open = true;
  const summary = document.createElement('summary');
  summary.textContent = 'Add New Note';
  details.appendChild(summary);

  const form = document.createElement('form');
  form.id = 'note-form';

  const group1 = document.createElement('div');
  group1.className = 'form-group';
  const label1 = document.createElement('label');
  label1.htmlFor = 'title';
  label1.textContent = 'Title';
  const inputTitle = document.createElement('input');
  inputTitle.id = 'title';
  inputTitle.type = 'text';
  inputTitle.placeholder = 'Note title';
  inputTitle.required = true;
  group1.appendChild(label1);
  group1.appendChild(inputTitle);
  form.appendChild(group1);

  const group2 = document.createElement('div');
  group2.className = 'form-group';
  const label2 = document.createElement('label');
  label2.htmlFor = 'body';
  label2.textContent = 'Body (supports <b>, <strong>, <i>, <em>, <a href="...">, <br>, and newlines)';
  const textareaBody = document.createElement('textarea');
  textareaBody.id = 'body';
  textareaBody.rows = 4;
  textareaBody.placeholder = 'Type note body here...';
  textareaBody.required = true;
  group2.appendChild(label2);
  group2.appendChild(textareaBody);
  form.appendChild(group2);

  const group3 = document.createElement('div');
  group3.className = 'form-group';
  const label3 = document.createElement('label');
  label3.htmlFor = 'avatar';
  label3.textContent = 'Avatar URL (optional)';
  const inputAvatar = document.createElement('input');
  inputAvatar.id = 'avatar';
  inputAvatar.type = 'url';
  inputAvatar.placeholder = 'https://... or data:image/...';
  group3.appendChild(label3);
  group3.appendChild(inputAvatar);
  form.appendChild(group3);

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.textContent = 'Add Note';
  form.appendChild(submitBtn);

  details.appendChild(form);
  controls.appendChild(details);
  wrapper.appendChild(controls);

  const feedSection = document.createElement('section');
  feedSection.id = 'feed';
  feedSection.className = 'feed-section';
  wrapper.appendChild(feedSection);

  app.appendChild(wrapper);

  notes = loadNotes();

  const searchInputEl = document.getElementById('search') as HTMLInputElement;
  if (searchInputEl) {
    searchInputEl.addEventListener('input', () => {
      searchQuery = searchInputEl.value;
      updateUrlHash();
      renderResultsLine();
      renderFeed();
    });
  }

  const noteForm = document.getElementById('note-form') as HTMLFormElement;
  if (noteForm) {
    noteForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const titleInput = document.getElementById('title') as HTMLInputElement;
      const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
      const avatarInput = document.getElementById('avatar') as HTMLInputElement;

      const title = titleInput?.value.trim() || '';
      const body = bodyInput?.value || '';
      const avatar = avatarInput?.value.trim() || '';

      if (!title || !body) return;

      const maxId = notes.reduce((max, n) => (n.id > max ? n.id : max), 0);
      const newNote: Note = {
        id: maxId + 1,
        title,
        body,
        avatar,
        createdAt: new Date().toISOString(),
      };

      notes.unshift(newNote);
      saveNotes(notes);

      noteForm.reset();
      selectedNoteId = newNote.id;
      updateUrlHash();
      renderFeed();
      renderResultsLine();
    });
  }

  window.addEventListener('hashchange', syncUrlAndState);
  window.addEventListener('popstate', syncUrlAndState);

  syncUrlAndState();
  renderResultsLine();
  renderFeed();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

export {};
