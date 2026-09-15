import fixtures from "../fixtures.json";

interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

const STORAGE_KEY = "porto-notes";

function getStoredNotes(): Note[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

function getHighestNoteId(notes: Note[]): number {
  return notes.length > 0 ? Math.max(...notes.map((n) => n.id)) : 0;
}

function saveNotes(notes: Note[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function renderRichText(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      let html = line
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      // Restore and process HTML tags
      html = html
        .replace(/&lt;b&gt;/g, "<b>")
        .replace(/&lt;\/b&gt;/g, "</b>")
        .replace(/&lt;strong&gt;/g, "<strong>")
        .replace(/&lt;\/strong&gt;/g, "</strong>")
        .replace(/&lt;i&gt;/g, "<i>")
        .replace(/&lt;\/i&gt;/g, "</i>")
        .replace(/&lt;em&gt;/g, "<em>")
        .replace(/&lt;\/em&gt;/g, "</em>");

      // Handle links: &lt;a href="URL"&gt;text&lt;/a&gt;
      html = html.replace(
        /&lt;a href="([^"]*)"&gt;/g,
        '<a href="$1">'
      );
      html = html.replace(/&lt;\/a&gt;/g, "</a>");

      return html;
    })
    .join("<br>");
}

function renderNote(note: Note, isSelected: boolean): HTMLElement {
  const article = document.createElement("article");
  article.className = "note";
  article.dataset.noteId = String(note.id);
  if (isSelected) {
    article.setAttribute("aria-current", "true");
  }

  const header = document.createElement("div");
  header.className = "note-header";

  if (note.avatar) {
    const img = document.createElement("img");
    img.className = "note-avatar";
    img.src = note.avatar;
    img.alt = "";
    header.appendChild(img);
  }

  const content = document.createElement("div");
  content.className = "note-content";

  const title = document.createElement("div");
  title.className = "note-title";
  title.textContent = note.title;

  const body = document.createElement("div");
  body.className = "note-body";
  body.innerHTML = renderRichText(note.body);

  content.appendChild(title);
  content.appendChild(body);
  header.appendChild(content);
  article.appendChild(header);

  return article;
}

function renderFeed(
  notes: Note[],
  query: string = "",
  selectedNoteId?: number
): void {
  const feed = document.getElementById("feed")!;
  const resultsLine = document.getElementById("results-line")!;

  let filtered = notes;
  if (query) {
    const lowerQuery = query.toLowerCase();
    filtered = notes.filter(
      (n) =>
        n.title.toLowerCase().includes(lowerQuery) ||
        n.body.toLowerCase().includes(lowerQuery)
    );
  }

  if (query) {
    resultsLine.textContent = `results for "${query}"`;
  } else {
    resultsLine.textContent = "";
  }

  feed.innerHTML = "";
  filtered.forEach((note) => {
    const element = renderNote(note, note.id === selectedNoteId);
    element.addEventListener("click", () => {
      updateFragment({ noteId: note.id, query });
    });
    feed.appendChild(element);
  });
}

function getFragment(): { query?: string; noteId?: number } {
  const fragment = window.location.hash.slice(1);
  const params = new URLSearchParams(fragment);
  return {
    query: params.get("q") || undefined,
    noteId: params.get("note") ? Number(params.get("note")) : undefined,
  };
}

function updateFragment(params: { query?: string; noteId?: number }): void {
  const searchParams = new URLSearchParams();
  if (params.query) {
    searchParams.set("q", params.query);
  }
  if (params.noteId) {
    searchParams.set("note", String(params.noteId));
  }
  window.location.hash = searchParams.toString();
}

function initApp(): void {
  let notes = getStoredNotes();

  // Seed with fixtures if no notes stored
  if (notes.length === 0) {
    notes = fixtures as Note[];
    saveNotes(notes);
  }

  const form = document.getElementById("note-form") as HTMLFormElement;
  const titleInput = document.getElementById("title") as HTMLInputElement;
  const bodyInput = document.getElementById("body") as HTMLTextAreaElement;
  const avatarInput = document.getElementById("avatar") as HTMLInputElement;
  const searchInput = document.getElementById("search") as HTMLInputElement;

  // Load fragment state
  const fragment = getFragment();
  if (fragment.query) {
    searchInput.value = fragment.query;
  }

  renderFeed(notes, fragment.query, fragment.noteId);

  // Form submission
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const newNote: Note = {
      id: getHighestNoteId(notes) + 1,
      title: titleInput.value,
      body: bodyInput.value,
      avatar: avatarInput.value,
      createdAt: new Date().toISOString(),
    };
    notes.unshift(newNote);
    saveNotes(notes);
    titleInput.value = "";
    bodyInput.value = "";
    avatarInput.value = "";
    const currentQuery = searchInput.value;
    renderFeed(notes, currentQuery, fragment.noteId);
  });

  // Search input
  searchInput.addEventListener("input", (e) => {
    const query = (e.target as HTMLInputElement).value;
    updateFragment({ query: query || undefined, noteId: fragment.noteId });
  });

  // Hash change listener
  window.addEventListener("hashchange", () => {
    const newFragment = getFragment();
    searchInput.value = newFragment.query || "";
    renderFeed(notes, newFragment.query, newFragment.noteId);
  });
}

initApp();
