import { expect, test } from '@playwright/test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const pages = [
  ['Tools', '/tools', 'Three tools for local AI readiness.', 'Readiness tools — DeviceBench'],
  [
    'How it works',
    '/how-it-works',
    'From setup to evidence, on your own machine.',
    'How it works — DeviceBench',
  ],
  [
    'Example report',
    '/example-report',
    'See a report before you run one.',
    'Example report — DeviceBench',
  ],
  ['Docs', '/docs', 'DeviceBench documentation', 'Start here — DeviceBench docs'],
] as const;

test('each navigation link opens its own page and history returns home', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const [label, path, heading, title] of pages) {
    await page.goto('/');
    const link = page.getByRole('navigation').getByRole('link', { name: label, exact: true });
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    await expect(page).toHaveTitle(title);
    if (label !== 'Docs') await expect(link).toHaveAttribute('aria-current', 'page');
    expect(await page.evaluate(() => scrollY)).toBe(0);
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Know if local AI');
  }
  expect(errors).toEqual([]);
});

test('pages load directly from their address', async ({ page }) => {
  for (const [, path, heading] of pages) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
  }
});

test('section links scroll to their target on another page', async ({ page }) => {
  await page.goto('/tools');
  await page.getByRole('contentinfo').getByRole('link', { name: 'Questions' }).click();
  await expect(page).toHaveURL(/\/#faq$/);
  await expect(page.getByRole('heading', { name: 'Questions, answered.' })).toBeInViewport();
});

test('unknown addresses show a not-found page with a way back', async ({ page }) => {
  await page.goto('/no-such-page');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This page doesn’t exist.');
  await expect(page).toHaveTitle('Page not found — DeviceBench');
  await page.getByRole('link', { name: 'Go to the home page' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('the build emits a page shell for every route and a 404 fallback', () => {
  const dist = join(import.meta.dirname, '..', 'dist');
  for (const route of ['tools', 'how-it-works', 'example-report', 'docs', 'docs/quickstart'])
    expect(existsSync(join(dist, route, 'index.html')), route).toBeTruthy();
  expect(existsSync(join(dist, '404.html'))).toBeTruthy();
});
