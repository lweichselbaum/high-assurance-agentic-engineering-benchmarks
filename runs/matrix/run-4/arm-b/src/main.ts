// Porto Notes — implement the app here (see CLAUDE.md). This file is loaded by harness/entry.ts.
import './style.css';
import type { Note } from './types';
import { loadNotes, saveNotes } from './storage';
import { renderFeed } from './render';
import { parseFragment, writeFragment } from './fragment';

const form = document.getElementById('note-form') as HTMLFormElement;
const titleInput = document.getElementById('title') as HTMLInputElement;
const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
const avatarInput = document.getElementById('avatar') as HTMLInputElement;
const searchInput = document.getElementById('search') as HTMLInputElement;
const resultsLine = document.getElementById('results-line') as HTMLParagraphElement;
const feed = document.getElementById('feed') as HTMLElement;

let notes: Note[] = loadNotes();
let query = '';
let selectedId: number | null = null;

function nextId(): number {
  return notes.reduce((max, n) => Math.max(max, n.id), 0) + 1;
}

function sortedNotes(): Note[] {
  return [...notes].sort((a, b) => {
    const byDate = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return byDate !== 0 ? byDate : b.id - a.id;
  });
}

function render(): void {
  const q = query.trim();
  resultsLine.textContent = q ? `results for "${q}"` : '';
  const needle = q.toLowerCase();
  const list = sortedNotes().filter(
    (note) => !needle || note.title.toLowerCase().includes(needle) || note.body.toLowerCase().includes(needle),
  );
  renderFeed(feed, list, selectedId, selectNote);
}

function selectNote(id: number): void {
  selectedId = id;
  writeFragment({ q: query.trim(), note: selectedId });
  render();
}

searchInput.addEventListener('input', () => {
  query = searchInput.value;
  writeFragment({ q: query.trim(), note: selectedId });
  render();
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  if (!title || !body) return;
  const note: Note = {
    id: nextId(),
    title,
    body,
    avatar: avatarInput.value.trim(),
    createdAt: new Date().toISOString(),
  };
  notes = [...notes, note];
  saveNotes(notes);
  form.reset();
  render();
});

function applyFragment(): void {
  const frag = parseFragment();
  query = frag.q;
  searchInput.value = frag.q;
  selectedId = frag.note;
  render();
}

window.addEventListener('hashchange', applyFragment);
applyFragment();
