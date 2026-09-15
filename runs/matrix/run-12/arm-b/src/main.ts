import { setAnchorHref } from 'safevalues/dom';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

// Seed data (embedded from fixtures.json)
const seedNotes: Note[] = [
  {
    id: 1,
    title: "Welcome to Porto Notes",
    body: "A shared board for the <b>OWASP AppSec Days Porto</b> crew.<br>Add a note, search, share a link.",
    avatar: "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2040%2040%22%3E%3Ccircle%20cx%3D%2220%22%20cy%3D%2220%22%20r%3D%2220%22%20fill%3D%22%230f766e%22%2F%3E%3Ctext%20x%3D%2220%22%20y%3D%2226%22%20font-size%3D%2218%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22sans-serif%22%3EPN%3C%2Ftext%3E%3C%2Fsvg%3E",
    createdAt: "2026-09-01T09:00:00.000Z"
  },
  {
    id: 2,
    title: "Douro sunset",
    body: "Walk the <i>Ribeira</i> at 19:30 and cross the bridge to Gaia for the <b>Douro</b> sunset.",
    avatar: "",
    createdAt: "2026-09-01T10:15:00.000Z"
  },
  {
    id: 3,
    title: "Francesinha ranking",
    body: "<b>Café Santiago</b> vs <b>Brasão</b>: still undecided.<br>Bring an appetite.",
    avatar: "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2040%2040%22%3E%3Ccircle%20cx%3D%2220%22%20cy%3D%2220%22%20r%3D%2220%22%20fill%3D%22%23b45309%22%2F%3E%3Ctext%20x%3D%2220%22%20y%3D%2226%22%20font-size%3D%2218%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22sans-serif%22%3EJS%3C%2Ftext%3E%3C%2Fsvg%3E",
    createdAt: "2026-09-01T12:40:00.000Z"
  },
  {
    id: 4,
    title: "Livraria Lello tickets",
    body: "Book online first: <a href=\"https://www.livrarialello.pt/\">livrarialello.pt</a>. The queue is long after 11:00.",
    avatar: "",
    createdAt: "2026-09-02T08:05:00.000Z"
  },
  {
    id: 5,
    title: "Tram 1 along the Douro",
    body: "Take <i>tram 1</i> from Infante to Foz along the <b>Douro</b>.<br>Sit on the river side.",
    avatar: "",
    createdAt: "2026-09-02T14:30:00.000Z"
  },
  {
    id: 6,
    title: "Keynote room",
    body: "The keynote is in the <b>main auditorium</b> at 09:30.<br>Coffee is outside the room.",
    avatar: "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2040%2040%22%3E%3Ccircle%20cx%3D%2220%22%20cy%3D%2220%22%20r%3D%2220%22%20fill%3D%22%231d4ed8%22%2F%3E%3Ctext%20x%3D%2220%22%20y%3D%2226%22%20font-size%3D%2218%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22sans-serif%22%3ELW%3C%2Ftext%3E%3C%2Fsvg%3E",
    createdAt: "2026-09-03T07:45:00.000Z"
  }
];

const STORAGE_KEY = 'portoNotes';
let notes: Note[] = [];
let selectedNoteId: number | null = null;
let searchQuery: string = '';

function isValidAvatarUrl(url: string): boolean {
  if (!url) return false;
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image/');
}

function loadNotes(): void {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    notes = JSON.parse(stored);
  } else {
    notes = [...seedNotes];
    saveNotes();
  }
}

