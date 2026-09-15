import DOMPurify from 'dompurify';
import { setAnchorHref } from 'safevalues/dom';

interface Note {
  id: number;
  title: string;
  body: string;
  avatar: string;
  createdAt: string;
}

interface RichNode {
  type: 'text' | 'tag';
  content?: string;
  tag?: string;
  href?: string;
  children?: RichNode[];
}

const STORAGE_KEY = 'porto-notes';
const ALLOWED_AVATAR_SCHEMES = ['http://', 'https://', 'data:image/'];

let notes: Note[] = [];
let nextId = 1;
let selectedNoteId: number | null = null;
let searchQuery = '';

async function loadFixtures(): Promise<Note[]> {
  const response = await fetch('/fixtures.json');
  return response.json();
}

async function loadNotes(): Promise<void> {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    notes = JSON.parse(stored);
    nextId = Math.max(...notes.map(n => n.id), 0) + 1;
  } else {
    const fixtures = await loadFixtures();
    notes = fixtures;
    nextId = Math.max(...notes.map(n => n.id), 0) + 1;
    saveNotes();
  }
}

function saveNotes(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function isValidAvatarUrl(url: string): boolean {
  if (!url) return false;
  return ALLOWED_AVATAR_SCHEMES.some(scheme => url.startsWith(scheme));
}

function parseRichText(text: string): RichNode[] {
  const nodes: RichNode[] = [];
  const tokens: Array<{ type: string; value: string }> = [];
  let current = '';
  let i = 0;

  while (i < text.length) {
    if (text[i] === '<') {
      if (current) tokens.push({ type: 'text', value: current });
      current = '';

      // Try to match a tag
      const tagMatch = text.substring(i).match(/^<(b|strong|i|em|\/b|\/strong|\/i|\/em|br)>/);
      const linkMatch = text.substring(i).match(/^<a href="([^"]*)">/)  ;
      const closeLink = text.substring(i).match(/^<\/a>/);

      if (tagMatch) {
        const tag = tagMatch[1]!;
        tokens.push({ type: 'tag', value: tag });
        i += tagMatch[0].length;
      } else if (linkMatch) {
        const href = linkMatch[1]!;
        tokens.push({ type: 'link-start', value: href });
        i += linkMatch[0].length;
      } else if (closeLink) {
        tokens.push({ type: 'link-end', value: '' });
        i += closeLink[0].length;
      } else {
        // Not a recognized tag, treat < as text but escape it
        current += '&lt;';
        i++;
      }
    } else if (text[i] === '&') {
      current += '&amp;';
      i++;
    } else if (text[i] === '\n') {
      if (current) tokens.push({ type: 'text', value: current });
      current = '';
      tokens.push({ type: 'tag', value: 'br' });
      i++;
    } else {
      current += text[i];
      i++;
    }
  }

  if (current) tokens.push({ type: 'text', value: current });

  // Convert tokens to nodes using a simple stack-based parser
  const stack: any[] = [];

  for (const token of tokens) {
    if (token.type === 'text') {
      if (stack.length > 0) {
        stack[stack.length - 1].children.push({ type: 'text', content: token.value });
      } else {
        nodes.push({ type: 'text', content: token.value });
      }
    } else if (token.type === 'tag') {
      const tag = token.value;
      if (tag === 'br') {
        if (stack.length > 0) {
          stack[stack.length - 1].children!.push({ type: 'tag', tag: 'br' });
        } else {
          nodes.push({ type: 'tag', tag: 'br' });
        }
      } else if (tag === 'b' || tag === 'strong' || tag === 'i' || tag === 'em') {
        const node: RichNode = { type: 'tag', tag, children: [] };
        if (stack.length > 0) {
          stack[stack.length - 1].children!.push(node);
        } else {
          nodes.push(node);
        }
        stack.push(node);
      } else if (tag === '/b' || tag === '/strong' || tag === '/i' || tag === '/em') {
        if (stack.length > 0) {
          const node = stack.pop();
          for (const child of node.children || []) {
            nodes.push(child);
          }
        }
      }
    } else if (token.type === 'link-start') {
      const node: RichNode = { type: 'tag', tag: 'a', href: token.value, children: [] };
      if (stack.length > 0) {
        stack[stack.length - 1].children!.push(node);
      } else {
        nodes.push(node);
      }
      stack.push(node);
    } else if (token.type === 'link-end') {
      if (stack.length > 0) {
        stack.pop();
      }
    }
  }

  return nodes;
}

function renderRichText(nodes: RichNode[], parent: HTMLElement): void {
  for (const node of nodes) {
    if (node.type === 'text' && node.content) {
      parent.appendChild(document.createTextNode(node.content));
    } else if (node.tag === 'br') {
      parent.appendChild(document.createElement('br'));
    } else if (node.tag === 'b' || node.tag === 'strong') {
      const el = document.createElement('b');
      if (node.children) {
        renderRichText(node.children, el);
      }
      parent.appendChild(el);
    } else if (node.tag === 'i' || node.tag === 'em') {
      const el = document.createElement('i');
      if (node.children) {
        renderRichText(node.children, el);
      }
      parent.appendChild(el);
    } else if (node.tag === 'a' && node.href) {
      const el = document.createElement('a');
      setAnchorHref(el, node.href);
      el.target = '_blank';
      if (node.children) {
        renderRichText(node.children, el);
      }
      parent.appendChild(el);
    }
  }
}

