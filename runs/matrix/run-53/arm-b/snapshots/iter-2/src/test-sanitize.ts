import { sanitizeHtml, unwrapHtml } from 'safevalues';
const s = '<b>bold</b> <a href="http://example.com">link</a>';
const out = sanitizeHtml(s);
console.log(unwrapHtml(out));
