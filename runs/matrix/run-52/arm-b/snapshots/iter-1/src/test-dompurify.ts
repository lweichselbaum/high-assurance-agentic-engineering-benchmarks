import DOMPurify from 'dompurify';
import { setElementInnerHtml } from 'safevalues/dom';
import { htmlSafeByReview } from 'safevalues/restricted/reviewed';

const div = document.createElement('div');
div.innerHTML = DOMPurify.sanitize('<b>Test</b>', { RETURN_TRUSTED_TYPE: true }) as unknown as string;
