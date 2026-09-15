import { sanitizeHtml } from 'safevalues';
import { setElementInnerHtml } from 'safevalues/dom';
import fixtures from '../fixtures.json';
import './style.css';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar?: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto_notes';
let notes: Note[] = [];
let query: string = '';
let selectedNoteId: number | null = null;
let nextId = 1;

function loadNotes() {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) {
        notes = fixtures as Note[];
        saveNotes();
    } else {
        notes = JSON.parse(json);
    }
    const maxId = notes.reduce((max, n) => Math.max(max, n.id), 0);
    nextId = maxId + 1;
}

function saveNotes() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function parseHash() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    query = params.get('q') || '';
    const noteIdStr = params.get('note');
    selectedNoteId = noteIdStr ? parseInt(noteIdStr, 10) : null;
}

function updateHash() {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (selectedNoteId) params.set('note', String(selectedNoteId));
    const h = params.toString();
    history.replaceState(null, '', h ? `#${h}` : window.location.pathname);
}

function renderFeed() {
    const feed = document.getElementById('feed')!;
    feed.textContent = '';
    
    const resultsLine = document.getElementById('results-line')!;
    if (query) {
        resultsLine.textContent = `results for "${query}"`;
    } else {
        resultsLine.textContent = '';
    }

    const searchInput = document.getElementById('search') as HTMLInputElement;
    if (searchInput.value !== query) {
        searchInput.value = query;
    }

    let filtered = notes.slice().reverse();
    if (query) {
        const q = query.toLowerCase();
        filtered = filtered.filter(n => 
            n.title.toLowerCase().includes(q) || 
            n.body.toLowerCase().includes(q)
        );
    }

    for (const n of filtered) {
        const article = document.createElement('article');
        article.className = 'note';
        article.setAttribute('data-note-id', String(n.id));
        if (n.id === selectedNoteId) {
            article.setAttribute('aria-current', 'true');
        }

        const titleDiv = document.createElement('div');
        titleDiv.className = 'note-title';
        setElementInnerHtml(titleDiv, sanitizeHtml(n.title));
        
        titleDiv.addEventListener('click', () => {
            selectedNoteId = n.id;
            updateHash();
            renderFeed();
        });

        const bodyDiv = document.createElement('div');
        bodyDiv.className = 'note-body';
        setElementInnerHtml(bodyDiv, sanitizeHtml(n.body));

        article.appendChild(titleDiv);
        article.appendChild(bodyDiv);

        if (n.avatar && /^(https?|data:image\/)/i.test(n.avatar)) {
            const img = document.createElement('img');
            img.className = 'note-avatar';
            img.src = n.avatar;
            article.insertBefore(img, article.firstChild);
        }

        feed.appendChild(article);
    }
}

function init() {
    loadNotes();
    parseHash();

    const form = document.getElementById('note-form') as HTMLFormElement;
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const titleEl = document.getElementById('title') as HTMLInputElement;
        const bodyEl = document.getElementById('body') as HTMLTextAreaElement;
        const avatarEl = document.getElementById('avatar') as HTMLInputElement;

        const bodyHtml = bodyEl.value.replace(/\n/g, '<br>');
        
        const note: Note = {
            id: nextId++,
            title: titleEl.value,
            body: bodyHtml,
            avatar: avatarEl.value.trim(),
            createdAt: new Date().toISOString()
        };

        notes.push(note);
        saveNotes();
        form.reset();
        renderFeed();
    });

    const searchInput = document.getElementById('search') as HTMLInputElement;
    searchInput.addEventListener('input', () => {
        query = searchInput.value;
        updateHash();
        renderFeed();
    });

    window.addEventListener('hashchange', () => {
        parseHash();
        renderFeed();
    });

    renderFeed();
}

init();
