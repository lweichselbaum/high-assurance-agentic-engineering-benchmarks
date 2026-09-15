// Porto Notes — implement the app here (see CLAUDE.md). This file is loaded by harness/entry.ts.

import { setAnchorHref } from 'safevalues/dom';
import fixturesData from '../fixtures.json';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

const STORAGE_KEY = 'porto-notes';
let notes: Note[] = [];
let currentQuery = '';
let selectedNoteId: number | null = null;

// Load notes from localStorage or seed with fixtures
function loadNotes(): void {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    notes = JSON.parse(stored);
  } else {
    // Load fixtures on first run
    notes = fixturesData as Note[];
    saveNotes();
  }
}

// Save notes to localStorage
function saveNotes(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

// Parse and render rich text safely without innerHTML
function parseRichText(text: string): Node[] {
  const result: Node[] = [];
  let pos = 0;

  while (pos < text.length) {
    // Find next tag
    const tagStart = text.indexOf('<', pos);

    if (tagStart === -1) {
      // No more tags, add remaining text
      const remaining = text.substring(pos);
      if (remaining) {
        // Convert newlines to <br>
        const parts = remaining.split('\n');
        parts.forEach((part, i) => {
          if (part) {
            result.push(document.createTextNode(part));
          }
          if (i < parts.length - 1) {
            result.push(document.createElement('br'));
          }
        });
      }
      break;
    }

    // Add text before tag
    if (tagStart > pos) {
      const textBefore = text.substring(pos, tagStart);
      const parts = textBefore.split('\n');
      parts.forEach((part, i) => {
        if (part) {
          result.push(document.createTextNode(part));
        }
        if (i < parts.length - 1) {
          result.push(document.createElement('br'));
        }
      });
    }

    // Find tag end
    const tagEnd = text.indexOf('>', tagStart);
    if (tagEnd === -1) {
      // Malformed, treat as text
      result.push(document.createTextNode(text.substring(tagStart)));
      break;
    }

    const tagContent = text.substring(tagStart + 1, tagEnd);

    // Check if it's a closing tag
    if (tagContent.startsWith('/')) {
      pos = tagEnd + 1;
      continue;
    }

    // Check if it's <br>
    if (tagContent === 'br') {
      result.push(document.createElement('br'));
      pos = tagEnd + 1;
      continue;
    }

    // Parse opening tag
    const spaceIdx = tagContent.indexOf(' ');
    const tagName = spaceIdx === -1 ? tagContent : tagContent.substring(0, spaceIdx);

    // Only allow specific tags
    if (['b', 'strong', 'i', 'em', 'a'].includes(tagName)) {
      // Find closing tag
      const closingTag = `</${tagName}>`;
      const closeIdx = text.indexOf(closingTag, tagEnd + 1);

      if (closeIdx !== -1) {
        const innerText = text.substring(tagEnd + 1, closeIdx);
        const element = document.createElement(tagName);

        // For <a> tags, extract href
        if (tagName === 'a') {
          const hrefMatch = tagContent.match(/href=["']([^"']*)["']/);
          if (hrefMatch && hrefMatch[1] !== undefined) {
            setAnchorHref(element as HTMLAnchorElement, hrefMatch[1]);
          }
        }

        // Recursively parse inner content
        const innerNodes = parseRichText(innerText);
        innerNodes.forEach(node => element.appendChild(node));

        result.push(element);
        pos = closeIdx + closingTag.length;
        continue;
      }
    }

    // Invalid or disallowed tag, treat as text
    result.push(document.createTextNode('<'));
    pos = tagStart + 1;
  }

  return result;
}

// Parse URL fragment
function parseFragment(): { query: string; noteId: number | null } {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  const noteParam = params.get('note');
  return {
    query: params.get('q') || '',
    noteId: noteParam ? parseInt(noteParam, 10) : null
  };
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
  window.location.hash = hash ? `#${hash}` : '';
}

// Filter notes by query
function filterNotes(): Note[] {
  if (!currentQuery) {
    return notes;
  }
  const lowerQuery = currentQuery.toLowerCase();
  return notes.filter(note =>
    note.title.toLowerCase().includes(lowerQuery) ||
    note.body.toLowerCase().includes(lowerQuery)
  );
}

// Render the feed
function renderFeed(): void {
  const feed = document.getElementById('feed')!;
  const filtered = filterNotes();

  // Sort by newest first (highest id first, as new notes continue the sequence)
  const sorted = [...filtered].sort((a, b) => b.id - a.id);

  // Clear feed safely
  while (feed.firstChild) {
    feed.removeChild(feed.firstChild);
  }

  sorted.forEach(note => {
    const article = document.createElement('article');
    article.className = 'note';
    article.setAttribute('data-note-id', note.id.toString());

    if (note.id === selectedNoteId) {
      article.setAttribute('aria-current', 'true');
    }

    const title = document.createElement('h2');
    title.className = 'note-title';
    title.textContent = note.title;
    title.addEventListener('click', () => selectNote(note.id));

    const body = document.createElement('div');
    body.className = 'note-body';
    // Parse and append rich text nodes
    const richTextNodes = parseRichText(note.body);
    richTextNodes.forEach(node => body.appendChild(node));

    article.appendChild(title);
    article.appendChild(body);

    if (note.avatar) {
      const avatar = document.createElement('img');
      avatar.className = 'note-avatar';
      avatar.src = note.avatar;
      avatar.alt = 'Avatar';
      article.appendChild(avatar);
    }

    feed.appendChild(article);
  });
}

// Select a note
function selectNote(id: number): void {
  selectedNoteId = id;
  updateFragment();
  renderFeed();
}

// Update results line
function updateResultsLine(): void {
  const resultsLine = document.getElementById('results-line')!;
  if (currentQuery) {
    resultsLine.textContent = `results for "${currentQuery}"`;
  } else {
    resultsLine.textContent = '';
  }
}

// Handle form submission
function handleFormSubmit(e: Event): void {
  e.preventDefault();

  const form = e.target as HTMLFormElement;
  const titleInput = document.getElementById('title') as HTMLInputElement;
  const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
  const avatarInput = document.getElementById('avatar') as HTMLInputElement;

  const newNote: Note = {
    id: notes.length > 0 ? Math.max(...notes.map(n => n.id)) + 1 : 1,
    title: titleInput.value,
    body: bodyInput.value,
    avatar: avatarInput.value,
    createdAt: new Date().toISOString()
  };

  notes.push(newNote);
  saveNotes();

  form.reset();
  renderFeed();
}

// Handle search input
function handleSearch(e: Event): void {
  const input = e.target as HTMLInputElement;
  currentQuery = input.value;
  updateFragment();
  updateResultsLine();
  renderFeed();
}

// Initialize app
function init(): void {
  loadNotes();

  // Parse fragment and restore state
  const fragment = parseFragment();
  currentQuery = fragment.query;
  selectedNoteId = fragment.noteId;

  // Set search input value
  const searchInput = document.getElementById('search') as HTMLInputElement;
  searchInput.value = currentQuery;

  // Attach event listeners
  const form = document.getElementById('note-form')!;
  form.addEventListener('submit', handleFormSubmit);

  searchInput.addEventListener('input', handleSearch);

  // Handle fragment changes
  window.addEventListener('hashchange', () => {
    const fragment = parseFragment();
    currentQuery = fragment.query;
    selectedNoteId = fragment.noteId;
    searchInput.value = currentQuery;
    updateResultsLine();
    renderFeed();
  });

  // Initial render
  updateResultsLine();
  renderFeed();
}

// Start the app
init();

export {};
