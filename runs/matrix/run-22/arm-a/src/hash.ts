// The URL fragment carries the deep link: `#q=<query>&note=<id>`.

export interface Deeplink {
  query: string;
  selectedId: number | null;
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

export function parseHash(hash: string): Deeplink {
  const link: Deeplink = { query: '', selectedId: null };
  for (const part of hash.replace(/^#/, '').split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    const key = eq === -1 ? part : part.slice(0, eq);
    const value = eq === -1 ? '' : part.slice(eq + 1);
    if (key === 'q') {
      link.query = decode(value);
    } else if (key === 'note') {
      const id = Number.parseInt(decode(value), 10);
      if (Number.isFinite(id)) link.selectedId = id;
    }
  }
  return link;
}

export function buildHash(link: Deeplink): string {
  const parts: string[] = [];
  if (link.query) parts.push(`q=${encodeURIComponent(link.query)}`);
  if (link.selectedId !== null) parts.push(`note=${link.selectedId}`);
  return parts.length ? `#${parts.join('&')}` : '';
}
