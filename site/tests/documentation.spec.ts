import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('tool guides resolve locally, navigate sections, and retain browser history', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page
    .locator('#tools article')
    .first()
    .getByRole('link', { name: 'Read the guide' })
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Local AI readiness toolkit');
  await expect(page.getByRole('heading', { name: 'Local AI Doctor', exact: true })).toBeFocused();
  await page
    .getByRole('navigation', { name: 'Documentation', exact: true })
    .getByRole('link', { name: 'Install and run', exact: true })
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Install and run');
  await expect(page).toHaveTitle('Install and run — DeviceBench docs');
  await page
    .getByRole('complementary', { name: 'On this page' })
    .getByRole('link', { name: 'Troubleshooting', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Troubleshooting', exact: true })).toBeFocused();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Troubleshooting', exact: true })).toBeFocused();
  await page.goBack();
  await expect(page.locator('#doc-content')).toBeFocused();
  await page.getByRole('link', { name: 'Back to product' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Ready for');
  expect(errors).toEqual([]);
});

test('all bundled guides and their internal section links have destinations', async ({ page }) => {
  await page.goto('/#/docs/overview');
  await expect(page.getByRole('navigation', { name: 'Documentation', exact: true })).toBeVisible();
  const links = await page
    .getByRole('navigation', { name: 'Documentation', exact: true })
    .getByRole('link')
    .evaluateAll((elements) => elements.map((element) => element.getAttribute('href')!));
  expect(links).toHaveLength(16);
  const sectionLinks = new Set<string>();
  for (const href of links) {
    await page.goto(`/${href}`);
    await expect(page.locator('.docs-sidebar a[aria-current="page"]')).toHaveAttribute(
      'href',
      href,
    );
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Page not found');
    const anchors = await page
      .locator('.docs-prose a[href*="?section="]')
      .evaluateAll((elements) => elements.map((element) => element.getAttribute('href')!));
    anchors.forEach((anchor) => sectionLinks.add(anchor));
  }
  for (const href of sectionLinks) {
    await page.goto(`/${href}`);
    const id = new URLSearchParams(href.split('?')[1]).get('section')!;
    await expect(page.locator(`[id="${id}"]`)).toBeVisible();
  }
  await page.goto('/#/docs/engine-results');
  await expect(page.locator('.local-evidence').first()).toContainText('local evidence file');
  await expect(page.locator('.docs-prose a[href*="/reports/"]')).toHaveCount(0);
});

test('documentation remains readable and accessible at desktop and mobile widths', async ({
  page,
}, testInfo) => {
  await page.goto('/#/docs/overview');
  await page.evaluate(() => document.fonts.ready);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('documentation-desktop.png'), fullPage: true });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBeTruthy();
  }
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.goto('/#/docs/quickstart');
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath('documentation-mobile.png'), fullPage: true });
});

test('unknown documentation routes provide a working recovery link', async ({ page }) => {
  await page.goto('/#/docs/missing-page');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
  await page.getByRole('link', { name: 'Return to the documentation overview.' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('DeviceBench documentation');
});
