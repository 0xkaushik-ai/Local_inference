import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('page and setup dialog pass automated WCAG A and AA checks', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const scan = () =>
    new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect((await scan()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Get started' }).first().click();
  expect((await scan()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Close setup' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('tab', { name: 'Raw evidence', exact: true }).click();
  expect((await scan()).violations).toEqual([]);
});

test('mobile disclosure closes on Escape and outside click', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Open navigation' });
  await toggle.click();
  await page.getByRole('navigation').getByRole('link', { name: 'Tools', exact: true }).focus();
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();
  await toggle.click();
  await page.locator('.hero-content > p').click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test('report works at 200 percent text sizing without page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 900 });
  await page.goto('/');
  await page.addStyleTag({ content: 'html { zoom: 2; }' });
  await page.getByRole('tab', { name: 'Next steps' }).click();
  await expect(page.locator('.sample-next-panel')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBeTruthy();
});
