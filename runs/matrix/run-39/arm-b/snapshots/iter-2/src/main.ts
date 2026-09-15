import { sanitizeHtml } from 'safevalues';
import { setElementInnerHtml } from 'safevalues/dom';
import fixturesData from '../fixtures.json';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar?: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto_notes_data';

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as Note[];
      }
    }
  } catch {
    /* fallback to seed */
  }
  const seed = fixturesData as Note[];
  saveNotes(seed);
  return seed;
}

function saveNotes(notes: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    /* ignore storage write errors */
  }
}

function isValidAvatarUrl(url: string | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('data:text/') ||
    lower.startsWith('data:html/')
  ) {
    return false;
  }
  return (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('data:image/') ||
    lower.startsWith('/')
  );
}

interface HashState {
  query: string;
  selectedId: number | null;
}

function parseHash(): HashState {
  const rawHash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  const params = new URLSearchParams(rawHash);
  const query = params.get('q') ?? '';
  const noteStr = params.get('note');
  const selectedId = noteStr ? parseInt(noteStr, 10) : null;
  return {
    query,
    selectedId: selectedId !== null && !isNaN(selectedId) ? selectedId : null,
  };
}

function updateHash(query: string, selectedId: number | null): void {
  const params = new URLSearchParams();
  if (query) {
    params.set('q', query);
  }
  if (selectedId != null) {
    params.set('note', String(selectedId));
  }
  const hashStr = params.toString();
  const newHash = hashStr ? '#' + hashStr : '';
  if (window.location.hash !== newHash) {
    history.replaceState(
      null,
      '',
      newHash || window.location.pathname + window.location.search,
    );
  }
}

function initApp(): void {
  const formEl = document.querySelector<HTMLFormElement>('#note-form');
  const titleEl = document.querySelector<HTMLInputElement>('#title');
  const bodyEl = document.querySelector<HTMLTextAreaElement>('#body');
  const avatarEl = document.querySelector<HTMLInputElement>('#avatar');
  const searchEl = document.querySelector<HTMLInputElement>('#search');
  const resultsLineEl = document.querySelector<HTMLParagraphElement>('#results-line');
  const feedEl = document.querySelector<HTMLElement>('#feed');

  if (!formEl || !titleEl || !bodyEl || !avatarEl || !searchEl || !resultsLineEl || !feedEl) {
    return;
  }

  const notes: Note[] = loadNotes();
  const initialHash = parseHash();
  let currentQuery = initialHash.query;
  let selectedNoteId = initialHash.selectedId;

  searchEl.value = currentQuery;

  function render(): void {
    feedEl!.textContent = '';

    const sortedNotes = [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const queryLower = currentQuery.toLowerCase();

    resultsLineEl!.textContent = currentQuery ? `results for "${currentQuery}"` : '';

    for (const note of sortedNotes) {
      const article = document.createElement('article');
      article.className = 'note';
      article.setAttribute('data-note-id', String(note.id));

      if (selectedNoteId === note.id) {
        article.setAttribute('aria-current', 'true');
      }

      const matches =
        !queryLower ||
        note.title.toLowerCase().includes(queryLower) ||
        note.body.toLowerCase().includes(queryLower);

      if (!matches) {
        article.style.display = 'none';
      }

      const nTitle = document.createElement('h2');
      nTitle.className = 'note-title';
      setElementInnerHtml(nTitle, sanitizeHtml(note.title));
      nTitle.addEventListener('click', () => {
        selectedNoteId = note.id;
        updateHash(currentQuery, selectedNoteId);
        updateSelectionState();
      });
      article.appendChild(nTitle);

      const nBody = document.createElement('div');
      nBody.className = 'note-body';
      const formattedBody = note.body.replace(/\r\n|\r|\n/g, '<br>');
      setElementInnerHtml(nBody, sanitizeHtml(formattedBody));
      article.appendChild(nBody);

      if (isValidAvatarUrl(note.avatar)) {
        const nAvatar = document.createElement('img');
        nAvatar.className = 'note-avatar';
        nAvatar.src = note.avatar!;
        nAvatar.alt = note.title;
        article.appendChild(nAvatar);
      }

      feedEl!.appendChild(article);
    }
  }

  function updateSelectionState(): void {
    const articles = feedEl!.querySelectorAll<HTMLElement>('article.note');
    articles.forEach((article) => {
      const idAttr = article.getAttribute('data-note-id');
      if (idAttr && Number(idAttr) === selectedNoteId) {
        article.setAttribute('aria-current', 'true');
      } else {
        article.removeAttribute('aria-current');
      }
    });
  }

  function updateSearchState(): void {
    resultsLineEl!.textContent = currentQuery ? `results for "${currentQuery}"` : '';
    const queryLower = currentQuery.toLowerCase();
    const articles = feedEl!.querySelectorAll<HTMLElement>('article.note');
    articles.forEach((article) => {
      const idAttr = article.getAttribute('data-note-id');
      if (!idAttr) return;
      const noteId = Number(idAttr);
      const note = notes.find((n) => n.id === noteId);
      if (note) {
        const matches =
          !queryLower ||
          note.title.toLowerCase().includes(queryLower) ||
          note.body.toLowerCase().includes(queryLower);
        article.style.display = matches ? '' : 'none';
      }
    });
  }

  formEl.addEventListener('submit', (e: Event) => {
    e.preventDefault();
    const title = titleEl.value.trim();
    const body = bodyEl.value;
    const avatar = avatarEl.value.trim();

    if (!title && !body) return;

    const maxId = notes.reduce((max, n) => Math.max(max, n.id), 0);
    const newNote: Note = {
      id: maxId + 1,
      title,
      body,
      avatar: avatar || undefined,
      createdAt: new Date().toISOString(),
    };

    notes.push(newNote);
    saveNotes(notes);

    titleEl.value = '';
    bodyEl.value = '';
    avatarEl.value = '';

    render();
  });

  searchEl.addEventListener('input', () => {
    currentQuery = searchEl.value;
    updateHash(currentQuery, selectedNoteId);
    updateSearchState();
  });

  window.addEventListener('hashchange', () => {
    const { query, selectedId } = parseHash();
    let searchChanged = false;
    if (query !== currentQuery) {
      currentQuery = query;
      searchEl.value = currentQuery;
      searchChanged = true;
    }
    if (selectedId !== selectedNoteId) {
      selectedNoteId = selectedId;
      updateSelectionState();
    }
    if (searchChanged) {
      updateSearchState();
    }
  });

  render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