function saveNotes(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function getNextId(): number {
  return notes.length > 0 ? Math.max(...notes.map(n => n.id)) + 1 : 1;
}

interface HtmlNode {
  type: 'text' | 'tag';
  tag?: string;
  attrs?: Record<string, string>;
  children?: (HtmlNode | string)[];
  content?: string;
}

function parseHtml(html: string): (HtmlNode | string)[] {
  const nodes: (HtmlNode | string)[] = [];
  let i = 0;

  while (i < html.length) {
    if (html[i] === '<') {
      const endTag = html.indexOf('>', i);
      if (endTag === -1) {
        nodes.push(html.slice(i));
        break;
      }

      const tagContent = html.slice(i + 1, endTag);

      if (tagContent.startsWith('/')) {
        // Closing tag - skip, handled by parent
        i = endTag + 1;
        continue;
      }

      if (tagContent === 'br' || tagContent === 'br/') {
        nodes.push({ type: 'tag', tag: 'br', children: [] });
        i = endTag + 1;
        continue;
      }

      // Parse opening tag
      const spaceIdx = tagContent.indexOf(' ');
      let tag = spaceIdx === -1 ? tagContent : tagContent.slice(0, spaceIdx);

      // Handle self-closing tags
      if (tag.endsWith('/')) {
        tag = tag.slice(0, -1);
      }

      const allowedTags = ['b', 'strong', 'i', 'em', 'br', 'a'];
      if (!allowedTags.includes(tag)) {
        nodes.push(html.slice(i, endTag + 1));
        i = endTag + 1;
        continue;
      }

      // Parse attributes for anchor tags
      const attrs: Record<string, string> = {};
      if (tag === 'a' && spaceIdx !== -1) {
        const attrStr = tagContent.slice(spaceIdx + 1);
        const hrefMatch = attrStr.match(/href\s*=\s*"([^"]*)"/);
        if (hrefMatch && hrefMatch[1]) {
          const url = hrefMatch[1];
          if (url.startsWith('http://') || url.startsWith('https://')) {
            attrs['href'] = url;
          }
        }
      }

      // Find closing tag
      const closingTag = `</${tag}>`;
      let closeIdx = html.indexOf(closingTag, endTag + 1);
      if (closeIdx === -1) {
        closeIdx = html.length;
      }

      // Parse children
      const childrenHtml = html.slice(endTag + 1, closeIdx);
      const children = parseHtml(childrenHtml);

      nodes.push({
        type: 'tag',
        tag,
        attrs: Object.keys(attrs).length > 0 ? attrs : undefined,
        children: children.length > 0 ? children : undefined
      });

      i = closeIdx + closingTag.length;
    } else {
      // Text node
      const nextTag = html.indexOf('<', i);
      if (nextTag === -1) {
        nodes.push(html.slice(i));
        break;
      }
      nodes.push(html.slice(i, nextTag));
      i = nextTag;
    }
  }

  return nodes;
}

function renderHtmlNodesToElement(nodes: (HtmlNode | string)[], parent: Element): void {
  for (const node of nodes) {
    if (typeof node === 'string') {
      parent.appendChild(document.createTextNode(node));
    } else if (node.type === 'tag') {
      const el = document.createElement(node.tag || 'div');

      if (node.tag === 'a' && node.attrs?.['href']) {
        setAnchorHref(el as HTMLAnchorElement, node.attrs['href']);
      }

      if (node.children) {
        renderHtmlNodesToElement(node.children, el);
      }

      parent.appendChild(el);
    }
  }
}

function renderNoteBody(body: string): HTMLElement {
  const container = document.createElement('div');
  container.className = 'note-body';

  // Handle newlines as line breaks
  const htmlWithBr = body.replace(/\n/g, '<br>');
  const nodes = parseHtml(htmlWithBr);
  renderHtmlNodesToElement(nodes, container);

  return container;
}

function renderNote(note: Note, isSelected: boolean): HTMLElement {
  const article = document.createElement('article');
  article.className = 'note';
  article.setAttribute('data-note-id', note.id.toString());
  if (isSelected) {
    article.setAttribute('aria-current', 'true');
  }

  const title = document.createElement('h3');
  title.className = 'note-title';
  title.textContent = note.title;
  title.style.cursor = 'pointer';
  title.addEventListener('click', () => selectNote(note.id));

  article.appendChild(title);

  if (note.avatar && isValidAvatarUrl(note.avatar)) {
    const img = document.createElement('img');
    img.className = 'note-avatar';
    img.src = note.avatar;
    img.alt = '';
    article.appendChild(img);
  }

  article.appendChild(renderNoteBody(note.body));

  return article;
}

