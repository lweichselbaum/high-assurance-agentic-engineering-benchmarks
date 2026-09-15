import DOMPurify from 'dompurify';
import { sanitizeHtml } from 'safevalues';
import { setElementInnerHtml } from 'safevalues/dom';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto-notes';
const FIXTURE_IDS_KEY = 'porto-notes-fixture-ids';

let notes: Note[] = [];
let nextId = 1;
let selectedNoteId: number | null = null;
let searchQuery = '';

async function loadFixtures(): Promise<Note[]> {
  try {
    const response = await fetch('/fixtures.json');
    if (!response.ok) throw new Error('Failed to load fixtures');
    return await response.json();
  } catch (e) {
    console.error('Could not load fixtures:', e);
    return [];
  }
}

async function initializeNotes(): Promise<void> {
  const stored = localStorage.getItem(STORAGE_KEY);
  const fixtureIds = localStorage.getItem(FIXTURE_IDS_KEY);

  if (stored) {
    notes = JSON.parse(stored);
    nextId = Math.max(...notes.map(n => n.id), 0) + 1;
  } else {
    // First load: seed with fixtures (newest-first)
    const fixtures = await loadFixtures();
    if (fixtures.length > 0) {
      notes = fixtures.reverse();
      nextId = Math.max(...notes.map(n => n.id), 0) + 1;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
      localStorage.setItem(FIXTURE_IDS_KEY, 'true');
    }
  }
}

function saveNotes(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function validateAvatarUrl(url: string): boolean {
  if (!url) return true; // empty is ok
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:' || url.startsWith('data:image/');
  } catch {
    return false;
  }
}

function addNote(title: string, body: string, avatar: string): void {
  if (!title.trim() || !body.trim()) return;
  if (avatar && !validateAvatarUrl(avatar)) return;

  const note: Note = {
    id: nextId++,
    title: title.trim(),
    body: body.trim(),
    avatar: avatar.trim(),
    createdAt: new Date().toISOString(),
  };

  notes.unshift(note);
  saveNotes();
  render();
}

function updateSearch(query: string): void {
  searchQuery = query;
  updateUrl();
  render();
}

function selectNote(id: number): void {
  selectedNoteId = id;
  updateUrl();
  render();
}

function clearSelection(): void {
  selectedNoteId = null;
  updateUrl();
}

function getFilteredNotes(): Note[] {
  if (!searchQuery) return notes;
  const q = searchQuery.toLowerCase();
  return notes.filter(n =>
    n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)
  );
}

function updateUrl(): void {
  let fragment = '';
  if (searchQuery) {
    fragment += `q=${encodeURIComponent(searchQuery)}`;
  }
  if (selectedNoteId !== null) {
    if (fragment) fragment += '&';
    fragment += `note=${selectedNoteId}`;
  }
  if (fragment) {
    window.location.hash = '#' + fragment;
  } else {
    window.history.replaceState(null, '', window.location.pathname);
  }
}

function parseUrl(): void {
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash);

  searchQuery = params.get('q') || '';
  const noteId = params.get('note');
  selectedNoteId = noteId ? parseInt(noteId, 10) : null;
}

function renderForm(container: HTMLElement): void {
  const form = document.createElement('form');
  form.id = 'note-form';

  const titleLabel = document.createElement('label');
  titleLabel.setAttribute('for', 'title');
  titleLabel.textContent = 'Title';
  const titleInput = document.createElement('input');
  titleInput.id = 'title';
  titleInput.type = 'text';
  titleInput.placeholder = 'Note title';

  const bodyLabel = document.createElement('label');
  bodyLabel.setAttribute('for', 'body');
  bodyLabel.textContent = 'Body';
  const bodyTextarea = document.createElement('textarea');
  bodyTextarea.id = 'body';
  bodyTextarea.placeholder = 'Body text. Use <b>, <strong>, <i>, <em>, <a href="..."> for formatting and <br> or newlines for breaks.';
  bodyTextarea.rows = 5;

  const avatarLabel = document.createElement('label');
  avatarLabel.setAttribute('for', 'avatar');
  avatarLabel.textContent = 'Avatar URL (optional)';
  const avatarInput = document.createElement('input');
  avatarInput.id = 'avatar';
  avatarInput.type = 'text';
  avatarInput.placeholder = 'Avatar URL (http://, https://, or data:image/)';

  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.textContent = 'Add Note';

  form.appendChild(titleLabel);
  form.appendChild(titleInput);
  form.appendChild(bodyLabel);
  form.appendChild(bodyTextarea);
  form.appendChild(avatarLabel);
  form.appendChild(avatarInput);
  form.appendChild(submitButton);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    addNote(titleInput.value, bodyTextarea.value, avatarInput.value);
    titleInput.value = '';
    bodyTextarea.value = '';
    avatarInput.value = '';
  });

  container.appendChild(form);
}

function renderSearch(container: HTMLElement): void {
  const searchInput = document.createElement('input');
  searchInput.id = 'search';
  searchInput.type = 'text';
  searchInput.placeholder = 'Search notes...';
  searchInput.value = searchQuery;

  searchInput.addEventListener('input', (e) => {
    updateSearch((e.target as HTMLInputElement).value);
  });

  const resultsLine = document.createElement('p');
  resultsLine.id = 'results-line';
  if (searchQuery) {
    resultsLine.textContent = `results for "${searchQuery}"`;
  }

  container.appendChild(searchInput);
  container.appendChild(resultsLine);
}

function renderFeed(container: HTMLElement): void {
  const feed = document.createElement('section');
  feed.id = 'feed';

  const filtered = getFilteredNotes();

  for (const note of filtered) {
    const article = document.createElement('article');
    article.className = 'note';
    article.setAttribute('data-note-id', String(note.id));
    if (selectedNoteId === note.id) {
      article.setAttribute('aria-current', 'true');
    }

    const title = document.createElement('h2');
    title.className = 'note-title';
    title.textContent = note.title;
    title.style.cursor = 'pointer';
    title.addEventListener('click', () => selectNote(note.id));

    const body = document.createElement('div');
    body.className = 'note-body';
    // Convert plain text newlines to <br> tags, then parse HTML tags
    let html = note.body.replace(/\n/g, '<br>');
    setElementInnerHtml(body, sanitizeHtml(html));

    article.appendChild(title);

    if (note.avatar) {
      const img = document.createElement('img');
      img.className = 'note-avatar';
      if (validateAvatarUrl(note.avatar)) {
        img.src = note.avatar;
      }
      article.appendChild(img);
    }

    article.appendChild(body);
    feed.appendChild(article);
  }

  container.appendChild(feed);
}

function render(): void {
  const app = document.getElementById('app');
  if (!app) return;

  // Remove all children
  while (app.firstChild) {
    app.removeChild(app.firstChild);
  }

  const header = document.createElement('header');
  const h1 = document.createElement('h1');
  h1.textContent = 'Porto Notes';
  header.appendChild(h1);
  app.appendChild(header);

  const main = document.createElement('main');

  const formSection = document.createElement('section');
  formSection.className = 'form-section';
  renderForm(formSection);
  main.appendChild(formSection);

  const searchSection = document.createElement('section');
  searchSection.className = 'search-section';
  renderSearch(searchSection);
  main.appendChild(searchSection);

  const feedContainer = document.createElement('div');
  feedContainer.className = 'feed-container';
  renderFeed(feedContainer);
  main.appendChild(feedContainer);

  app.appendChild(main);
}

window.addEventListener('hashchange', () => {
  parseUrl();
  render();
});

(async () => {
  parseUrl();
  await initializeNotes();
  render();
})();
