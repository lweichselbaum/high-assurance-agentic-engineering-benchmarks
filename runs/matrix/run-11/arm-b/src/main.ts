import { setAnchorHref } from 'safevalues/dom';
import fixtures from '../fixtures.json';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto-notes';

let notes: Note[] = [];
let maxNoteId = 0;
let searchQuery = '';
let selectedNoteId: number | null = null;

const form = document.getElementById('note-form') as HTMLFormElement;
const titleInput = document.getElementById('title') as HTMLInputElement;
const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
const avatarInput = document.getElementById('avatar') as HTMLInputElement;
const searchInput = document.getElementById('search') as HTMLInputElement;
const resultsLine = document.getElementById('results-line') as HTMLParagraphElement;
const feed = document.getElementById('feed') as HTMLElement;

function loadNotes(): void {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      notes = JSON.parse(stored);
      maxNoteId = Math.max(0, ...notes.map(n => n.id));
    } catch {
      notes = [];
      maxNoteId = 0;
    }
  }
}

function initializeNotes(): void {
  loadNotes();
  if (notes.length === 0 && fixtures.length > 0) {
    notes = fixtures;
    maxNoteId = Math.max(0, ...notes.map(n => n.id));
    saveNotes();
  }
}

function saveNotes(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function validateAvatarUrl(url: string): boolean {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    return /^(https?|data):/.test(parsed.protocol);
  } catch {
    return false;
  }
}

function isValidLinkUrl(url: string): boolean {
  if (!url) return true;
  if (/^(javascript|data|vbscript):/i.test(url)) {
    return false;
  }
  return true;
}

function addNote(title: string, body: string, avatar: string): void {
  if (!title.trim() || !body.trim()) return;
  if (avatar && !validateAvatarUrl(avatar)) return;

  const newNote: Note = {
    id: ++maxNoteId,
    title: title.trim(),
    body: body.trim(),
    avatar: avatar.trim(),
    createdAt: new Date().toISOString(),
  };

  notes.unshift(newNote);
  saveNotes();
  renderFeed();
  form.reset();
}

function buildRichTextDOM(html: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const stack: Element[] = [];
  let currentText = '';

  const flushText = () => {
    if (currentText) {
      const textNode = document.createTextNode(currentText);
      if (stack.length > 0) {
        stack[stack.length - 1]?.appendChild(textNode);
      } else {
        fragment.appendChild(textNode);
      }
      currentText = '';
    }
  };

  let i = 0;
  while (i < html.length) {
    const remaining = html.slice(i);

    const brMatch = remaining.match(/^<br\s*\/?>/);
    if (brMatch) {
      flushText();
      const br = document.createElement('br');
      if (stack.length > 0) {
        stack[stack.length - 1]?.appendChild(br);
      } else {
        fragment.appendChild(br);
      }
      i += brMatch[0].length;
      continue;
    }

    const closeMatch = remaining.match(/^<\/(b|strong|i|em|a)>/);
    if (closeMatch) {
      flushText();
      const element = stack.pop();
      if (element) {
        if (stack.length > 0) {
          stack[stack.length - 1]?.appendChild(element);
        } else {
          fragment.appendChild(element);
        }
      }
      i += closeMatch[0].length;
      continue;
    }

    const openMatch = remaining.match(/^<(b|strong|i|em)>/);
    if (openMatch && openMatch[1]) {
      flushText();
      const tagName = openMatch[1] === 'strong' ? 'b' : openMatch[1] === 'em' ? 'i' : openMatch[1];
      const element = document.createElement(tagName);
      stack.push(element);
      i += openMatch[0].length;
      continue;
    }

    const linkMatch = remaining.match(/^<a\s+href="([^"]*)">/);
    if (linkMatch) {
      flushText();
      if (linkMatch[1] && isValidLinkUrl(linkMatch[1])) {
        const element = document.createElement('a');
        setAnchorHref(element, linkMatch[1]);
        stack.push(element);
      }
      i += linkMatch[0].length;
      continue;
    }

    currentText += html[i];
    i++;
  }

  flushText();

  while (stack.length > 0) {
    const element = stack.pop();
    if (element) {
      if (stack.length > 0) {
        stack[stack.length - 1]?.appendChild(element);
      } else {
        fragment.appendChild(element);
      }
    }
  }

  return fragment;
}

function renderNoteBody(body: string): HTMLElement {
  const div = document.createElement('div');
  div.className = 'note-body';
  const fragment = buildRichTextDOM(body);
  div.appendChild(fragment);
  return div;
}

function renderNoteAvatar(avatarUrl: string): HTMLImageElement | null {
  if (!avatarUrl) return null;

  const img = document.createElement('img');
  img.className = 'note-avatar';
  img.alt = 'Avatar';

  if (/^data:image\//.test(avatarUrl) || /^https?:\/\//.test(avatarUrl)) {
    img.src = avatarUrl;
  }

  return img;
}

function getFilteredNotes(): Note[] {
  let filtered = notes;
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = notes.filter(
      n => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)
    );
  }
  return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function selectNote(id: number): void {
  selectedNoteId = id;
  updateFragment();
  renderFeed();
}

function updateFragment(): void {
  const parts: string[] = [];
  if (searchQuery) parts.push(`q=${encodeURIComponent(searchQuery)}`);
  if (selectedNoteId) parts.push(`note=${selectedNoteId}`);
  window.location.hash = parts.length ? parts.join('&') : '';
}

function parseFragment(): void {
  const hash = window.location.hash.slice(1);
  if (!hash) return;

  const params = new URLSearchParams(hash);
  searchQuery = params.get('q') || '';
  selectedNoteId = params.get('note') ? parseInt(params.get('note')!, 10) : null;

  if (searchQuery) {
    searchInput.value = searchQuery;
  }
}

function renderFeed(): void {
  const filtered = getFilteredNotes();

  if (searchQuery) {
    resultsLine.textContent = `results for "${searchQuery}"`;
  } else {
    resultsLine.textContent = '';
  }

  while (feed.firstChild) {
    feed.removeChild(feed.firstChild);
  }

  filtered.forEach(note => {
    const article = document.createElement('article');
    article.className = 'note';
    article.dataset.noteId = String(note.id);

    if (selectedNoteId === note.id) {
      article.setAttribute('aria-current', 'true');
    }

    const titleEl = document.createElement('div');
    titleEl.className = 'note-title';
    titleEl.textContent = note.title;
    titleEl.addEventListener('click', () => selectNote(note.id));
    article.appendChild(titleEl);

    const bodyEl = renderNoteBody(note.body);
    bodyEl.addEventListener('click', e => {
      if ((e.target as HTMLElement).tagName !== 'A') {
        selectNote(note.id);
      }
    });
    article.appendChild(bodyEl);

    if (note.avatar) {
      const avatar = renderNoteAvatar(note.avatar);
      if (avatar) {
        article.appendChild(avatar);
      }
    }

    feed.appendChild(article);
  });
}

function handleSearch(query: string): void {
  searchQuery = query;
  updateFragment();
  renderFeed();
}

function handleHashChange(): void {
  parseFragment();
  renderFeed();
}

form.addEventListener('submit', e => {
  e.preventDefault();
  addNote(titleInput.value, bodyInput.value, avatarInput.value);
});

searchInput.addEventListener('input', e => {
  handleSearch((e.target as HTMLInputElement).value);
});

window.addEventListener('hashchange', handleHashChange);

initializeNotes();
parseFragment();
renderFeed();