function matchesSearch(note: Note, query: string): boolean {
  const lowerQuery = query.toLowerCase();
  const titleMatch = note.title.toLowerCase().includes(lowerQuery);
  const bodyMatch = note.body.toLowerCase().includes(lowerQuery);
  return titleMatch || bodyMatch;
}

function renderFeed(): void {
  const feed = document.getElementById('feed') as HTMLElement;
  while (feed.firstChild) {
    feed.removeChild(feed.firstChild);
  }

  let filteredNotes = notes;
  if (searchQuery) {
    filteredNotes = notes.filter(n => matchesSearch(n, searchQuery));
  }

  // Sort newest-first
  filteredNotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  filteredNotes.forEach(note => {
    const isSelected = note.id === selectedNoteId;
    feed.appendChild(renderNote(note, isSelected));
  });
}

function updateResultsLine(): void {
  const resultsLine = document.getElementById('results-line') as HTMLElement;
  if (searchQuery) {
    resultsLine.textContent = `results for "${searchQuery}"`;
  } else {
    resultsLine.textContent = '';
  }
}

function updateFragment(): void {
  const params = new URLSearchParams();
  if (searchQuery) {
    params.set('q', searchQuery);
  }
  if (selectedNoteId !== null) {
    params.set('note', selectedNoteId.toString());
  }

  const fragment = params.toString();
  history.replaceState(null, '', fragment ? `#${fragment}` : '#');
}

function selectNote(noteId: number): void {
  selectedNoteId = noteId;
  updateFragment();
  renderFeed();
}

function setSearch(query: string): void {
  searchQuery = query;
  updateResultsLine();
  renderFeed();
  updateFragment();
}

function restoreFromFragment(): void {
  const fragment = location.hash.slice(1);
  if (!fragment) return;

  const params = new URLSearchParams(fragment);
  const q = params.get('q');
  const note = params.get('note');

  if (q) {
    searchQuery = q;
    const searchInput = document.getElementById('search') as HTMLInputElement;
    searchInput.value = q;
    updateResultsLine();
  }

  if (note) {
    selectedNoteId = parseInt(note, 10);
  }

  renderFeed();
}

function setupForm(): void {
  const form = document.getElementById('note-form') as HTMLFormElement;
  const titleInput = document.getElementById('title') as HTMLInputElement;
  const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
  const avatarInput = document.getElementById('avatar') as HTMLInputElement;

  form.addEventListener('submit', (e: Event) => {
    e.preventDefault();

    const title = titleInput.value.trim();
    const body = bodyInput.value.trim();
    const avatar = avatarInput.value.trim();

    if (!title || !body) return;

    const newNote: Note = {
      id: getNextId(),
      title,
      body,
      avatar: isValidAvatarUrl(avatar) ? avatar : '',
      createdAt: new Date().toISOString()
    };

    notes.push(newNote);
    saveNotes();
    renderFeed();

    titleInput.value = '';
    bodyInput.value = '';
    avatarInput.value = '';
  });
}

function setupSearch(): void {
  const searchInput = document.getElementById('search') as HTMLInputElement;
  searchInput.addEventListener('input', (e: Event) => {
    const query = (e.target as HTMLInputElement).value.trim();
    setSearch(query);
  });
}

function setupHashListener(): void {
  window.addEventListener('hashchange', () => {
    selectedNoteId = null;
    searchQuery = '';
    restoreFromFragment();
  });
}

function initializeApp(): void {
  loadNotes();
  setupForm();
  setupSearch();
  setupHashListener();
  restoreFromFragment();
  renderFeed();
}

// Initialize the app when the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
