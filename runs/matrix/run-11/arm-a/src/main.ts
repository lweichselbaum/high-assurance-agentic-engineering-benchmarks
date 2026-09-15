interface Note {
  id: number;
  title: string;
  body: string;
  avatar?: string;
  createdAt: string;
}

interface AppState {
  notes: Note[];
  selectedNoteId: number | null;
  searchQuery: string;
}

const STORAGE_KEY = "porto-notes";
const FIXTURES: Note[] = [
  {
    id: 1,
    title: "Welcome to Porto Notes",
    body: "A shared board for the <b>OWASP AppSec Days Porto</b> crew.<br>Add a note, search, share a link.",
    avatar:
      "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2040%2040%22%3E%3Ccircle%20cx%3D%2220%22%20cy%3D%2220%22%20r%3D%2220%22%20fill%3D%22%230f766e%22%2F%3E%3Ctext%20x%3D%2220%22%20y%3D%2226%22%20font-size%3D%2218%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22sans-serif%22%3EPN%3C%2Ftext%3E%3C%2Fsvg%3E",
    createdAt: "2026-09-01T09:00:00.000Z",
  },
  {
    id: 2,
    title: "Douro sunset",
    body: "Walk the <i>Ribeira</i> at 19:30 and cross the bridge to Gaia for the <b>Douro</b> sunset.",
    avatar: "",
    createdAt: "2026-09-01T10:15:00.000Z",
  },
  {
    id: 3,
    title: "Francesinha ranking",
    body: "<b>Café Santiago</b> vs <b>Brasão</b>: still undecided.<br>Bring an appetite.",
    avatar:
      "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2040%2040%22%3E%3Ccircle%20cx%3D%2220%22%20cy%3D%2220%22%20r%3D%2220%22%20fill%3D%22%23b45309%22%2F%3E%3Ctext%20x%3D%2220%22%20y%3D%2226%22%20font-size%3D%2218%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22sans-serif%22%3EJS%3C%2Ftext%3E%3C%2Fsvg%3E",
    createdAt: "2026-09-01T12:40:00.000Z",
  },
  {
    id: 4,
    title: "Livraria Lello tickets",
    body: 'Book online first: <a href="https://www.livrarialello.pt/">livrarialello.pt</a>. The queue is long after 11:00.',
    avatar: "",
    createdAt: "2026-09-02T08:05:00.000Z",
  },
  {
    id: 5,
    title: "Tram 1 along the Douro",
    body: "Take <i>tram 1</i> from Infante to Foz along the <b>Douro</b>.<br>Sit on the river side.",
    avatar: "",
    createdAt: "2026-09-02T14:30:00.000Z",
  },
  {
    id: 6,
    title: "Keynote room",
    body: "The keynote is in the <b>main auditorium</b> at 09:30.<br>Coffee is outside the room.",
    avatar:
      "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2040%2040%22%3E%3Ccircle%20cx%3D%2220%22%20cy%3D%2220%22%20r%3D%2220%22%20fill%3D%22%231d4ed8%22%2F%3E%3Ctext%20x%3D%2220%22%20y%3D%2226%22%20font-size%3D%2218%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22sans-serif%22%3ELW%3C%2Ftext%3E%3C%2Fsvg%3E",
    createdAt: "2026-09-03T07:45:00.000Z",
  },
];

let state: AppState = {
  notes: [],
  selectedNoteId: null,
  searchQuery: "",
};

function loadState(): void {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    state.notes = JSON.parse(stored);
  } else {
    state.notes = FIXTURES;
    saveState();
  }
}

function saveState(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.notes));
}

function parseRichText(text: string): string {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  html = html.replace(/&lt;b&gt;(.*?)&lt;\/b&gt;/g, "<b>$1</b>");
  html = html.replace(/&lt;strong&gt;(.*?)&lt;\/strong&gt;/g, "<strong>$1</strong>");
  html = html.replace(/&lt;i&gt;(.*?)&lt;\/i&gt;/g, "<i>$1</i>");
  html = html.replace(/&lt;em&gt;(.*?)&lt;\/em&gt;/g, "<em>$1</em>");
  html = html.replace(
    /&lt;a href="(.*?)"&gt;(.*?)&lt;\/a&gt;/g,
    '<a href="$1">$2</a>'
  );
  html = html.replace(/&lt;br&gt;/g, "<br>");
  html = html.replace(/\n/g, "<br>");

  return html;
}

