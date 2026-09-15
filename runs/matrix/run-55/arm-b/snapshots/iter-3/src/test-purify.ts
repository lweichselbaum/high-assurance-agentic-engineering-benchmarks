import DOMPurify from 'dompurify';
const frag = DOMPurify.sanitize('test', { RETURN_DOM_FRAGMENT: true });
console.log(frag);
