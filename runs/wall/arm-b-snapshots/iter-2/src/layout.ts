export interface AppElements {
  form: HTMLFormElement;
  titleInput: HTMLInputElement;
  bodyInput: HTMLTextAreaElement;
  avatarInput: HTMLInputElement;
  searchInput: HTMLInputElement;
  resultsLine: HTMLParagraphElement;
  feed: HTMLElement;
}

function field(labelText: string, input: HTMLInputElement | HTMLTextAreaElement): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  const label = document.createElement('label');
  label.htmlFor = input.id;
  label.textContent = labelText;
  wrap.append(label, input);
  return wrap;
}

export function buildApp(root: HTMLElement): AppElements {
  const heading = document.createElement('h1');
  heading.textContent = 'Porto Notes';

  const form = document.createElement('form');
  form.id = 'note-form';

  const titleInput = document.createElement('input');
  titleInput.id = 'title';
  titleInput.name = 'title';
  titleInput.type = 'text';
  titleInput.required = true;
  titleInput.autocomplete = 'off';

  const bodyInput = document.createElement('textarea');
  bodyInput.id = 'body';
  bodyInput.name = 'body';
  bodyInput.required = true;
  bodyInput.rows = 4;
  bodyInput.placeholder = 'Use <b>, <i>, <a href="...">…</a>, or press Enter for a line break';

  const avatarInput = document.createElement('input');
  avatarInput.id = 'avatar';
  avatarInput.name = 'avatar';
  avatarInput.type = 'text';
  avatarInput.autocomplete = 'off';
  avatarInput.placeholder = 'https://… or data:image/…  (optional)';

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = 'Add note';

  form.append(
    field('Title', titleInput),
    field('Body', bodyInput),
    field('Avatar URL', avatarInput),
    submit,
  );

  const searchWrap = document.createElement('div');
  searchWrap.className = 'search-wrap';
  const searchLabel = document.createElement('label');
  searchLabel.htmlFor = 'search';
  searchLabel.textContent = 'Search notes';
  const searchInput = document.createElement('input');
  searchInput.id = 'search';
  searchInput.type = 'search';
  searchInput.autocomplete = 'off';
  const resultsLine = document.createElement('p');
  resultsLine.id = 'results-line';
  searchWrap.append(searchLabel, searchInput, resultsLine);

  const feed = document.createElement('section');
  feed.id = 'feed';
  feed.setAttribute('aria-label', 'Notes');

  root.append(heading, form, searchWrap, feed);

  return { form, titleInput, bodyInput, avatarInput, searchInput, resultsLine, feed };
}
