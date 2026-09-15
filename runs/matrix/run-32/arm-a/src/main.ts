import fixtures from '../fixtures.json';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar?: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto_notes';

let notes: Note[] = [];
let searchQuery = '';
let selectedNoteId: number | null = null;

function loadNotes() {
  const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('porto-notes');
  if (stored) {
    try {
      notes = JSON.parse(stored);
    } catch (e) {
      notes = [...fixtures];
    }
  } else {
    notes = [...fixtures];
    saveNotes();
  }
}

function saveNotes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function sanitizeAndRender(htmlOrText: string): string {
  if (!htmlOrText) return '';
  const withBreaks = htmlOrText.replace(/\r\n|\n/g, '<br>');

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${withBreaks}</div>`, 'text/html');
  const container = doc.body.firstElementChild || doc.body;

  const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'A', 'BR']);

  function cleanNode(node: Node): Node | null {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.nodeValue || '');
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tagName = el.tagName.toUpperCase();

      if (ALLOWED_TAGS.has(tagName)) {
        const newEl = document.createElement(tagName.toLowerCase());
        if (tagName === 'A') {
          const href = el.getAttribute('href');
          if (href) {
            const trimmedHref = href.trim().toLowerCase();
            if (!trimmedHref.startsWith('javascript:') && !trimmedHref.startsWith('vbscript:')) {
              newEl.setAttribute('href', href);
              newEl.setAttribute('target', '_blank');
              newEl.setAttribute('rel', 'noopener noreferrer');
            }
          }
        }
        for (const child of Array.from(el.childNodes)) {
          const cleaned = cleanNode(child);
          if (cleaned) {
            newEl.appendChild(cleaned);
          }
        }
        return newEl;
      } else {
        const frag = document.createDocumentFragment();
        for (const child of Array.from(el.childNodes)) {
          const cleaned = cleanNode(child);
          if (cleaned) {
            frag.appendChild(cleaned);
          }
        }
        return frag;
      }
    }
    return null;
  }

  const outputDiv = document.createElement('div');
  for (const child of Array.from(container.childNodes)) {
    const cleaned = cleanNode(child);
    if (cleaned) {
      outputDiv.appendChild(cleaned);
    }
  }
  return outputDiv.innerHTML;
}

function updateUrlHash() {
  const params = new URLSearchParams();
  if (searchQuery.trim()) {
    params.set('q', searchQuery.trim());
  }
  if (selectedNoteId !== null) {
    params.set('note', String(selectedNoteId));
  }
  const hashStr = params.toString();
  const newHash = hashStr ? `#${hashStr}` : '#';
  if (window.location.hash !== newHash) {
    history.replaceState(null, '', newHash);
  }
}

function parseUrlHash() {
  const hash = window.location.hash.replace(/^#/, '');
  const params = new URLSearchParams(hash);
  const q = params.get('q') || '';
  const noteStr = params.get('note');
  const noteId = noteStr ? Number(noteStr) : null;

  searchQuery = q;
  selectedNoteId = isNaN(noteId!) ? null : noteId;
}

function render() {
  const searchInput = document.getElementById('search') as HTMLInputElement;
  if (searchInput && searchInput.value !== searchQuery) {
    searchInput.value = searchQuery;
  }

  const resultsLine = document.getElementById('results-line');
  if (resultsLine) {
    if (searchQuery.trim()) {
      resultsLine.textContent = `results for "${searchQuery.trim()}"`;
    } else {
      resultsLine.textContent = '';
    }
  }

  const qLower = searchQuery.trim().toLowerCase();
  const filtered = notes.filter((note) => {
    if (!qLower) return true;
    return (
      note.title.toLowerCase().includes(qLower) ||
      note.body.toLowerCase().includes(qLower)
    );
  });

  filtered.sort((a, b) => {
    const dateA = new Date(a.createdAt || 0).getTime();
    const dateB = new Date(b.createdAt || 0).getTime();
    if (dateA !== dateB) {
      return dateB - dateA;
    }
    return b.id - a.id;
  });

  const feed = document.getElementById('feed');
  if (feed) {
    feed.innerHTML = '';
    if (filtered.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.className = 'empty-feed';
      emptyMsg.textContent = searchQuery ? 'No notes matching your search.' : 'No notes yet.';
      feed.appendChild(emptyMsg);
    } else {
      for (const note of filtered) {
        const article = document.createElement('article');
        article.className = 'note';
        article.dataset.noteId = String(note.id);

        const isSelected = selectedNoteId === note.id;
        if (isSelected) {
          article.setAttribute('aria-current', 'true');
        }

        if (note.avatar && note.avatar.trim()) {
          const img = document.createElement('img');
          img.className = 'note-avatar';
          img.src = note.avatar;
          img.alt = `${note.title} avatar`;
          article.appendChild(img);
        }

        const titleEl = document.createElement('h3');
        titleEl.className = 'note-title';
        titleEl.innerHTML = sanitizeAndRender(note.title);
        if (isSelected) {
          titleEl.setAttribute('aria-current', 'true');
        }
        titleEl.addEventListener('click', () => {
          selectedNoteId = note.id;
          updateUrlHash();
          render();
        });
        article.appendChild(titleEl);

        const bodyEl = document.createElement('div');
        bodyEl.className = 'note-body';
        bodyEl.innerHTML = sanitizeAndRender(note.body);
        article.appendChild(bodyEl);

        feed.appendChild(article);
      }
    }
  }

  updateUrlHash();
}

function init() {
  loadNotes();
  parseUrlHash();

  const searchInput = document.getElementById('search') as HTMLInputElement;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = (e.target as HTMLInputElement).value;
      render();
    });
  }

  const form = document.getElementById('note-form') as HTMLFormElement;
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const titleInput = document.getElementById('title') as HTMLInputElement;
      const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
      const avatarInput = document.getElementById('avatar') as HTMLInputElement;

      const title = titleInput?.value.trim() || '';
      const body = bodyInput?.value.trim() || '';
      const avatar = avatarInput?.value.trim() || '';

      if (!title || !body) return;

      const maxId = notes.reduce((max, n) => Math.max(max, n.id), 0);
      const newNote: Note = {
        id: maxId + 1,
        title,
        body,
        avatar: avatar || undefined,
        createdAt: new Date().toISOString(),
      };

      notes.unshift(newNote);
      saveNotes();

      form.reset();
      selectedNoteId = newNote.id;
      render();
    });
  }

  window.addEventListener('hashchange', () => {
    parseUrlHash();
    render();
  });

  render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
