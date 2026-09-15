import { sanitizeHtml } from 'safevalues';
import { setElementInnerHtml } from 'safevalues/dom';
import { setAnchorHref } from 'safevalues/dom';
import fixturesData from './fixtures.json';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto-notes';
let notes: Note[] = [];
let filteredNotes: Note[] = [];
let currentQuery = '';
let selectedNoteId: number | null = null;

function loadNotes(): Note[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
  const fixtures = fixturesData as Note[];
  return [...fixtures].reverse();
}

function saveNotes(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function getNextId(): number {
  return notes.length > 0 ? Math.max(...notes.map(n => n.id)) + 1 : 1;
}

function parseFragment(): { query: string; noteId: number | null } {
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash);
  const query = params.get('q') || '';
  const noteIdStr = params.get('note');
  const noteId = noteIdStr ? parseInt(noteIdStr, 10) : null;
  return { query, noteId };
}

function updateFragment(): void {
  const params = new URLSearchParams();
  if (currentQuery) {
    params.set('q', currentQuery);
  }
  if (selectedNoteId !== null) {
    params.set('note', selectedNoteId.toString());
  }
  const hash = params.toString();
  window.location.hash = hash;
}

function filterNotes(query: string): Note[] {
  if (!query) {
    return notes;
  }
  const lowerQuery = query.toLowerCase();
  return notes.filter(note =>
    note.title.toLowerCase().includes(lowerQuery) ||
    note.body.toLowerCase().includes(lowerQuery)
  );
}

function renderResultsLine(): void {
  const resultsLine = document.getElementById('results-line');
  if (!resultsLine) return;

  if (currentQuery) {
    resultsLine.textContent = `results for "${currentQuery}"`;
  } else {
    resultsLine.textContent = '';
  }
}

function isValidAvatarUrl(url: string): boolean {
  if (!url) return true;
  return url.startsWith('http:') || url.startsWith('https:') || url.startsWith('data:image/');
}

function renderNote(note: Note): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.setAttribute('data-note-id', note.id.toString());

  if (selectedNoteId === note.id) {
    article.setAttribute('aria-current', 'true');
  }

  const titleEl = document.createElement('h2');
  titleEl.className = 'note-title';
  titleEl.textContent = note.title;
  titleEl.style.cursor = 'pointer';
  titleEl.addEventListener('click', () => {
    selectedNoteId = note.id;
    updateFragment();
    renderFeed();
  });

  const bodyEl = document.createElement('div');
  bodyEl.className = 'note-body';

  const processedBody = note.body
    .replace(/\n/g, '<br>')
    .replace(/<a href="([^"]*)">/g, (match, url) => {
      return `<a href="${url.replace(/"/g, '&quot;')}">`;
    });

  setElementInnerHtml(bodyEl, sanitizeHtml(processedBody));

  const anchors = bodyEl.querySelectorAll('a');
  anchors.forEach(anchor => {
    const href = anchor.getAttribute('href');
    if (href) {
      setAnchorHref(anchor as HTMLAnchorElement, href);
    }
  });

  article.appendChild(titleEl);

  if (note.avatar && isValidAvatarUrl(note.avatar)) {
    const avatarImg = document.createElement('img');
    avatarImg.className = 'note-avatar';
    avatarImg.src = note.avatar;
    avatarImg.alt = 'Avatar';
    article.appendChild(avatarImg);
  }

  article.appendChild(bodyEl);

  return article;
}

function renderFeed(): void {
  const feed = document.getElementById('feed');
  if (!feed) return;

  feed.replaceChildren();

  filteredNotes.forEach(note => {
    feed.appendChild(renderNote(note));
  });
}

function handleSearch(query: string): void {
  currentQuery = query;
  filteredNotes = filterNotes(query);
  renderResultsLine();
  renderFeed();
  updateFragment();
}

function handleSubmit(e: Event): void {
  e.preventDefault();

  const titleInput = document.getElementById('title') as HTMLInputElement;
  const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
  const avatarInput = document.getElementById('avatar') as HTMLInputElement;

  if (!titleInput || !bodyInput || !avatarInput) return;

  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  const avatar = avatarInput.value.trim();

  if (!title || !body) return;

  const newNote: Note = {
    id: getNextId(),
    title,
    body,
    avatar,
    createdAt: new Date().toISOString()
  };

  notes.unshift(newNote);
  saveNotes();

  filteredNotes = filterNotes(currentQuery);
  renderFeed();

  titleInput.value = '';
  bodyInput.value = '';
  avatarInput.value = '';
}

function initApp(): void {
  notes = loadNotes();

  const { query, noteId } = parseFragment();
  currentQuery = query;
  selectedNoteId = noteId;

  const app = document.getElementById('app');
  if (!app) return;

  app.replaceChildren();

  const heading = document.createElement('h1');
  heading.textContent = 'Porto Notes';
  app.appendChild(heading);

  const form = document.createElement('form');
  form.id = 'note-form';

  const titleLabel = document.createElement('label');
  titleLabel.textContent = 'Title';
  titleLabel.htmlFor = 'title';
  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.id = 'title';
  titleInput.required = true;

  const bodyLabel = document.createElement('label');
  bodyLabel.textContent = 'Body';
  bodyLabel.htmlFor = 'body';
  const bodyInput = document.createElement('textarea');
  bodyInput.id = 'body';
  bodyInput.required = true;

  const avatarLabel = document.createElement('label');
  avatarLabel.textContent = 'Avatar URL (optional)';
  avatarLabel.htmlFor = 'avatar';
  const avatarInput = document.createElement('input');
  avatarInput.type = 'url';
  avatarInput.id = 'avatar';

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.textContent = 'Add Note';

  form.appendChild(titleLabel);
  form.appendChild(titleInput);
  form.appendChild(bodyLabel);
  form.appendChild(bodyInput);
  form.appendChild(avatarLabel);
  form.appendChild(avatarInput);
  form.appendChild(submitBtn);

  form.addEventListener('submit', handleSubmit);

  app.appendChild(form);

  const searchLabel = document.createElement('label');
  searchLabel.textContent = 'Search';
  searchLabel.htmlFor = 'search';
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.id = 'search';
  searchInput.placeholder = 'Search notes...';
  searchInput.value = currentQuery;

  searchInput.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    handleSearch(target.value);
  });

  app.appendChild(searchLabel);
  app.appendChild(searchInput);

  const resultsLine = document.createElement('p');
  resultsLine.id = 'results-line';
  app.appendChild(resultsLine);

  const feed = document.createElement('section');
  feed.id = 'feed';
  app.appendChild(feed);

  filteredNotes = filterNotes(currentQuery);
  renderResultsLine();
  renderFeed();
}

window.addEventListener('hashchange', () => {
  const { query, noteId } = parseFragment();
  currentQuery = query;
  selectedNoteId = noteId;

  const searchInput = document.getElementById('search') as HTMLInputElement;
  if (searchInput) {
    searchInput.value = currentQuery;
  }

  filteredNotes = filterNotes(currentQuery);
  renderResultsLine();
  renderFeed();
});

initApp();
