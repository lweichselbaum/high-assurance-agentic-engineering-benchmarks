import "./style.css";
import fixtures from "./fixtures.json";

interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

const STORAGE_KEY = "porto-notes";

// ---- sanitizing / rich text ----------------------------------------------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeHref(href: string): string | null {
  const trimmed = href.trim();
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return null;
  return href;
}

/**
 * Body/title are typed as plain text that may contain a small allow-list of
 * inline tags (b, strong, i, em, a[href], br) plus literal newlines as line
 * breaks. Escape everything, then selectively re-enable only that allow-list.
 */
function sanitizeRichText(raw: string): string {
  let out = escapeHtml(raw);

  out = out.replace(/&lt;br\s*\/?&gt;/gi, "<br>");
  out = out.replace(/&lt;(\/?)(b|strong|i|em)&gt;/gi, (_m, close, tag) => `<${close}${String(tag).toLowerCase()}>`);
  out = out.replace(/&lt;a\s+href=&quot;([\s\S]*?)&quot;\s*&gt;/gi, (_m, href) => {
    const safe = sanitizeHref(href);
    return safe ? `<a href="${safe}" target="_blank" rel="noopener noreferrer">` : "";
  });
  out = out.replace(/&lt;\/a&gt;/gi, "</a>");

  out = out.replace(/\r\n|\r|\n/g, "<br>");
  return out;
}

function stripTags(raw: string): string {
  return raw.replace(/<[^>]*>/g, " ");
}

// ---- storage --------------------------------------------------------------

function loadNotes(): Note[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed as Note[];
    } catch {
      // fall through to seed
    }
  }
  return fixtures as Note[];
}

function saveNotes(notes: Note[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function nextId(notes: Note[]): number {
  return notes.reduce((max, n) => Math.max(max, n.id), 0) + 1;
}

// ---- url fragment -----------------------------------------------------

interface HashState {
  query: string;
  noteId: number | null;
}

function parseHash(): HashState {
  const raw = location.hash.replace(/^#/, "");
  const params = new URLSearchParams(raw);
  const q = params.get("q") ?? "";
  const noteParam = params.get("note");
  const noteId = noteParam !== null && /^\d+$/.test(noteParam) ? Number(noteParam) : null;
  return { query: q, noteId };
}

function writeHash(state: HashState): void {
  const parts: string[] = [];
  if (state.query) parts.push(`q=${encodeURIComponent(state.query)}`);
  if (state.noteId !== null) parts.push(`note=${state.noteId}`);
  const newHash = parts.length ? `#${parts.join("&")}` : "";
  const current = location.hash;
  if (current === newHash || (current === "" && newHash === "") ) return;
  const url = `${location.pathname}${location.search}${newHash}`;
  history.replaceState(null, "", url);
}

// ---- app state --------------------------------------------------------

let notes: Note[] = loadNotes();
const initialHash = parseHash();
let query = initialHash.query;
let selectedNoteId: number | null = initialHash.noteId;

// persist the seed on first load so ids continue the sequence deterministically
if (!localStorage.getItem(STORAGE_KEY)) {
  saveNotes(notes);
}

// ---- DOM scaffold -------------------------------------------------------

const app = document.getElementById("app")!;
app.innerHTML = `
  <h1>Porto Notes</h1>
  <form id="note-form">
    <label for="title">Title</label>
    <input id="title" name="title" type="text" required />
    <label for="body">Body</label>
    <textarea id="body" name="body" required></textarea>
    <label for="avatar">Avatar URL (optional)</label>
    <input id="avatar" name="avatar" type="text" placeholder="https://…" />
    <button type="submit">Add note</button>
  </form>
  <div class="search-wrap">
    <label for="search">Search notes</label>
    <input id="search" type="search" placeholder="Search notes…" autocomplete="off" />
    <p id="results-line" aria-live="polite"></p>
  </div>
  <section id="feed" aria-live="polite"></section>
`;

const form = document.getElementById("note-form") as HTMLFormElement;
const titleInput = document.getElementById("title") as HTMLInputElement;
const bodyInput = document.getElementById("body") as HTMLTextAreaElement;
const avatarInput = document.getElementById("avatar") as HTMLInputElement;
const searchInput = document.getElementById("search") as HTMLInputElement;
const resultsLine = document.getElementById("results-line")!;
const feed = document.getElementById("feed")!;

searchInput.value = query;

// ---- rendering ----------------------------------------------------------

function renderNote(note: Note): string {
  const selected = note.id === selectedNoteId;
  const avatarHtml = note.avatar
    ? `<img class="note-avatar" src="${escapeHtml(note.avatar)}" alt="" />`
    : "";
  const date = new Date(note.createdAt);
  const dateLabel = Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
  return `
    <article class="note" data-note-id="${note.id}"${selected ? ' aria-current="true"' : ""}>
      ${avatarHtml}
      <h3 class="note-title" tabindex="0" role="button" aria-pressed="${selected}">${sanitizeRichText(note.title)}</h3>
      <div class="note-body">${sanitizeRichText(note.body)}</div>
      ${dateLabel ? `<time class="note-time" datetime="${note.createdAt}">${escapeHtml(dateLabel)}</time>` : ""}
    </article>
  `;
}

function render(): void {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? notes.filter((n) => stripTags(n.title).toLowerCase().includes(q) || stripTags(n.body).toLowerCase().includes(q))
    : notes;

  const sorted = [...filtered].sort((a, b) => b.id - a.id);

  resultsLine.textContent = q ? `results for "${query.trim()}"` : "";

  feed.innerHTML = sorted.length
    ? sorted.map(renderNote).join("")
    : `<p class="empty-state">No notes found.</p>`;
}

render();

// ---- events ---------------------------------------------------------------

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  if (!title || !body) return;

  const note: Note = {
    id: nextId(notes),
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

searchInput.addEventListener("input", () => {
  query = searchInput.value;
  writeHash({ query, noteId: selectedNoteId });
  render();
});

function selectNote(id: number): void {
  selectedNoteId = id;
  writeHash({ query, noteId: selectedNoteId });
  render();
}

feed.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  const titleEl = target.closest(".note-title");
  if (!titleEl) return;
  const article = titleEl.closest(".note") as HTMLElement | null;
  if (!article) return;
  const id = Number(article.dataset.noteId);
  if (!Number.isNaN(id)) selectNote(id);
});

feed.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const target = e.target as HTMLElement;
  const titleEl = target.closest(".note-title");
  if (!titleEl) return;
  e.preventDefault();
  const article = titleEl.closest(".note") as HTMLElement | null;
  if (!article) return;
  const id = Number(article.dataset.noteId);
  if (!Number.isNaN(id)) selectNote(id);
});

window.addEventListener("hashchange", () => {
  const state = parseHash();
  query = state.query;
  selectedNoteId = state.noteId;
  searchInput.value = query;
  render();
});