function filterNotes(query: string): Note[] {
  const filtered = query
    ? notes.filter(
        note =>
          note.title.toLowerCase().includes(query.toLowerCase()) ||
          note.body.toLowerCase().includes(query.toLowerCase())
      )
    : notes;
  return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function clearElement(el: HTMLElement): void {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

function render(): void {
  const app = document.getElementById('app');
  if (!app) return;

  const filtered = filterNotes(searchQuery);

  clearElement(app);

  // Title
  const header = document.createElement('header');
  const title = document.createElement('h1');
  title.textContent = 'Porto Notes';
  header.appendChild(title);
  app.appendChild(header);

  // Form
  const form = document.createElement('form');
  form.id = 'note-form';

  const titleInput = document.createElement('input');
  titleInput.id = 'title';
  titleInput.type = 'text';
  titleInput.placeholder = 'Note title';
  titleInput.required = true;
  form.appendChild(titleInput);

  const bodyLabel = document.createElement('label');
  bodyLabel.htmlFor = 'body';
  bodyLabel.textContent = 'Body (supports <b>, <i>, <a href="..."> and <br>)';
  form.appendChild(bodyLabel);

  const bodyTextarea = document.createElement('textarea');
  bodyTextarea.id = 'body';
  bodyTextarea.placeholder = 'Note body with rich text support';
  bodyTextarea.required = true;
  form.appendChild(bodyTextarea);

  const avatarInput = document.createElement('input');
  avatarInput.id = 'avatar';
  avatarInput.type = 'url';
  avatarInput.placeholder = 'Avatar URL (optional)';
  form.appendChild(avatarInput);

  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.textContent = 'Add Note';
  form.appendChild(submitButton);

  form.addEventListener('submit', e => {
    e.preventDefault();
    const title = titleInput.value.trim();
    const body = bodyTextarea.value.trim();
    const avatar = avatarInput.value.trim();

    if (!title || !body) return;

    const newNote: Note = {
      id: nextId++,
      title,
      body,
      avatar: isValidAvatarUrl(avatar) ? avatar : '',
      createdAt: new Date().toISOString(),
    };

    notes.unshift(newNote);
    saveNotes();

    titleInput.value = '';
    bodyTextarea.value = '';
    avatarInput.value = '';
    searchQuery = '';
    selectedNoteId = null;

    updateUrl();
    render();
  });

  app.appendChild(form);

  // Search
  const searchContainer = document.createElement('div');
  const searchInput = document.createElement('input');
  searchInput.id = 'search';
  searchInput.type = 'text';
  searchInput.placeholder = 'Search notes...';
  searchInput.value = searchQuery;
  searchInput.addEventListener('input', e => {
    searchQuery = (e.target as HTMLInputElement).value;
    selectedNoteId = null;
    updateUrl();
    render();
  });
  searchContainer.appendChild(searchInput);

  const resultsLine = document.createElement('p');
  resultsLine.id = 'results-line';
  if (searchQuery) {
    resultsLine.textContent = `results for "${searchQuery}"`;
  }
  searchContainer.appendChild(resultsLine);

  app.appendChild(searchContainer);

  // Feed
  const feed = document.createElement('section');
  feed.id = 'feed';

  for (const note of filtered) {
    const article = document.createElement('article');
    article.className = 'note';
    article.setAttribute('data-note-id', String(note.id));
    if (selectedNoteId === note.id) {
      article.setAttribute('aria-current', 'true');
    }

    // Avatar
    if (note.avatar && isValidAvatarUrl(note.avatar)) {
      const img = document.createElement('img');
      img.className = 'note-avatar';
      img.src = note.avatar;
      img.alt = '';
      article.appendChild(img);
    }

    // Title
    const noteTitle = document.createElement('h2');
    noteTitle.className = 'note-title';
    noteTitle.style.cursor = 'pointer';
    noteTitle.textContent = note.title;
    noteTitle.addEventListener('click', () => {
      selectedNoteId = selectedNoteId === note.id ? null : note.id;
      updateUrl();
      render();
    });
    article.appendChild(noteTitle);

    // Body
    const noteBody = document.createElement('div');
    noteBody.className = 'note-body';
    const richNodes = parseRichText(note.body);
    renderRichText(richNodes, noteBody);
    article.appendChild(noteBody);

    feed.appendChild(article);
  }

  app.appendChild(feed);
}

function updateUrl(): void {
  const hash = new URLSearchParams();
  if (searchQuery) {
    hash.set('q', searchQuery);
  }
  if (selectedNoteId) {
    hash.set('note', String(selectedNoteId));
  }

  const hashString = hash.toString() ? '#' + hash.toString() : '';
  window.history.replaceState(null, '', hashString || location.pathname);
}

function parseUrl(): void {
  const hash = location.hash.slice(1);
  const params = new URLSearchParams(hash);
  searchQuery = params.get('q') || '';
  selectedNoteId = params.has('note') ? parseInt(params.get('note')!) : null;
}

async function init(): Promise<void> {
  parseUrl();
  await loadNotes();
  render();

  window.addEventListener('hashchange', () => {
    parseUrl();
    render();
  });
}

init();
