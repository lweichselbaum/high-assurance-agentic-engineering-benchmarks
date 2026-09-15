import DOMPurify from 'dompurify';
import fixtures from '../fixtures.json' with { type: 'json' };

interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto-notes-v1';

function loadNotes(): Note[] {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) {
    try {
      return JSON.parse(data);
    } catch {
      // ignore
    }
  }
  const fixtureNotes = [...fixtures];
  saveNotes(fixtureNotes);
  return fixtureNotes;
}

function saveNotes(notes: Note[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

let notes = loadNotes();

function parseFragment() {
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const params = new URLSearchParams(hash);
  return { q: params.get('q') || '', note: params.get('note') || '' };
}

function updateFragment(q: string, note: string) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (note) params.set('note', note);
  const hash = params.toString();
  history.replaceState(null, '', hash ? '#' + hash : location.pathname + location.search);
}

const app = document.getElementById('app');
if (app) {
    app.textContent = '';
    
    const form = document.createElement('form');
    form.id = 'note-form';

    const titleInput = document.createElement('input');
    titleInput.id = 'title';
    titleInput.type = 'text';

    const bodyTextarea = document.createElement('textarea');
    bodyTextarea.id = 'body';

    const avatarInput = document.createElement('input');
    avatarInput.id = 'avatar';
    avatarInput.type = 'text';

    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.textContent = 'Add Note';

    form.appendChild(titleInput);
    form.appendChild(bodyTextarea);
    form.appendChild(avatarInput);
    form.appendChild(submitButton);

    const searchInput = document.createElement('input');
    searchInput.id = 'search';
    searchInput.type = 'text';

    const resultsLine = document.createElement('p');
    resultsLine.id = 'results-line';

    const feedSection = document.createElement('section');
    feedSection.id = 'feed';

    app.appendChild(form);
    app.appendChild(searchInput);
    app.appendChild(resultsLine);
    app.appendChild(feedSection);

    function render() {
      const { q, note: selectedNoteId } = parseFragment();
      
      feedSection.textContent = '';
      
      if (q) {
        resultsLine.textContent = `results for "${q}"`;
      } else {
        resultsLine.textContent = '';
      }
      
      const lowerQ = q.toLowerCase();
      
      const notesToRender = notes.filter((n: Note) => 
        n.title.toLowerCase().includes(lowerQ) || n.body.toLowerCase().includes(lowerQ)
      ).sort((a: Note, b: Note) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      for (const note of notesToRender) {
        const article = document.createElement('article');
        article.className = 'note';
        article.dataset.noteId = note.id.toString();
        
        if (selectedNoteId === note.id.toString()) {
          article.setAttribute('aria-current', 'true');
        }
        
        const titleDiv = document.createElement('div');
        titleDiv.className = 'note-title';
        titleDiv.textContent = note.title;
        titleDiv.style.cursor = 'pointer';
        titleDiv.addEventListener('click', () => {
          const current = parseFragment();
          updateFragment(current.q, note.id.toString());
          render();
        });
        
        const bodyDiv = document.createElement('div');
        bodyDiv.className = 'note-body';
        
        // ensure body is rendered correctly
        const htmlToSanitize = note.body.replace(/\r?\n/g, '<br>');
        const cleanFrag = DOMPurify.sanitize(htmlToSanitize, {
          RETURN_DOM_FRAGMENT: true,
          ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'a', 'br'],
          ALLOWED_ATTR: ['href']
        }) as Node;
        bodyDiv.appendChild(cleanFrag);
        
        article.appendChild(titleDiv);
        article.appendChild(bodyDiv);
        
        if (note.avatar) {
          if (note.avatar.startsWith('http://') || note.avatar.startsWith('https://') || note.avatar.startsWith('data:image/')) {
            const img = document.createElement('img');
            img.className = 'note-avatar';
            img.src = note.avatar;
            article.appendChild(img);
          }
        }
        
        feedSection.appendChild(article);
      }
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const nextId = notes.length > 0 ? Math.max(...notes.map((n: Note) => n.id)) + 1 : 1;
      const newNote: Note = {
        id: nextId,
        title: titleInput.value,
        body: bodyTextarea.value,
        avatar: avatarInput.value,
        createdAt: new Date().toISOString()
      };
      notes.push(newNote);
      saveNotes(notes);
      
      titleInput.value = '';
      bodyTextarea.value = '';
      avatarInput.value = '';
      
      render();
    });

    searchInput.addEventListener('input', () => {
      const current = parseFragment();
      updateFragment(searchInput.value, current.note);
      render();
    });

    window.addEventListener('hashchange', () => {
      const current = parseFragment();
      if (searchInput.value !== current.q) {
          searchInput.value = current.q;
      }
      render();
    });

    const initialHash = parseFragment();
    if (initialHash.q) {
        searchInput.value = initialHash.q;
    }
    render();
}
