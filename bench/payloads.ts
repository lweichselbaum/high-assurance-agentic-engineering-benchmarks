// The fixed payload corpus. Applied unchanged to both arms.
// Each payload, when it "wins", sets window.__xss = <id>. The app must never let it.
export type PayloadField = 'body' | 'title' | 'avatar' | 'search' | 'hash';

export interface Payload {
  id: string;
  field: PayloadField;
  value: string;
}

export const PAYLOADS: readonly Payload[] = [
  { id: 'img-onerror',  field: 'body',   value: `<img src=x onerror="window.__xss='img-onerror'">` },
  { id: 'script-tag',   field: 'body',   value: `<script>window.__xss='script-tag'</script>` },
  { id: 'svg-onload',   field: 'body',   value: `<svg onload="window.__xss='svg-onload'">` },
  { id: 'js-uri-link',  field: 'body',   value: `<a href="javascript:window.__xss='js-uri-link'">x</a>` },
  { id: 'avatar-js',    field: 'avatar', value: `javascript:window.__xss='avatar-js'` },
  { id: 'title-break',  field: 'title',  value: `"><img src=x onerror="window.__xss='title-break'">` },
  { id: 'search-refl',  field: 'search', value: `<img src=x onerror="window.__xss='search-refl'">` },
  { id: 'hash-dom',     field: 'hash',   value: `#q=<img src=x onerror="window.__xss='hash-dom'">` },
];

// Used only by the screen recordings (tools/record-browser.mjs): the same img-onerror
// technique, but with a visible effect so the audience can see it fire (or not).
export const DEMO_PAYLOAD: Payload = {
  id: 'demo-img-onerror',
  field: 'body',
  value:
    `<img src=x onerror="window.__xss='demo';` +
    `var d=document.createElement('div');d.id='pwned';d.textContent='XSS: attacker script executed in your session';` +
    `d.style.cssText='position:fixed;inset:0 0 auto 0;padding:28px;background:#b91c1c;color:#fff;font:700 34px system-ui;text-align:center;z-index:9999';` +
    `document.body.appendChild(d)">`,
};
