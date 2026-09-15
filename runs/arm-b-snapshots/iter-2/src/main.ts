import DOMPurify from 'dompurify';
const div = document.createElement('div');
div.appendChild(DOMPurify.sanitize('<b>hi</b>', { RETURN_DOM: true }));
