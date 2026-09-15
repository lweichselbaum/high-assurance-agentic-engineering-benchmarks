// Porto Notes — implement the app here (see CLAUDE.md).

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

// Load fixtures
async function loadFixtures(): Promise<Note[]> {
  const response = await fetch('/fixtures.json');
  return response.json();
}

// Initialize app
async function init() {
  const stored = localStorage.getItem(STORAGE_KEY);

  if (stored) {
    notes = JSON.parse(stored);
  } else {
    notes = await loadFixtures();
    saveNotes();
  }

  if (notes.length > 0) {
    nextId = Math.max(...notes.map(n => n.id)) + 1;
  }

  setupEventListeners();
  parseFragmentAndRender();
}

// Save notes to localStorage
function saveNotes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

// Parse URL fragment
function parseFragment(): { query: string; selectedNoteId: number | null } {
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash);

  return {
    query: params.get('q') || '',
    selectedNoteId: params.has('note') ? parseInt(params.get('note')!, 10) : null
  };
}

// Update URL fragment
function updateFragment(query: string, selectedNoteId: number | null) {
  const params = new URLSearchParams();

  if (query) params.set('q', query);
  if (selectedNoteId !== null) params.set('note', selectedNoteId.toString());

  const hash = params.toString();
  window.location.hash = hash ? `#${hash}` : '';
}

// Sanitize and render rich text
function renderRichText(text: string): string {
  // Replace newlines with <br>
  let html = text.replace(/\n/g, '<br>');

  // Create a temporary element to parse HTML
  const temp = document.createElement('div');
  temp.innerHTML = html;

  // Only allow specific tags and attributes
  const allowedTags = ['b', 'strong', 'i', 'em', 'br', 'a'];
  const walker = document.createTreeWalker(temp, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);

  const sanitize = (node: Node): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const tagName = element.tagName.toLowerCase();

      if (!allowedTags.includes(tagName)) {
        // Replace with text content
        return document.createTextNode(element.textContent || '');
      }

      // For <a> tags, only keep href attribute and validate it
      if (tagName === 'a') {
        const href = element.getAttribute('href');
        if (href && !href.trim().toLowerCase().startsWith('javascript:')) {
          const newA = document.createElement('a');
          newA.setAttribute('href', href);
          return newA;
        } else {
          return document.createTextNode(element.textContent || '');
        }
      }

      // For other allowed tags, create a clean version
      return document.createElement(tagName);
    }

    return null;
  };

  const sanitized = document.createElement('div');
  const cloneAndSanitize = (source: Node, target: Node) => {
    for (let child of Array.from(source.childNodes)) {
      const sanitizedChild = sanitize(child);
      if (sanitizedChild) {
        target.appendChild(sanitizedChild);
        if (child.hasChildNodes() && sanitizedChild.nodeType === Node.ELEMENT_NODE) {
          cloneAndSanitize(child, sanitizedChild);
        }
      }
    }
  };

  cloneAndSanitize(temp, sanitized);
  return sanitized.innerHTML;
}

// Render the feed
function renderFeed(query: string = '', selectedNoteId: number | null = null) {
  const feed = document.getElementById('feed')!;
  const resultsLine = document.getElementById('results-line')!;

  // Filter notes
  const filtered = query
    ? notes.filter(note =>
        note.title.toLowerCase().includes(query.toLowerCase()) ||
        note.body.toLowerCase().includes(query.toLowerCase())
      )
    : notes;

  // Update results line
  if (query) {
    resultsLine.textContent = `results for "${query}"`;
  } else {
    resultsLine.textContent = '';
  }

  // Sort by newest first
  const sorted = [...filtered].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Render notes
  feed.innerHTML = '';

  sorted.forEach(note => {
    const article = document.createElement('article');
    article.className = 'note';
    article.setAttribute('data-note-id', note.id.toString());

    if (note.id === selectedNoteId) {
      article.setAttribute('aria-current', 'true');
    }

    const title = document.createElement('h2');
    title.className = 'note-title';
    title.textContent = note.title;
    title.style.cursor = 'pointer';
    title.addEventListener('click', () => selectNote(note.id));

    const body = document.createElement('div');
    body.className = 'note-body';
    body.innerHTML = renderRichText(note.body);

    article.appendChild(title);

    if (note.avatar) {
      const avatar = document.createElement('img');
      avatar.className = 'note-avatar';
      avatar.src = note.avatar;
      avatar.alt = 'Avatar';
      article.appendChild(avatar);
    }

    article.appendChild(body);
    feed.appendChild(article);
  });
}

// Select a note
function selectNote(noteId: number) {
  const { query } = parseFragment();
  updateFragment(query, noteId);
  renderFeed(query, noteId);
}

// Parse fragment and render
function parseFragmentAndRender() {
  const { query, selectedNoteId } = parseFragment();

  const searchInput = document.getElementById('search') as HTMLInputElement;
  searchInput.value = query;

  renderFeed(query, selectedNoteId);
}

// Setup event listeners
function setupEventListeners() {
  // Form submission
  const form = document.getElementById('note-form') as HTMLFormElement;
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const titleInput = document.getElementById('title') as HTMLInputElement;
    const bodyInput = document.getElementById('body') as HTMLTextAreaElement;
    const avatarInput = document.getElementById('avatar') as HTMLInputElement;

    const newNote: Note = {
      id: nextId++,
      title: titleInput.value,
      body: bodyInput.value,
      avatar: avatarInput.value,
      createdAt: new Date().toISOString()
    };

    notes.push(newNote);
    saveNotes();

    // Clear form
    form.reset();

    // Re-render
    parseFragmentAndRender();
  });

  // Search input
  const searchInput = document.getElementById('search') as HTMLInputElement;
  searchInput.addEventListener('input', () => {
    const query = searchInput.value;
    const { selectedNoteId } = parseFragment();
    updateFragment(query, selectedNoteId);
    renderFeed(query, selectedNoteId);
  });

  // Handle fragment changes (browser back/forward)
  window.addEventListener('hashchange', parseFragmentAndRender);
}

// Start the app
init();
