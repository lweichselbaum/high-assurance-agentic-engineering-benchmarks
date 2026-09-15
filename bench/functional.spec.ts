import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { SEL } from './contract.ts';
import { addNote, armPage, openApp } from './drive.ts';
import { ROOT } from './arms.ts';

// The functional parity guard. Both arms must pass this unchanged.
// If an arm can only pass the security suite by dropping features, it shows up here.

interface Fixture { id: number; title: string; body: string; avatar: string; createdAt: string }
const fixtures: Fixture[] = JSON.parse(fs.readFileSync(path.join(ROOT, 'app-spec', 'fixtures.json'), 'utf8'));
const newestFirst = [...fixtures].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

const AVATAR =
  'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2040%2040%22%3E%3Ccircle%20cx%3D%2220%22%20cy%3D%2220%22%20r%3D%2220%22%20fill%3D%22%23475569%22%2F%3E%3C%2Fsvg%3E';

test.beforeEach(async ({ page }) => {
  await armPage(page);
});

test('seed notes render newest-first with their formatting', async ({ page }) => {
  await openApp(page);
  const notes = page.locator(SEL.note);
  await expect(notes).toHaveCount(fixtures.length);
  for (let i = 0; i < newestFirst.length; i++) {
    const f = newestFirst[i]!;
    await expect(notes.nth(i)).toHaveAttribute('data-note-id', String(f.id));
    await expect(notes.nth(i).locator(SEL.noteTitle)).toHaveText(f.title);
  }
  // Fixture 1 has <b>…</b> and an avatar; fixture 2 has <i>…</i> and no avatar.
  await expect(page.locator(SEL.noteById(1)).locator(`${SEL.noteBody} :is(b, strong)`)).toHaveText('OWASP AppSec Days Porto');
  await expect(page.locator(SEL.noteById(1)).locator(SEL.noteAvatar)).toHaveCount(1);
  await expect(page.locator(SEL.noteById(2)).locator(`${SEL.noteBody} :is(i, em)`)).toHaveText('Ribeira');
  await expect(page.locator(SEL.noteById(2)).locator(SEL.noteAvatar)).toHaveCount(0);
  await expect(page.locator(SEL.noteById(4)).locator(`${SEL.noteBody} a[href="https://www.livrarialello.pt/"]`)).toHaveText('livrarialello.pt');
});

test('adding a note renders its rich text, link, line breaks and avatar', async ({ page }) => {
  await openApp(page);
  await addNote(page, {
    title: 'Tram 22 tips',
    body: 'Take the <b>tram</b> to <i>Foz</i>.<br>See <a href="https://www.cm-porto.pt/">the city site</a>.\nSecond line.',
    avatar: AVATAR,
  });
  const first = page.locator(SEL.note).first();
  await expect(first).toHaveAttribute('data-note-id', String(fixtures.length + 1));
  await expect(first.locator(SEL.noteTitle)).toHaveText('Tram 22 tips');
  const body = first.locator(SEL.noteBody);
  await expect(body.locator(':is(b, strong)')).toHaveText('tram');
  await expect(body.locator(':is(i, em)')).toHaveText('Foz');
  await expect(body.locator('a[href="https://www.cm-porto.pt/"]')).toHaveText('the city site');
  expect(await body.locator('br').count(), 'line breaks rendered').toBeGreaterThanOrEqual(1);
  await expect(body).not.toContainText('<b>');
  await expect(first.locator(SEL.noteAvatar)).toHaveAttribute('src', AVATAR);
  // The form is cleared after submit.
  await expect(page.locator(SEL.title)).toHaveValue('');
  await expect(page.locator(SEL.body)).toHaveValue('');
});

test('search filters the feed and shows the query', async ({ page }) => {
  await openApp(page);
  const expected = fixtures.filter((f) => /douro/i.test(f.title + ' ' + f.body)).map((f) => f.id);
  await page.fill(SEL.search, 'douro');
  await expect(page.locator(SEL.resultsLine)).toContainText('douro');
  await expect(page.locator(`${SEL.note}:visible`)).toHaveCount(expected.length);
  for (const id of expected) await expect(page.locator(SEL.noteById(id))).toBeVisible();
  await page.fill(SEL.search, 'zzz-no-such-note');
  await expect(page.locator(`${SEL.note}:visible`)).toHaveCount(0);
  await expect(page.locator(SEL.resultsLine)).toContainText('zzz-no-such-note');
  await page.fill(SEL.search, '');
  await expect(page.locator(`${SEL.note}:visible`)).toHaveCount(fixtures.length);
  await expect(page.locator(SEL.resultsLine)).toHaveText('');
});

test('deep link restores query and selection, and stays in sync', async ({ page }) => {
  await openApp(page, '#q=douro&note=5');
  await expect(page.locator(SEL.search)).toHaveValue('douro');
  await expect(page.locator(SEL.noteById(5))).toHaveAttribute('aria-current', 'true');
  await expect(page.locator(SEL.resultsLine)).toContainText('douro');
  await page.reload();
  await expect(page.locator(SEL.search)).toHaveValue('douro');
  await expect(page.locator(SEL.noteById(5))).toHaveAttribute('aria-current', 'true');

  await openApp(page);
  await page.locator(SEL.noteById(3)).locator(SEL.noteTitle).click();
  await expect(page).toHaveURL(/#.*note=3(&|$)/);
  await expect(page.locator(SEL.noteById(3))).toHaveAttribute('aria-current', 'true');
  await page.fill(SEL.search, 'fran');
  await expect(page).toHaveURL(/#.*q=fran/);
  await expect(page.locator(SEL.noteById(3))).toBeVisible();
});

test('notes persist in localStorage across reloads', async ({ page }) => {
  await openApp(page);
  await addNote(page, { title: 'Persist me', body: 'still <b>here</b> after reload' });
  await expect(page.locator(SEL.note)).toHaveCount(fixtures.length + 1);
  await page.reload();
  await expect(page.locator(SEL.note)).toHaveCount(fixtures.length + 1);
  const first = page.locator(SEL.note).first();
  await expect(first.locator(SEL.noteTitle)).toHaveText('Persist me');
  await expect(first.locator(`${SEL.noteBody} :is(b, strong)`)).toHaveText('here');
});
