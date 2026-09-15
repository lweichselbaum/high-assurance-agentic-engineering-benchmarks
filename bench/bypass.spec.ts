import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { BYPASS_PAYLOADS } from './bypass-payloads.ts';
import { addNote, armPage, openApp, settle, xssFired, type NoteInput } from './drive.ts';
import { SEL } from './contract.ts';
import { armFromEnv, RUNS } from './arms.ts';

// Informational probe, beyond the fixed corpus. Records only; never asserts (the scorecard's xssFired
// stays defined by bench/payloads.ts). Results → runs/bypass-<arm>.jsonl
const arm = armFromEnv();
const outFile = path.join(RUNS, `bypass-${arm.id}.jsonl`);

async function trigger(page: import('@playwright/test').Page, kind: string) {
  const base = `http://127.0.0.1:${arm.port}`;
  const note = page.locator(SEL.note).first();
  if (kind === 'click') {
    const links = note.locator('a, svg a, [href]');
    const n = await links.count();
    for (let i = 0; i < n; i++) {
      try {
        await links.nth(i).click({ noWaitAfter: true, force: true, timeout: 1500 });
      } catch {
        /* not clickable */
      }
      await settle(page, 200);
      if ((await xssFired(page)) !== null) return;
      // A real (non-javascript:) link navigates away; the benchmark blocks the request, so come back.
      if (!page.url().startsWith(base)) {
        await openApp(page).catch(() => undefined);
        return;
      }
    }
  } else if (kind === 'hover') {
    const els = note.locator('*');
    const n = Math.min(await els.count(), 25);
    for (let i = 0; i < n; i++) {
      try {
        await els.nth(i).hover({ force: true, timeout: 1000 });
      } catch {
        /* not hoverable */
      }
      if ((await xssFired(page)) !== null) return;
    }
  }
}

for (const p of BYPASS_PAYLOADS) {
  test(`bypass probe ${p.id}`, async ({ page }) => {
    await armPage(page);
    await openApp(page);
    const note: NoteInput = { title: 'probe', body: 'probe body', avatar: '' };
    note[p.field as 'title' | 'body' | 'avatar'] = p.value;
    await addNote(page, note);
    await settle(page);
    let fired = (await xssFired(page)) !== null;
    if (!fired) {
      await trigger(page, p.trigger);
      fired = (await xssFired(page)) !== null;
    }
    if (!fired) {
      await page.reload();
      await settle(page);
      fired = (await xssFired(page)) !== null;
      if (!fired) {
        await trigger(page, p.trigger);
        fired = (await xssFired(page)) !== null;
      }
    }
    const renderedBody = await page
      .locator(SEL.note)
      .first()
      .locator(SEL.noteBody)
      .innerHTML({ timeout: 2_000 })
      .catch(() => '');
    fs.appendFileSync(outFile, JSON.stringify({ type: 'bypass', id: p.id, field: p.field, fired, rendered: renderedBody.slice(0, 200) }) + '\n');
  });
}
