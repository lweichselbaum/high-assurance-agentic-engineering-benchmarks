import { setElementInnerHtml } from 'safevalues/dom';
import { sanitizeHtml } from 'safevalues';
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
let nextId = 1;
let selectedNoteId: number | null = null;
let searchQuery = '';

// Validate avatar URL scheme (http, https, data:image/)
function isValidAvatarUrl(url: string): boolean {
  if (!url) return true;
  try {
    if (url.startsWith('data:image/')) return true;
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// Load notes from localStorage or fixtures
async function initializeNotes() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      notes = JSON.parse(stored);
      nextId = Math.max(...notes.map(n => n.id), 0) + 1;
    } catch {
      notes = [];
      nextId = 1;
      await loadFixtures();
    }
  } else {
    await loadFixtures();
  }
}

async function loadFixtures() {
  try {
    notes = fixturesData as Note[];
    nextId = Math.max(...notes.map(n => n.id), 0) + 1;
    saveNotes();
  } catch {
    notes = [];
    nextId = 1;
  }
}

function saveNotes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

// Parse URL fragment: #q=query&note=id
function parseFragment() {
  const hash = location.hash.slice(1);
  const params = new URLSearchParams(hash);
  searchQuery = params.get('q') || '';
  const noteParam = params.get('note');
  selectedNoteId = noteParam ? parseInt(noteParam) : null;
}

// Update URL fragment based on current state
function updateFragment() {
  const params = new URLSearchParams();
  if (searchQuery) params.set('q', searchQuery);
  if (selectedNoteId !== null) params.set('note', selectedNoteId.toString());
  const newHash = params.toString() ? '#' + params.toString() : '';
  history.replaceState(null, '', newHash);
}

// Filter notes based on search query
function getFilteredNotes(): Note[] {
  if (!searchQuery) return notes;
  const q = searchQuery.toLowerCase();
  return notes.filter(
    note => note.title.toLowerCase().includes(q) || note.body.toLowerCase().includes(q)
  );
}

// Render the feed
function renderFeed() {
  const feed = document.getElementById('feed')!;
  while (feed.firstChild) {
    feed.removeChild(feed.firstChild);
  }

  const filtered = getFilteredNotes();
  const sortedNotes = [...filtered].reverse();

  for (const note of sortedNotes) {
    const article = document.createElement('article');
    article.className = 'note';
    article.setAttribute('data-note-id', note.id.toString());
    if (selectedNoteId === note.id) {
      article.setAttribute('aria-current', 'true');
    }

    const titleEl = document.createElement('h3');
    titleEl.className = 'note-title';
    titleEl.textContent = note.title;
    titleEl.style.cursor = 'pointer';
    titleEl.addEventListener('click', () => selectNote(note.id));

    const bodyEl = document.createElement('div');
    bodyEl.className = 'note-body';
    // Convert the text body with tags into HTML
    const bodyHtml = parseRichText(note.body);
    setElementInnerHtml(bodyEl, sanitizeHtml(bodyHtml));

    article.appendChild(titleEl);

    if (note.avatar && isValidAvatarUrl(note.avatar)) {
      const img = document.createElement('img');
      img.className = 'note-avatar';
      img.src = note.avatar;
      img.alt = 'Avatar';
      article.appendChild(img);
    }

    article.appendChild(bodyEl);
    feed.appendChild(article);
  }
}

