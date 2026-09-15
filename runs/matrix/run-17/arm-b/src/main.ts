// Porto Notes — implement the app here (see CLAUDE.md). This file is loaded by harness/entry.ts.

import fixtures from './fixtures.json';
import { setElementInnerHtml } from 'safevalues/dom';
import { sanitizeHtml } from 'safevalues';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto-notes';
let notes: Note[] = [];
let nextId = 1;
let currentQuery = '';
let selectedNoteId: number | null = null;

// Load notes from localStorage or seed with fixtures
function loadNotes(): void {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    notes = JSON.parse(stored);
    nextId = notes.length > 0 ? Math.max(...notes.map(n => n.id)) + 1 : 1;
  } else {
    notes = fixtures as Note[];
    nextId = notes.length > 0 ? Math.max(...notes.map(n => n.id)) + 1 : 1;
    saveNotes();
  }
}

// Save notes to localStorage
function saveNotes(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

// Parse URL fragment
function parseFragment(): { query: string; noteId: number | null } {
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash);
  const query = params.get('q') || '';
  const noteId = params.get('note') ? parseInt(params.get('note')!, 10) : null;
  return { query, noteId };
}

// Update URL fragment
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

// Prepare rich text HTML (newlines become <br>)
function prepareRichTextHtml(text: string): string {
  // Convert newlines to <br>
  return text.replace(/\n/g, '<br>');
}

// Render a single note
function renderNote(note: Note): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.dataset.noteId = note.id.toString();

  if (selectedNoteId === note.id) {
    article.setAttribute('aria-current', 'true');
  }

  const title = document.createElement('h2');
  title.className = 'note-title';
  title.textContent = note.title;
  title.addEventListener('click', () => {
    selectedNoteId = note.id;
    updateFragment();
    renderFeed();
  });

  const body = document.createElement('div');
  body.className = 'note-body';
  const html = prepareRichTextHtml(note.body);
  setElementInnerHtml(body, sanitizeHtml(html));

  article.appendChild(title);
  article.appendChild(body);

  if (note.avatar) {
    const avatar = document.createElement('img');
    avatar.className = 'note-avatar';
    avatar.src = note.avatar;
    avatar.alt = 'Avatar';
    article.insertBefore(avatar, title);
  }

  return article;
}

// Filter notes by query
function filterNotes(): Note[] {
  if (!currentQuery) {
    return notes;
  }
  const query = currentQuery.toLowerCase();
  return notes.filter(note =>
    note.title.toLowerCase().includes(query) ||
    note.body.toLowerCase().includes(query)
  );
}

// Render the feed
function renderFeed(): void {
  const feed = document.getElementById('feed')!;
  feed.replaceChildren();

  const filtered = filterNotes();
  // Render newest-first
  const sorted = [...filtered].reverse();

  sorted.forEach(note => {
    feed.appendChild(renderNote(note));
  });

  // Update results line
  const resultsLine = document.getElementById('results-line')!;
  if (currentQuery) {
    resultsLine.textContent = `results for "${currentQuery}"`;
  } else {
    resultsLine.textContent = '';
  }
}

// Handle form submission
function handleSubmit(e: Event): void {
  e.preventDefault();

  const form = e.target as HTMLFormElement;
  const titleInput = form.querySelector('#title') as HTMLInputElement;
  const bodyInput = form.querySelector('#body') as HTMLTextAreaElement;
  const avatarInput = form.querySelector('#avatar') as HTMLInputElement;

  const note: Note = {
    id: nextId++,
    title: titleInput.value,
    body: bodyInput.value,
    avatar: avatarInput.value,
    createdAt: new Date().toISOString()
  };

  notes.push(note);
  saveNotes();

  form.reset();
  renderFeed();
}

// Handle search input
function handleSearch(e: Event): void {
  const input = e.target as HTMLInputElement;
  currentQuery = input.value;
  updateFragment();
  renderFeed();
}

// Initialize the app
function init(): void {
  loadNotes();

  // Parse initial fragment
  const { query, noteId } = parseFragment();
  currentQuery = query;
  selectedNoteId = noteId;

  // Set search input value
  const searchInput = document.getElementById('search') as HTMLInputElement;
  searchInput.value = currentQuery;

  // Render initial feed
  renderFeed();

  // Attach event listeners
  const form = document.getElementById('note-form')!;
  form.addEventListener('submit', handleSubmit);

  searchInput.addEventListener('input', handleSearch);

  // Handle hash change
  window.addEventListener('hashchange', () => {
    const { query, noteId } = parseFragment();
    currentQuery = query;
    selectedNoteId = noteId;
    searchInput.value = currentQuery;
    renderFeed();
  });
}

// Start the app
init();

export {};
