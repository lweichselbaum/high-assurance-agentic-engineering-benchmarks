import fixtures from '../fixtures.json';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

let notes: Note[] = [];
let selectedNoteId: number | null = null;
let searchQuery = '';
const STORAGE_KEY = 'porto_notes';

function initNotes() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    notes = JSON.parse(stored);
  } else {
    notes = JSON.parse(JSON.stringify(fixtures));
    saveNotes();
  }
}

function saveNotes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function getNextId(): number {
  return notes.length > 0 ? Math.max(...notes.map(n => n.id)) + 1 : 1;
}

function parseRichText(text: string): string {
  // Split by tags and escape non-tag parts
  const parts: string[] = [];
  const tagRegex = /(<b>|<\/b>|<strong>|<\/strong>|<i>|<\/i>|<em>|<\/em>|<br\s*\/??>|<a\s+href="[^"]*"[^>]*>|<\/a>)/gi;

  let lastIndex = 0;
  let match;

  while ((match = tagRegex.exec(text)) !== null) {
    // Add the text before this tag (escaped)
    if (match.index > lastIndex) {
      const textBefore = text.substring(lastIndex, match.index);
      parts.push(escapeHtml(textBefore));
    }
    // Add the tag as-is
    parts.push(match[0]);
    lastIndex = tagRegex.lastIndex;
  }

  // Add any remaining text after the last tag
  if (lastIndex < text.length) {
    parts.push(escapeHtml(text.substring(lastIndex)));
  }

  let html = parts.join('');

  // Convert literal newlines to <br>
  html = html.replace(/\n/g, '<br>');

  return html;
}

function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, char => map[char]);
}

function renderNote(note: Note): string {
  const richHtml = parseRichText(note.body);

  let avatarHtml = '';
  if (note.avatar) {
    avatarHtml = `<img class="note-avatar" src="${escapeHtml(note.avatar)}" alt="Avatar">`;
  }

  const isCurrent = selectedNoteId === note.id ? 'aria-current="true"' : '';

  return `
    <article class="note" data-note-id="${note.id}" ${isCurrent}>
      <h3 class="note-title">${escapeHtml(note.title)}</h3>
      <div class="note-body">${richHtml}</div>
      ${avatarHtml}
    </article>
  `;
}

function getFilteredNotes(): Note[] {
  if (!searchQuery) {
    return notes;
  }

  const query = searchQuery.toLowerCase();
  return notes.filter(note =>
    note.title.toLowerCase().includes(query) ||
    note.body.toLowerCase().includes(query)
  );
}

function render() {
  const filtered = getFilteredNotes();
  const sorted = [...filtered].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const feedHtml = sorted.map(note => renderNote(note)).join('');
  const resultsLine = searchQuery
    ? `<p id="results-line">results for "${escapeHtml(searchQuery)}"</p>`
    : '<p id="results-line"></p>';

  const html = `
    <div style="max-width: 800px; margin: 0 auto; padding: 20px; font-family: system-ui, -apple-system, sans-serif;">
      <h1 style="margin-bottom: 30px;">Porto Notes</h1>

      <form id="note-form" style="margin-bottom: 30px; padding: 20px; border: 1px solid #ccc; border-radius: 8px;">
        <div style="margin-bottom: 15px;">
          <label for="title" style="display: block; margin-bottom: 5px; font-weight: bold;">Title</label>
          <input id="title" type="text" placeholder="Note title" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;">
        </div>
        <div style="margin-bottom: 15px;">
          <label for="body" style="display: block; margin-bottom: 5px; font-weight: bold;">Body</label>
          <textarea id="body" placeholder="Note body (use &lt;b&gt;, &lt;i&gt;, &lt;a href=...&gt;, &lt;br&gt; for formatting)" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; min-height: 100px; font-family: monospace;"></textarea>
        </div>
        <div style="margin-bottom: 15px;">
          <label for="avatar" style="display: block; margin-bottom: 5px; font-weight: bold;">Avatar URL (optional)</label>
          <input id="avatar" type="text" placeholder="Avatar image URL" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;">
        </div>
        <button type="submit" style="padding: 10px 20px; background: #0f766e; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Add Note</button>
      </form>

      <div style="margin-bottom: 30px;">
        <input id="search" type="text" placeholder="Search notes..." style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;">
        ${resultsLine}
      </div>

      <section id="feed">
        ${feedHtml}
      </section>
    </div>
  `;

  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = html;
    attachEventListeners();
  }
}

function attachEventListeners() {
  const form = document.getElementById('note-form') as HTMLFormElement;
  const searchInput = document.getElementById('search') as HTMLInputElement;

  form?.addEventListener('submit', (e) => {
    e.preventDefault();

    const titleInput = document.getElementById('title') as HTMLInputElement;
    const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
    const avatarInput = document.getElementById('avatar') as HTMLInputElement;

    const title = titleInput?.value.trim() || '';
    const body = bodyInput?.value.trim() || '';
    const avatar = avatarInput?.value.trim() || '';

    if (title && body) {
      const newNote: Note = {
        id: getNextId(),
        title,
        body,
        avatar,
        createdAt: new Date().toISOString()
      };

      notes.push(newNote);
      saveNotes();

      titleInput.value = '';
      bodyInput.value = '';
      avatarInput.value = '';

      updateURL();
      render();
    }
  });

  searchInput?.addEventListener('input', (e) => {
    searchQuery = (e.target as HTMLInputElement).value;
    updateURL();
    render();
  });

  // Attach click handlers to note titles
  document.querySelectorAll('.note-title').forEach(el => {
    el.addEventListener('click', () => {
      const article = el.closest('article');
      const noteId = article?.getAttribute('data-note-id');
      if (noteId) {
        selectedNoteId = parseInt(noteId, 10);
        updateURL();
        render();
      }
    });
  });
}

function updateURL() {
  const params = new URLSearchParams();
  if (searchQuery) params.set('q', searchQuery);
  if (selectedNoteId) params.set('note', selectedNoteId.toString());

  const fragment = params.toString();
  window.location.hash = fragment ? '#' + fragment : '';
}

function restoreFromURL() {
  const fragment = window.location.hash.slice(1);
  const params = new URLSearchParams(fragment);

  searchQuery = params.get('q') || '';
  const noteParam = params.get('note');
  selectedNoteId = noteParam ? parseInt(noteParam, 10) : null;
}

window.addEventListener('hashchange', () => {
  restoreFromURL();
  render();
});

initNotes();
restoreFromURL();
render();
