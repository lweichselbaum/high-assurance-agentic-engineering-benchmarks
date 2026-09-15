import DOMPurify from 'dompurify';
const d = document.createElement('div');
d.innerHTML = DOMPurify.sanitize('<b>safe</b>', {RETURN_TRUSTED_TYPE: true}) as TrustedHTML;
