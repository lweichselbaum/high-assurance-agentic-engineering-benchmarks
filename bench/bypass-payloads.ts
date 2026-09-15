// Beyond the fixed corpus (informational; NOT part of the scorecard's xssFired):
// mutated variants of the same four techniques, aimed at hand-rolled allow-list renderers.
// Same rule: a payload "wins" when window.__xss is set.
import type { Payload } from './payloads.ts';

export interface BypassPayload extends Payload {
  /** How the probe tries to trigger it after rendering (in addition to the immediate + reload checks). */
  trigger: 'none' | 'click' | 'hover';
}

export const BYPASS_PAYLOADS: readonly BypassPayload[] = [
  { id: 'bp-js-case',      field: 'body', trigger: 'click', value: `<a href="JaVaScRiPt:window.__xss='bp-js-case'">x</a>` },
  { id: 'bp-js-space',     field: 'body', trigger: 'click', value: `<a href=" javascript:window.__xss='bp-js-space'">x</a>` },
  { id: 'bp-js-entity',    field: 'body', trigger: 'click', value: `<a href="java&#115;cript:window.__xss='bp-js-entity'">x</a>` },
  { id: 'bp-js-tab',       field: 'body', trigger: 'click', value: `<a href="jav&#x09;ascript:window.__xss='bp-js-tab'">x</a>` },
  { id: 'bp-js-newline',   field: 'body', trigger: 'click', value: `<a href="java\nscript:window.__xss='bp-js-newline'">x</a>` },
  { id: 'bp-tag-case',     field: 'body', trigger: 'click', value: `<A HREF="javascript:window.__xss='bp-tag-case'">x</A>` },
  { id: 'bp-js-single',    field: 'body', trigger: 'click', value: `<a href='javascript:window.__xss="bp-js-single"'>x</a>` },
  { id: 'bp-js-noquote',   field: 'body', trigger: 'click', value: `<a href=javascript:window.__xss='bp-js-noquote'>x</a>` },
  { id: 'bp-a-onclick',    field: 'body', trigger: 'click', value: `<a href="https://porto.pt/" onclick="window.__xss='bp-a-onclick';return false">x</a>` },
  { id: 'bp-b-hover',      field: 'body', trigger: 'hover', value: `<b onmouseover="window.__xss='bp-b-hover'">bold</b>` },
  { id: 'bp-img-case',     field: 'body', trigger: 'none',  value: `<IMG SRC=x ONERROR="window.__xss='bp-img-case'">` },
  { id: 'bp-img-space',    field: 'body', trigger: 'none',  value: `<img/src=x onerror="window.__xss='bp-img-space'">` },
  { id: 'bp-srcdoc',       field: 'body', trigger: 'none',  value: `<iframe srcdoc="<script>parent.window.__xss='bp-srcdoc'</script>"></iframe>` },
  { id: 'bp-svg-xlink',    field: 'body', trigger: 'click', value: `<svg><a xlink:href="javascript:window.__xss='bp-svg-xlink'"><text x="10" y="20">x</text></a></svg>` },
  { id: 'bp-breakout',     field: 'body', trigger: 'none',  value: `</div></article><img src=x onerror="window.__xss='bp-breakout'">` },
  { id: 'bp-nested',       field: 'body', trigger: 'none',  value: `<<b>img src=x onerror="window.__xss='bp-nested'">` },
  { id: 'bp-title-hover',  field: 'title', trigger: 'hover', value: `<b onmouseover="window.__xss='bp-title-hover'">t</b>` },
  { id: 'bp-avatar-quote', field: 'avatar', trigger: 'none', value: `https://x/" onerror="window.__xss='bp-avatar-quote'` },
];
