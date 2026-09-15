/**
 * Porto Notes — a shared notes board. Loaded by harness/entry.ts, after the Trusted Types
 * boundary is installed.
 *
 * Everything on screen is a function of `state`; the URL fragment and localStorage are the two
 * places it is mirrored to.
 */
import './style.css';
import { matchesQuery, renderNote } from './feed';
import { parseFragment, syncFragment } from './hash';
import { loadNotes, nextId, saveNotes } from './storage';
import type { AppState, Note } from './types';

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`Porto Notes: index.html is missing ${selector}`);
  return element;
}

const form = requireElement<HTMLFormElement>('#note-form');
const titleInput = requireElement<HTMLInputElement>('#title');
const bodyInput = requireElement<HTMLTextAreaElement>('#body');
const avatarInput = requireElement<HTMLInputElement>('#avatar');
const searchInput = requireElement<HTMLInputElement>('#search');
const resultsLine = requireElement<HTMLParagraphElement>('#results-line');
const feed = requireElement<HTMLElement>('#feed');

const state: AppState = { notes: [], query: '', selectedId: null };

/** Newest first. Ids continue the sequence, so the highest id is the newest note. */
function visibleNotes(): Note[] {
  return state.notes.filter((note) => matchesQuery(note, state.query)).sort((a, b) => b.id - a.id);
}

/** Marks the selected article without rebuilding the feed, so keyboard focus survives selection. */
function paintSelection(): void {
  for (const article of feed.querySelectorAll('.note')) {
    const id = article.getAttribute('data-note-id');
    if (id !== null && Number.parseInt(id, 10) === state.selectedId) {
      article.setAttribute('aria-current', 'true');
    } else {
      article.removeAttribute('aria-current');
    }
  }
}

function render(): void {
  const active = state.query.trim() !== '';
  resultsLine.textContent = active ? `results for "${state.query}"` : '';

  const notes = visibleNotes();
  const children: Node[] = notes.map((note) => renderNote(note, note.id === state.selectedId));

  if (notes.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'feed-empty';
    empty.textContent = active ? 'No notes match this search.' : 'No notes yet — add the first one.';
    children.push(empty);
  }

  feed.replaceChildren(...children);
}

/** Reads the fragment into the state: the deep-link restore path, on load and on hashchange. */
function applyFragment(): void {
  const fragment = parseFragment(location.hash);
  state.query = fragment.query;
  state.selectedId = fragment.selectedId;
  searchInput.value = fragment.query;
  render();
}

searchInput.addEventListener('input', () => {
  state.query = searchInput.value;
  syncFragment(state);
  render();
});

// Delegated: clicking a note's title selects it. Clicks inside a note body (a link, say) are
// deliberately not a selection.
feed.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const article = target.closest('.note-title')?.closest('.note');
  const id = article?.getAttribute('data-note-id');
  if (id === undefined || id === null) return;
  const parsed = Number.parseInt(id, 10);
  if (!Number.isInteger(parsed)) return;

  state.selectedId = parsed;
  syncFragment(state);
  paintSelection();
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value;
  if (title === '' && body.trim() === '') return;

  state.notes.push({
    id: nextId(state.notes),
    title,
    body,
    avatar: avatarInput.value.trim(),
    createdAt: new Date().toISOString(),
  });
  saveNotes(state.notes);

  form.reset();
  render();
  titleInput.focus();
});

window.addEventListener('hashchange', applyFragment);

state.notes = loadNotes();
applyFragment();
