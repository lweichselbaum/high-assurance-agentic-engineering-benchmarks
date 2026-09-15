interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

let notes: Note[] = [];
let selectedNoteId: number | null = null;
let searchQuery = "";

const STORAGE_KEY = "porto-notes";

async function loadFixtures(): Promise<Note[]> {
  const response = await fetch("/fixtures.json");
  return response.json();
}

function initializeNotes(): void {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    notes = JSON.parse(stored);
  } else {
    loadFixtures().then((fixtures) => {
      notes = fixtures;
      saveNotes();
      renderFeed();
      restoreFromFragment();
    });
  }
}

function saveNotes(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function getNextNoteId(): number {
  return notes.length > 0 ? Math.max(...notes.map((n) => n.id)) + 1 : 1;
}

function renderRichText(html: string): string {
  return html
    .replace(/&lt;b&gt;/g, "<b>")
    .replace(/&lt;\/b&gt;/g, "</b>")
    .replace(/&lt;strong&gt;/g, "<strong>")
    .replace(/&lt;\/strong&gt;/g, "</strong>")
    .replace(/&lt;i&gt;/g, "<i>")
    .replace(/&lt;\/i&gt;/g, "</i>")
    .replace(/&lt;em&gt;/g, "<em>")
    .replace(/&lt;\/em&gt;/g, "</em>")
    .replace(/&lt;br&gt;/g, "<br>")
    .replace(/&lt;br\/&gt;/g, "<br>")
    .replace(/&lt;a href="([^"]*)"&gt;/g, '<a href="$1">')
    .replace(/&lt;\/a&gt;/g, "</a>");
}

function sanitizeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function parseRichText(body: string): string {
  // Split by newlines, convert to <br>, then process tags
  const lines = body.split("\n");
  let html = lines.map((line) => sanitizeHtml(line)).join("<br>");

  // Replace escaped HTML tags with actual tags
  html = html
    .replace(/&lt;b&gt;/g, "<b>")
    .replace(/&lt;\/b&gt;/g, "</b>")
    .replace(/&lt;strong&gt;/g, "<strong>")
    .replace(/&lt;\/strong&gt;/g, "</strong>")
    .replace(/&lt;i&gt;/g, "<i>")
    .replace(/&lt;\/i&gt;/g, "</i>")
    .replace(/&lt;em&gt;/g, "<em>")
    .replace(/&lt;\/em&gt;/g, "</em>")
    .replace(/&lt;br&gt;/g, "<br>")
    .replace(/&lt;br\/&gt;/g, "<br>")
    .replace(/&lt;a href="([^"]*)"&gt;/g, '<a href="$1">')
    .replace(/&lt;\/a&gt;/g, "</a>");

  return html;
}

function renderFeed(): void {
  const feed = document.getElementById("feed")!;
  const query = searchQuery.toLowerCase();

  const filtered = notes.filter(
    (note) =>
      note.title.toLowerCase().includes(query) ||
      note.body.toLowerCase().includes(query)
  );

  // Sort by date descending (newest first)
  filtered.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  feed.innerHTML = filtered
    .map(
      (note) => `
    <article class="note" data-note-id="${note.id}" ${
        selectedNoteId === note.id ? 'aria-current="true"' : ""
      }>
      <div class="note-header">
        ${
          note.avatar
            ? `<img class="note-avatar" src="${note.avatar}" alt="" />`
            : ""
        }
        <h2 class="note-title">${sanitizeHtml(note.title)}</h2>
      </div>
      <div class="note-body">${parseRichText(note.body)}</div>
    </article>
  `
    )
    .join("");

  // Add click handlers
  feed.querySelectorAll(".note").forEach((noteEl) => {
    noteEl.addEventListener("click", () => {
      const noteId = parseInt(
        (noteEl as HTMLElement).getAttribute("data-note-id")!,
        10
      );
      selectNote(noteId);
    });
  });
}

function selectNote(noteId: number): void {
  selectedNoteId = noteId;
  updateFragment();
  renderFeed();
}

function updateFragment(): void {
  const parts: string[] = [];
  if (searchQuery) {
    parts.push(`q=${encodeURIComponent(searchQuery)}`);
  }
  if (selectedNoteId !== null) {
    parts.push(`note=${selectedNoteId}`);
  }
  window.location.hash = parts.length > 0 ? parts.join("&") : "";
}

function restoreFromFragment(): void {
  const hash = window.location.hash.slice(1);
  if (!hash) return;

  const params = new URLSearchParams(hash);
  const query = params.get("q");
  const noteId = params.get("note");

  if (query) {
    searchQuery = query;
    (document.getElementById("search") as HTMLInputElement).value = query;
  }
  if (noteId) {
    selectedNoteId = parseInt(noteId, 10);
  }

  renderFeed();
  updateResultsLine();
}

function updateResultsLine(): void {
  const resultsLine = document.getElementById("results-line")!;
  if (searchQuery) {
    resultsLine.textContent = `results for "${searchQuery}"`;
  } else {
    resultsLine.textContent = "";
  }
}

function handleSearch(query: string): void {
  searchQuery = query;
  selectedNoteId = null;
  updateFragment();
  renderFeed();
  updateResultsLine();
}

function handleAddNote(e: SubmitEvent): void {
  e.preventDefault();

  const titleInput = document.getElementById("title") as HTMLInputElement;
  const bodyInput = document.getElementById("body") as HTMLTextAreaElement;
  const avatarInput = document.getElementById("avatar") as HTMLInputElement;

  const note: Note = {
    id: getNextNoteId(),
    title: titleInput.value,
    body: bodyInput.value,
    avatar: avatarInput.value,
    createdAt: new Date().toISOString(),
  };

  notes.push(note);
  saveNotes();

  titleInput.value = "";
  bodyInput.value = "";
  avatarInput.value = "";

  renderFeed();
  updateResultsLine();
}

function handleHashChange(): void {
  selectedNoteId = null;
  searchQuery = "";
  restoreFromFragment();
}

// Initialize
(() => {
  initializeNotes();

  document
    .getElementById("note-form")!
    .addEventListener("submit", handleAddNote);
  document
    .getElementById("search")!
    .addEventListener("input", (e) =>
      handleSearch((e.target as HTMLInputElement).value)
    );
  window.addEventListener("hashchange", handleHashChange);
})();
