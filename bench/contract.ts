// The element contract from app-spec/FEATURE_PROMPT.md, in one place.
// Both arms are built against the same prompt, so the benchmark can drive either app with these.
export const SEL = {
  form: '#note-form',
  title: '#title',
  body: '#body',
  avatar: '#avatar',
  submit: '#note-form button[type="submit"], #note-form button:not([type]), #note-form input[type="submit"]',
  search: '#search',
  resultsLine: '#results-line',
  feed: '#feed',
  note: '#feed article.note',
  noteById: (id: number | string) => `#feed article.note[data-note-id="${id}"]`,
  noteTitle: '.note-title',
  noteBody: '.note-body',
  noteAvatar: 'img.note-avatar',
} as const;
