import fixtures from './fixtures.json';
import DOMPurify from 'dompurify';

export interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto_notes';

function getNotes(): Note[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fixtures));
  return fixtures;
}

function saveNotes(notes: Note[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

let notes = getNotes();

function renderFeed() {
  const feed = document.getElementById('feed');
  if (!feed) return;
  
  feed.replaceChildren();
  
  let q = '';
  let selectedNoteId: number | null = null;
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash);
  if (params.has('q')) {
      q = params.get('q') || '';
  }
  if (params.has('note')) {
      selectedNoteId = parseInt(params.get('note')!, 10);
  }

  const resultsLine = document.getElementById('results-line');
  if (resultsLine) {
    if (q) {
      resultsLine.innerText = `results for "${q}"`;
    } else {
      resultsLine.innerText = '';
    }
  }

  const lowerQ = q.toLowerCase();
  
  // newest first (reverse id order)
  const sorted = [...notes].sort((a, b) => b.id - a.id);

  const sanitizeOptions = {
      ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'a', 'br'],
      ALLOWED_ATTR: ['href'],
      RETURN_TRUSTED_TYPE: true
  };

  for (const note of sorted) {
    if (lowerQ) {
      if (!note.title.toLowerCase().includes(lowerQ) && !note.body.toLowerCase().includes(lowerQ)) {
        continue;
      }
    }

    const article = document.createElement('article');
    article.className = 'note';
    article.setAttribute('data-note-id', note.id.toString());
    if (note.id === selectedNoteId) {
        article.setAttribute('aria-current', 'true');
    }

    const h2 = document.createElement('h2');
    h2.className = 'note-title';
    h2.innerHTML = DOMPurify.sanitize(note.title, sanitizeOptions) as unknown as string;
    
    // Clicking a note's title selects it
    h2.addEventListener('click', () => {
        const hashParams = new URLSearchParams();
        if (q) hashParams.set('q', q);
        hashParams.set('note', note.id.toString());
        window.location.hash = hashParams.toString();
    });

    article.appendChild(h2);

    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'note-body';
    // a newline in the body is also a line break.
    const bodyHtml = note.body.replace(/\n/g, '<br>');
    bodyDiv.innerHTML = DOMPurify.sanitize(bodyHtml, sanitizeOptions) as unknown as string;
    article.appendChild(bodyDiv);

    if (note.avatar) {
        const img = document.createElement('img');
        img.className = 'note-avatar';
        img.src = note.avatar;
        article.appendChild(img);
    }
    feed.appendChild(article);
  }
}

function updateHash(updates: Record<string, string | null>) {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') {
            params.delete(key);
        } else {
            params.set(key, value);
        }
    }
    const res = params.toString();
    window.location.hash = res ? '#' + res : '';
    // this triggers hashchange, which calls renderFeed
}

window.addEventListener('hashchange', () => {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const searchInput = document.getElementById('search') as HTMLInputElement | null;
    if (searchInput) {
        searchInput.value = params.get('q') || '';
    }
    renderFeed();
});

function init() {
    const searchInput = document.getElementById('search') as HTMLInputElement | null;
    if (searchInput) {
        const hash = window.location.hash.slice(1);
        const params = new URLSearchParams(hash);
        searchInput.value = params.get('q') || '';
        
        searchInput.addEventListener('input', () => {
            updateHash({ q: searchInput.value || null });
        });
    }

    const form = document.getElementById('note-form') as HTMLFormElement | null;
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const titleInput = document.getElementById('title') as HTMLInputElement;
            const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
            const avatarInput = document.getElementById('avatar') as HTMLInputElement;

            const nextId = notes.length > 0 ? Math.max(...notes.map(n => n.id)) + 1 : 1;
            const newNote: Note = {
                id: nextId,
                title: titleInput.value,
                body: bodyInput.value,
                avatar: avatarInput.value,
                createdAt: new Date().toISOString()
            };
            notes.push(newNote);
            saveNotes(notes);
            form.reset();
            renderFeed();
        });
    }

    renderFeed();
}

init();