function getFilteredNotes(): Note[] {
  if (!state.searchQuery) return state.notes;

  const query = state.searchQuery.toLowerCase();
  return state.notes.filter(
    (note) =>
      note.title.toLowerCase().includes(query) ||
      note.body.toLowerCase().includes(query)
  );
}

function renderFeed(): void {
  const feed = document.querySelector("#feed") as HTMLElement;
  const resultLine = document.querySelector("#results-line") as HTMLElement;
  const filtered = getFilteredNotes();

  if (state.searchQuery) {
    resultLine.textContent = `results for "${state.searchQuery}"`;
  } else {
    resultLine.textContent = "";
  }

  if (filtered.length === 0) {
    feed.innerHTML = '<div class="empty-state">No notes found.</div>';
    return;
  }

  feed.innerHTML = filtered
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((note) => {
      const isCurrent = state.selectedNoteId === note.id ? 'aria-current="true"' : "";
      const avatarHtml = note.avatar ? `<img class="note-avatar" src="${note.avatar}" alt="" />` : "";

      return `
        <article class="note" data-note-id="${note.id}" ${isCurrent}>
          ${avatarHtml}
          <h2 class="note-title">${escapeHtml(note.title)}</h2>
          <p class="note-body">${parseRichText(note.body)}</p>
        </article>
      `;
    })
    .join("");

  attachNoteClickHandlers();
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function attachNoteClickHandlers(): void {
  document.querySelectorAll("article.note").forEach((article) => {
    article.addEventListener("click", () => {
      const noteId = parseInt(article.getAttribute("data-note-id") || "0");
      state.selectedNoteId = noteId;
      updateUrl();
      renderFeed();
    });
  });
}

function updateUrl(): void {
  const params = new URLSearchParams();
  if (state.searchQuery) params.set("q", state.searchQuery);
  if (state.selectedNoteId) params.set("note", state.selectedNoteId.toString());

  const fragment = params.toString() ? `#${params.toString()}` : "";
  window.history.replaceState(null, "", window.location.pathname + window.location.search + fragment);
}

function restoreFromUrl(): void {
  const fragment = window.location.hash.slice(1);
  if (!fragment) return;

  const params = new URLSearchParams(fragment);
  state.searchQuery = params.get("q") || "";
  state.selectedNoteId = params.get("note") ? parseInt(params.get("note")!) : null;

  const searchInput = document.querySelector("#search") as HTMLInputElement;
  if (searchInput) searchInput.value = state.searchQuery;
}

function init(): void {
  loadState();
  restoreFromUrl();
  renderFeed();

  const form = document.querySelector("#note-form") as HTMLFormElement;
  const searchInput = document.querySelector("#search") as HTMLInputElement;

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const titleInput = document.querySelector("#title") as HTMLInputElement;
    const bodyInput = document.querySelector("#body") as HTMLTextAreaElement;
    const avatarInput = document.querySelector("#avatar") as HTMLInputElement;

    const newId = Math.max(0, ...state.notes.map((n) => n.id)) + 1;
    const newNote: Note = {
      id: newId,
      title: titleInput.value.trim(),
      body: bodyInput.value.trim(),
      avatar: avatarInput.value.trim(),
      createdAt: new Date().toISOString(),
    };

    state.notes.push(newNote);
    saveState();
    form.reset();
    state.searchQuery = "";
    searchInput.value = "";
    state.selectedNoteId = null;
    updateUrl();
    renderFeed();
  });

  searchInput.addEventListener("input", (e) => {
    state.searchQuery = (e.target as HTMLInputElement).value;
    state.selectedNoteId = null;
    updateUrl();
    renderFeed();
  });

  window.addEventListener("hashchange", () => {
    restoreFromUrl();
    renderFeed();
  });
}

init();
