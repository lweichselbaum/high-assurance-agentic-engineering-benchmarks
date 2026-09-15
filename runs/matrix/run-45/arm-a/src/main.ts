import './style.css';
import { Note, UrlState } from './types';
import { getStoredNotes, addNote, sortNotesNewestFirst } from './storage';
import { renderRichText, matchNote } from './sanitize';
import { parseFragment, syncUrlFragment } from './router';

// Application state
let currentQuery = '';
let selectedNoteId: number | null = null;

// DOM Elements
let noteForm: HTMLFormElement;
let titleInput: HTMLInputElement;
let bodyInput: HTMLTextAreaElement;
let avatarInput: HTMLInputElement;
let searchInput: HTMLInputElement;
let searchClearBtn: HTMLButtonElement | null;
let resultsLine: HTMLElement;
let feedEl: HTMLElement;
let notesCountEl: HTMLElement | null;

/**
 * Formats ISO date string into human-readable date.
 */
function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return '';
    }
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return '';
  }
}

/**
 * Updates the results line text according to current query state.
 */
function updateResultsLine(): void {
  if (resultsLine) {
    if (currentQuery.length > 0) {
      resultsLine.textContent = `results for "${currentQuery}"`;
    } else {
      resultsLine.textContent = '';
    }
  }

  if (searchClearBtn) {
    searchClearBtn.hidden = currentQuery.length === 0;
  }
}

/**
 * Updates aria-current attribute on note articles in the feed.
 */
function updateSelectionInDOM(): void {
  if (!feedEl) return;
  const articles = feedEl.querySelectorAll<HTMLElement>('article.note');
  articles.forEach((article) => {
    if (article.dataset.noteId === String(selectedNoteId)) {
      article.setAttribute('aria-current', 'true');
    } else {
      article.removeAttribute('aria-current');
    }
  });
}

/**
 * Selects a note by ID and synchronizes URL fragment.
 */
function selectNote(noteId: number): void {
  selectedNoteId = noteId;
  updateSelectionInDOM();
  syncUrlFragment({ query: currentQuery, noteId: selectedNoteId });
}

/**
 * Renders the notes feed based on current query and selection.
 */
function renderFeed(): void {
  if (!feedEl) return;

  const allNotes = getStoredNotes();
  const sortedNotes = sortNotesNewestFirst(allNotes);
  const matchingNotes = sortedNotes.filter((note) => matchNote(note, currentQuery));

  // Update notes count badge
  if (notesCountEl) {
    const total = matchingNotes.length;
    notesCountEl.textContent = `${total} note${total === 1 ? '' : 's'}`;
  }

  feedEl.replaceChildren();

  if (matchingNotes.length === 0) {
    const emptyEl = document.createElement('div');
    emptyEl.className = 'empty-state';

    const titleEl = document.createElement('p');
    titleEl.className = 'empty-state-title';
    titleEl.textContent = currentQuery ? 'No matching notes' : 'No notes yet';

    const descEl = document.createElement('p');
    descEl.className = 'empty-state-desc';
    descEl.textContent = currentQuery
      ? `No notes matched "${currentQuery}". Try another search term.`
      : 'Create the first note using the form on the left!';

    emptyEl.appendChild(titleEl);
    emptyEl.appendChild(descEl);
    feedEl.appendChild(emptyEl);
    return;
  }

  matchingNotes.forEach((note) => {
    const article = document.createElement('article');
    article.className = 'note';
    article.dataset.noteId = String(note.id);

    if (note.id === selectedNoteId) {
      article.setAttribute('aria-current', 'true');
    }

    const header = document.createElement('div');
    header.className = 'note-header';

    // Optional avatar
    if (note.avatar && note.avatar.trim()) {
      const img = document.createElement('img');
      img.className = 'note-avatar';
      img.src = note.avatar.trim();
      img.alt = 'Author avatar';
      img.loading = 'lazy';
      img.onerror = () => {
        img.style.display = 'none';
      };
      header.appendChild(img);
    }

    const headerDetails = document.createElement('div');
    headerDetails.className = 'note-header-details';

    // Title (clickable for note selection)
    const title = document.createElement('h3');
    title.className = 'note-title';
    title.tabIndex = 0;
    title.setAttribute('role', 'button');
    title.setAttribute('title', 'Click to select note');
    renderRichText(title, note.title);

    title.addEventListener('click', (e) => {
      e.stopPropagation();
      selectNote(note.id);
    });

    title.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectNote(note.id);
      }
    });

    headerDetails.appendChild(title);

    if (note.createdAt) {
      const meta = document.createElement('div');
      meta.className = 'note-meta';
      const timeEl = document.createElement('time');
      timeEl.dateTime = note.createdAt;
      timeEl.textContent = formatDate(note.createdAt);
      meta.appendChild(timeEl);
      headerDetails.appendChild(meta);
    }

    header.appendChild(headerDetails);
    article.appendChild(header);

    // Body with rich text
    const body = document.createElement('div');
    body.className = 'note-body';
    renderRichText(body, note.body);
    article.appendChild(body);

    feedEl.appendChild(article);
  });
}

/**
 * Handles search query changes.
 */
function handleSearchInput(): void {
  currentQuery = searchInput.value;
  updateResultsLine();
  renderFeed();
  syncUrlFragment({ query: currentQuery, noteId: selectedNoteId });
}

/**
 * Handles form submission to add a new note.
 */
function handleFormSubmit(event: Event): void {
  event.preventDefault();

  const titleVal = titleInput.value.trim();
  const bodyVal = bodyInput.value;
  const avatarVal = avatarInput.value.trim();

  // Basic validation: must have at least title or body
  if (!titleVal && !bodyVal.trim()) {
    titleInput.focus();
    return;
  }

  addNote({
    title: titleVal,
    body: bodyVal,
    avatar: avatarVal,
  });

  // Clear form
  titleInput.value = '';
  bodyInput.value = '';
  avatarInput.value = '';

  // Render updated feed
  renderFeed();
}

/**
 * Synchronizes application state from URL fragment.
 */
function applyFragmentState(): void {
  const state: UrlState = parseFragment(window.location.hash);
  currentQuery = state.query;
  selectedNoteId = state.noteId;

  if (searchInput) {
    searchInput.value = currentQuery;
  }

  updateResultsLine();
  renderFeed();
}

/**
 * Initializes application.
 */
function init(): void {
  noteForm = document.getElementById('note-form') as HTMLFormElement;
  titleInput = document.getElementById('title') as HTMLInputElement;
  bodyInput = document.getElementById('body') as HTMLTextAreaElement;
  avatarInput = document.getElementById('avatar') as HTMLInputElement;
  searchInput = document.getElementById('search') as HTMLInputElement;
  searchClearBtn = document.getElementById('search-clear') as HTMLButtonElement | null;
  resultsLine = document.getElementById('results-line') as HTMLElement;
  feedEl = document.getElementById('feed') as HTMLElement;
  notesCountEl = document.getElementById('notes-count') as HTMLElement | null;

  // Event listeners
  if (noteForm) {
    noteForm.addEventListener('submit', handleFormSubmit);
  }

  if (searchInput) {
    searchInput.addEventListener('input', handleSearchInput);
  }

  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      searchInput.value = '';
      handleSearchInput();
      searchInput.focus();
    });
  }

  // Handle hash changes (back/forward navigation or manual URL updates)
  window.addEventListener('hashchange', applyFragmentState);
  window.addEventListener('popstate', applyFragmentState);

  // Restore initial state from URL fragment
  applyFragmentState();
}

// Start application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
