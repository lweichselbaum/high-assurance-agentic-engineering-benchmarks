import type { Note } from './types.ts';
import { loadNotes, saveNotes, getNextNoteId } from './storage.ts';
import { renderRichText, isValidAvatarUrl } from './richtext.ts';

let notes: Note[] = loadNotes();
let currentQuery = '';
let selectedNoteId: number | null = null;

const form = document.querySelector<HTMLFormElement>('#note-form');
const titleInput = document.querySelector<HTMLInputElement>('#title');
const bodyInput = document.querySelector<HTMLTextAreaElement>('#body');
const avatarInput = document.querySelector<HTMLInputElement>('#avatar');
const searchInput = document.querySelector<HTMLInputElement>('#search');
const resultsLine = document.querySelector<HTMLParagraphElement>('#results-line');
const feed = document.querySelector<HTMLElement>('#feed');

if (!form || !titleInput || !bodyInput || !avatarInput || !searchInput || !resultsLine || !feed) {
  throw new Error('Required DOM elements are missing from the page.');
}

function updateHash(): void {
  const params = new URLSearchParams();
  if (currentQuery) {
    params.set('q', currentQuery);
  }
  if (selectedNoteId !== null && selectedNoteId !== undefined) {
    params.set('note', String(selectedNoteId));
  }
  const paramStr = params.toString();
  const newHash = paramStr ? `#${paramStr}` : '';
  const currentHash = window.location.hash;

  if (currentHash !== newHash) {
    const newUrl = newHash || window.location.pathname + window.location.search;
    window.history.replaceState(null, '', newUrl);
  }
}

function selectNote(id: number | null): void {
  selectedNoteId = id;
  const articles = feed!.querySelectorAll<HTMLElement>('article.note');
  for (const article of articles) {
    const noteId = Number(article.getAttribute('data-note-id'));
    if (selectedNoteId !== null && noteId === selectedNoteId) {
      article.setAttribute('aria-current', 'true');
    } else {
      article.removeAttribute('aria-current');
    }
  }
}

function applyFilter(): void {
  const q = currentQuery.toLowerCase();
  const articles = feed!.querySelectorAll<HTMLElement>('article.note');
  for (const article of articles) {
    const noteId = Number(article.getAttribute('data-note-id'));
    const note = notes.find((n) => n.id === noteId);
    if (!note) continue;
    const matches = !q || (note.title + ' ' + note.body).toLowerCase().includes(q);
    article.style.display = matches ? '' : 'none';
  }

  if (currentQuery) {
    resultsLine!.textContent = `results for "${currentQuery}"`;
  } else {
    resultsLine!.textContent = '';
  }
}

function createNoteElement(note: Note): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.setAttribute('data-note-id', String(note.id));

  if (isValidAvatarUrl(note.avatar)) {
    const avatarImg = document.createElement('img');
    avatarImg.className = 'note-avatar';
    avatarImg.setAttribute('src', note.avatar);
    avatarImg.setAttribute('alt', 'Author avatar');
    article.appendChild(avatarImg);
  }

  const titleEl = document.createElement('h3');
  titleEl.className = 'note-title';
  titleEl.tabIndex = 0;
  titleEl.setAttribute('role', 'button');
  titleEl.setAttribute('aria-label', `Select note: ${note.title}`);
  renderRichText(note.title, titleEl);

  titleEl.addEventListener('click', () => {
    selectNote(note.id);
    updateHash();
  });

  titleEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectNote(note.id);
      updateHash();
    }
  });

  article.appendChild(titleEl);

  const bodyEl = document.createElement('div');
  bodyEl.className = 'note-body';
  renderRichText(note.body, bodyEl);
  article.appendChild(bodyEl);

  return article;
}

function renderFeed(): void {
  feed!.replaceChildren();
  for (const note of notes) {
    const el = createNoteElement(note);
    feed!.appendChild(el);
  }
}

function syncFromHash(): void {
  const hash = window.location.hash.replace(/^#/, '');
  const params = new URLSearchParams(hash);
  const q = params.get('q') ?? '';
  const noteParam = params.get('note');
  const noteId = noteParam !== null && !Number.isNaN(Number(noteParam)) ? Number(noteParam) : null;

  currentQuery = q;
  searchInput!.value = q;
  selectedNoteId = noteId;

  applyFilter();
  selectNote(selectedNoteId);
}

// Event Listeners
form.addEventListener('submit', (e: SubmitEvent) => {
  e.preventDefault();
  const title = titleInput.value;
  const body = bodyInput.value;
  const avatar = avatarInput.value;

  const newNote: Note = {
    id: getNextNoteId(notes),
    title,
    body,
    avatar,
    createdAt: new Date().toISOString(),
  };

  notes.unshift(newNote);
  saveNotes(notes);

  titleInput.value = '';
  bodyInput.value = '';
  avatarInput.value = '';
  form.reset();

  renderFeed();
  applyFilter();
  selectNote(selectedNoteId);
});

searchInput.addEventListener('input', () => {
  currentQuery = searchInput.value;
  applyFilter();
  updateHash();
});

window.addEventListener('hashchange', syncFromHash);
window.addEventListener('popstate', syncFromHash);

// Initial initialization
renderFeed();
syncFromHash();
