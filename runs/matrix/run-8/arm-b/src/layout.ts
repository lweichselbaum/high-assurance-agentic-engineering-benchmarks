// Porto Notes — builds the static page skeleton with document.createElement (no HTML strings).

export interface AppElements {
  readonly form: HTMLFormElement;
  readonly titleInput: HTMLInputElement;
  readonly bodyInput: HTMLTextAreaElement;
  readonly avatarInput: HTMLInputElement;
  readonly searchInput: HTMLInputElement;
  readonly resultsLine: HTMLParagraphElement;
  readonly feed: HTMLElement;
}

function labeled(labelText: string, field: HTMLElement): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'field';
  const label = document.createElement('label');
  label.textContent = labelText;
  if (field.id) label.htmlFor = field.id;
  wrapper.append(label, field);
  return wrapper;
}

export function buildLayout(root: HTMLElement): AppElements {
  root.replaceChildren();

  const heading = document.createElement('h1');
  heading.textContent = 'Porto Notes';
  root.appendChild(heading);

  const form = document.createElement('form');
  form.id = 'note-form';
  form.noValidate = true;

  const titleInput = document.createElement('input');
  titleInput.id = 'title';
  titleInput.name = 'title';
  titleInput.type = 'text';
  titleInput.autocomplete = 'off';
  titleInput.required = true;

  const bodyInput = document.createElement('textarea');
  bodyInput.id = 'body';
  bodyInput.name = 'body';
  bodyInput.rows = 4;
  bodyInput.required = true;

  const avatarInput = document.createElement('input');
  avatarInput.id = 'avatar';
  avatarInput.name = 'avatar';
  avatarInput.type = 'text';
  avatarInput.autocomplete = 'off';
  avatarInput.placeholder = 'https://…';

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = 'Add note';

  form.append(
    labeled('Title', titleInput),
    labeled('Body (supports <b>, <i>, <a href>, line breaks)', bodyInput),
    labeled('Avatar URL (optional)', avatarInput),
    submit,
  );

  const searchInput = document.createElement('input');
  searchInput.id = 'search';
  searchInput.name = 'search';
  searchInput.type = 'search';
  searchInput.placeholder = 'Search notes…';

  const searchSection = document.createElement('div');
  searchSection.className = 'search';
  searchSection.appendChild(labeled('Search', searchInput));

  const resultsLine = document.createElement('p');
  resultsLine.id = 'results-line';
  searchSection.appendChild(resultsLine);

  const feed = document.createElement('section');
  feed.id = 'feed';
  feed.setAttribute('aria-label', 'Notes');

  root.append(form, searchSection, feed);

  return { form, titleInput, bodyInput, avatarInput, searchInput, resultsLine, feed };
}
