import type { Page } from '@playwright/test';
import { SEL } from './contract.ts';
import type { Payload } from './payloads.ts';

declare global {
  interface Window {
    __xss: string | null;
    __csp: string[];
  }
}

export interface PageProbe {
  dialogs: number;
  pageErrors: string[];
}

/**
 * Arms a fresh page for the benchmark:
 *  - no network: only the arm's own server is reachable (a payload's success is unambiguous)
 *  - window.__xss sentinel + CSP violation listener installed before any app code runs
 *  - dialogs are dismissed and counted
 */
export async function armPage(page: Page): Promise<PageProbe> {
  const probe: PageProbe = { dialogs: 0, pageErrors: [] };
  await page.route('**/*', (route) => {
    const host = new URL(route.request().url()).hostname;
    if (host === '127.0.0.1' || host === 'localhost') return route.continue();
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(() => {
    window.__xss = null;
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__csp.push(`${e.violatedDirective}${e.sample ? ' ' + e.sample.slice(0, 80) : ''}`);
    });
  });
  page.on('dialog', (d) => {
    probe.dialogs += 1;
    void d.dismiss();
  });
  page.on('pageerror', (e) => probe.pageErrors.push(String(e.message ?? e)));
  return probe;
}

export async function openApp(page: Page, hash = ''): Promise<void> {
  await page.goto('/' + hash);
  await waitForApp(page);
}

export async function waitForApp(page: Page): Promise<void> {
  await page.locator(SEL.feed).waitFor({ state: 'attached', timeout: 10_000 });
  await page.locator(SEL.form).waitFor({ state: 'attached', timeout: 10_000 });
}

export interface NoteInput {
  title: string;
  body: string;
  avatar?: string;
}

export async function addNote(page: Page, note: NoteInput): Promise<void> {
  await page.fill(SEL.title, note.title);
  await page.fill(SEL.body, note.body);
  await page.fill(SEL.avatar, note.avatar ?? '');
  await page.locator(SEL.submit).first().click();
}

export async function settle(page: Page, ms = 700): Promise<void> {
  await page.waitForTimeout(ms);
}

export async function xssFired(page: Page): Promise<string | null> {
  return page.evaluate(() => window.__xss);
}

export async function cspViolations(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__csp ?? []);
}

/**
 * Clicks every javascript: link the app rendered (stored js-URI XSS needs a click).
 * A javascript: navigation whose script returns a string replaces the document with that string,
 * so "the app is gone and the page is just the payload's result" also counts as execution.
 */
async function clickJavascriptLinks(page: Page): Promise<{ links: number; executed: boolean }> {
  const links = page.locator(`${SEL.feed} a[href^="javascript:" i]`);
  const n = await links.count();
  let executed = false;
  for (let i = 0; i < n && !executed; i++) {
    try {
      await links.nth(i).click({ noWaitAfter: true, force: true, timeout: 2_000 });
    } catch {
      /* hidden / detached — nothing to click */
    }
    await settle(page, 300);
    executed = await page.evaluate(() => {
      if (window.__xss !== null && window.__xss !== undefined) return true;
      const text = (document.body?.textContent ?? '').trim();
      return document.querySelector('#feed') === null && text.length > 0 && text.length < 200;
    });
  }
  return { links: n, executed };
}

export interface PayloadResult {
  id: string;
  field: Payload['field'];
  fired: boolean;
  how: string | null; // which observation caught it
  firedImmediately: boolean;
  firedOnClick: boolean;
  firedAfterReload: boolean;
  javascriptLinksRendered: number;
  javascriptAvatarRendered: boolean;
  csp: string[];
  pageErrors: string[];
  dialogs: number;
}

/**
 * Drives one payload through the app exactly as a user (or attacker) would:
 * submit it through its field, or navigate to the fragment; then observe immediately,
 * after clicking any javascript: links, and again after a reload (stored XSS).
 */
export async function drivePayload(page: Page, probe: PageProbe, p: Payload): Promise<PayloadResult> {
  switch (p.field) {
    case 'body':
    case 'title':
    case 'avatar': {
      await openApp(page);
      const note: NoteInput = { title: 'benchmark note', body: 'benchmark body', avatar: '' };
      note[p.field] = p.value;
      await addNote(page, note);
      break;
    }
    case 'search': {
      await openApp(page);
      await page.fill(SEL.search, p.value);
      break;
    }
    case 'hash': {
      // The app writes the fragment with URLSearchParams-style encoding; navigate the same way.
      const q = p.value.replace(/^#q=/, '');
      await openApp(page, '#q=' + encodeURIComponent(q));
      break;
    }
  }
  await settle(page);
  const firedImmediately = (await xssFired(page)) !== null;

  const clicked = await clickJavascriptLinks(page);
  const jsLinks = clicked.links;
  const firedOnClick = !firedImmediately && clicked.executed;

  const javascriptAvatarRendered =
    (await page.locator(`${SEL.feed} ${SEL.noteAvatar}[src^="javascript:" i]`).count()) > 0;

  await page.reload();
  await waitForApp(page).catch(() => undefined);
  await settle(page);
  let firedAfterReload = (await xssFired(page)) !== null;
  if (!firedAfterReload) firedAfterReload = (await clickJavascriptLinks(page)).executed;

  const fired = firedImmediately || firedOnClick || firedAfterReload;
  const how = firedImmediately
    ? 'executed on submit/navigation'
    : firedOnClick
      ? 'executed when the rendered javascript: link was clicked'
      : firedAfterReload
        ? 'executed when the stored note was re-rendered after reload'
        : null;

  return {
    id: p.id,
    field: p.field,
    fired,
    how,
    firedImmediately,
    firedOnClick,
    firedAfterReload,
    javascriptLinksRendered: jsLinks,
    javascriptAvatarRendered,
    csp: await cspViolations(page),
    pageErrors: probe.pageErrors.slice(),
    dialogs: probe.dialogs,
  };
}
