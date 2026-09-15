export interface UrlState {
  query: string;
  noteId: number | null;
}

export function parseUrlFragment(): UrlState {
  const rawHash = window.location.hash;
  const hash = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;

  if (!hash) {
    return { query: '', noteId: null };
  }

  const params = new URLSearchParams(hash);
  const q = params.get('q') ?? '';
  const noteParam = params.get('note');
  let noteId: number | null = null;

  if (noteParam !== null && noteParam !== '') {
    const parsed = parseInt(noteParam, 10);
    if (!isNaN(parsed) && Number.isInteger(parsed)) {
      noteId = parsed;
    }
  }

  return { query: q, noteId };
}

export function buildUrlFragment(query: string, noteId: number | null): string {
  const parts: string[] = [];
  const trimmed = query.trim();
  if (trimmed.length > 0) {
    parts.push(`q=${encodeURIComponent(trimmed)}`);
  }
  if (noteId !== null && noteId !== undefined) {
    parts.push(`note=${noteId}`);
  }
  return parts.join('&');
}

export function syncUrlFragment(query: string, noteId: number | null): void {
  const fragment = buildUrlFragment(query, noteId);
  const targetHash = fragment ? `#${fragment}` : '';
  const currentHash = window.location.hash;

  if (currentHash !== targetHash) {
    const base = `${window.location.pathname}${window.location.search}`;
    const newUrl = fragment ? `${base}#${fragment}` : base;
    history.replaceState(null, '', newUrl);
  }
}
