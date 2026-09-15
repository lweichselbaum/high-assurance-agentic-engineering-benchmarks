export interface AppElements {
  form: HTMLFormElement;
  titleInput: HTMLInputElement;
  bodyInput: HTMLTextAreaElement;
  avatarInput: HTMLInputElement;
  searchInput: HTMLInputElement;
  resultsLine: HTMLParagraphElement;
  feed: HTMLElement;
}

function labeledField<T extends HTMLElement>(labelText: string, field: T): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const label = document.createElement('label');
  label.htmlFor = field.id;
  label.textContent = labelText;
  fragment.append(label, field);
  return fragment;
}

export function buildLayout(root: HTMLElement): AppElements {
  const heading = document.createElement('h1');
  heading.textContent = 'Porto Notes';

  const form = document.createElement('form');
  form.id = 'note-form';
  form.setAttribute('aria-label', 'Add a note');

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

  const avatarInput = document.createElement('input');
  avatarInput.id = 'avatar';
  avatarInput.name = 'avatar';
  avatarInput.type = 'text';
  avatarInput.autocomplete = 'off';
  avatarInput.placeholder = 'https://example.com/avatar.png';

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = 'Add note';

  form.append(
    labeledField('Title', titleInput),
    labeledField('Body (supports <b>, <i>, <a href>, line breaks)', bodyInput),
    labeledField('Avatar URL (optional)', avatarInput),
    submit,
  );

  const searchWrap = document.createElement('div');
  searchWrap.className = 'search-wrap';
  const searchInput = document.createElement('input');
  searchInput.id = 'search';
  searchInput.type = 'search';
  searchInput.autocomplete = 'off';
  searchWrap.append(labeledField('Search notes', searchInput));

  const resultsLine = document.createElement('p');
  resultsLine.id = 'results-line';
  resultsLine.setAttribute('aria-live', 'polite');

  const feed = document.createElement('section');
  feed.id = 'feed';
  feed.setAttribute('aria-label', 'Notes');

  root.append(heading, form, searchWrap, resultsLine, feed);

  return { form, titleInput, bodyInput, avatarInput, searchInput, resultsLine, feed };
}