// Parse rich text: convert <b>, <i>, <a>, <br> tags and newlines to HTML
function parseRichText(text: string): string {
  // First pass: extract tags and their positions
  const parts: Array<{ type: 'text' | 'tag'; content: string; tag?: string; href?: string }> = [];
  let current = 0;

  // Pattern to match our allowed tags
  const tagPattern = /<(b|strong|i|em|br)\b>|<a href="([^"]*)"\s*>|<\/(b|strong|i|em|a)>/g;
  let match;

  while ((match = tagPattern.exec(text)) !== null) {
    // Add text before this tag
    if (current < match.index) {
      parts.push({ type: 'text', content: text.slice(current, match.index) });
    }

    // Add the tag
    if (match[0] === '<br>' || match[0] === '<br/>') {
      parts.push({ type: 'tag', tag: 'br', content: match[0] });
    } else if (match[1]) {
      // Opening tag: b, strong, i, em
      const tagName = match[1];
      parts.push({ type: 'tag', tag: tagName, content: match[0] });
    } else if (match[2] !== undefined) {
      // Anchor tag with href
      parts.push({ type: 'tag', tag: 'a', href: match[2], content: match[0] });
    } else if (match[0].startsWith('</')) {
      // Closing tag
      const tagName = match[0].match(/\w+/)?.[0] || '';
      parts.push({ type: 'tag', tag: '/' + tagName, content: match[0] });
    }

    current = tagPattern.lastIndex;
  }

  // Add remaining text
  if (current < text.length) {
    parts.push({ type: 'text', content: text.slice(current) });
  }

  // Build HTML
  let html = '';
  for (const part of parts) {
    if (part.type === 'text') {
      html += part.content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    } else if (part.tag === 'br') {
      html += '<br>';
    } else if (part.tag === 'a' && part.href) {
      html += `<a href="${escapeHtml(part.href)}">`;
    } else if (part.tag === '/a') {
      html += '</a>';
    } else if (part.tag === 'b' || part.tag === 'strong') {
      html += '<b>';
    } else if (part.tag === '/b' || part.tag === '/strong') {
      html += '</b>';
    } else if (part.tag === 'i' || part.tag === 'em') {
      html += '<i>';
    } else if (part.tag === '/i' || part.tag === '/em') {
      html += '</i>';
    }
  }

  // Convert newlines to <br>
  html = html.replace(/\n/g, '<br>');

  return html;
}

function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, char => map[char]!);
}

function selectNote(id: number) {
  selectedNoteId = id;
  updateFragment();
  renderFeed();
}

function handleSearch(query: string) {
  searchQuery = query;
  selectedNoteId = null;
  updateFragment();
  renderFeed();
  updateResultsLine();
}

function updateResultsLine() {
  const resultsLine = document.getElementById('results-line')!;
  if (searchQuery) {
    resultsLine.textContent = `results for "${searchQuery}"`;
  } else {
    resultsLine.textContent = '';
  }
}

function handleAddNote(e: Event) {
  e.preventDefault();
  const form = e.target as HTMLFormElement;

  const titleInput = document.getElementById('title') as HTMLInputElement;
  const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
  const avatarInput = document.getElementById('avatar') as HTMLInputElement;

  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  const avatar = avatarInput.value.trim();

  if (!title || !body) return;

  // Validate avatar URL
  if (avatar && !isValidAvatarUrl(avatar)) {
    return;
  }

  const newNote: Note = {
    id: nextId++,
    title,
    body,
    avatar,
    createdAt: new Date().toISOString(),
  };

  notes.push(newNote);
  saveNotes();

  form.reset();
  renderFeed();
  updateResultsLine();
}

async function init() {
  await initializeNotes();
  parseFragment();

  // Set up event listeners
  const form = document.getElementById('note-form') as HTMLFormElement;
  form.addEventListener('submit', handleAddNote);

  const searchInput = document.getElementById('search') as HTMLInputElement;
  searchInput.value = searchQuery;
  searchInput.addEventListener('input', (e) => {
    handleSearch((e.target as HTMLInputElement).value);
  });

  // Handle back/forward
  window.addEventListener('hashchange', () => {
    parseFragment();
    renderFeed();
    updateResultsLine();
    const searchInput = document.getElementById('search') as HTMLInputElement;
    searchInput.value = searchQuery;
  });

  // Initial render
  renderFeed();
  updateResultsLine();
}

init().catch(console.error);
