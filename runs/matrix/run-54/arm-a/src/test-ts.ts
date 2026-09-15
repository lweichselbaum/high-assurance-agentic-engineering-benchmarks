import DOMPurify from 'dompurify';
function foo() {
  const frag = DOMPurify.sanitize('<b>hi</b>', { RETURN_DOM_FRAGMENT: true });
  document.body.appendChild(frag);
}
