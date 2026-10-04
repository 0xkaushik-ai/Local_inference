import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

test('readiness examples remain labeled and export the selected findings', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Ready for');
  await expect(page.locator('.hero-kicker')).toContainText('V1 preview');
  await expect(page.locator('.sample-badge')).toContainText('Sample data');
  await page.getByRole('button', { name: 'Test app features', exact: true }).click();
  await expect(page.locator('.readiness-summary')).toContainText('Two checks passed');
  await expect(page.locator('.sample-status.pass')).toHaveCount(2);
  await expect(page.locator('.sample-status.unsupported')).toHaveCount(1);
  await page.getByRole('tab', { name: 'Next steps', exact: true }).click();
  await expect(page.locator('.sample-next-panel')).toContainText('select a model');
  await page.getByRole('tab', { name: 'Raw evidence', exact: true }).click();
  await expect(page.locator('.raw-evidence pre')).toContainText('"example": true');
  await expect(page.locator('.raw-evidence pre')).toContainText('No device or model was checked.');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download example JSON' }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('devicebench-illustrative-example.json');
  const downloaded = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(downloaded).toMatchObject({ example: true, tool: 'App Compatibility Tester' });
  expect(downloaded.findings.map((finding: { status: string }) => finding.status)).toEqual([
    'pass',
    'pass',
    'unsupported',
  ]);
  expect(errors).toEqual([]);
});

test('developer setup switches platform and runtime, copies commands, and restores focus', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Get started' }).first();
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByText('Developer setup · source or Python package', { exact: true }).click();
  await expect(page.locator('.setup-code')).toContainText(
    'PYTHONPATH=src python3 -m devicebench serve',
  );
  await page.getByRole('tab', { name: 'Windows', exact: true }).click();
  await expect(page.locator('.app-download')).toContainText('not yet validated');
  await expect(page.getByRole('link', { name: 'Download Linux preview' })).toHaveCount(0);
  await expect(page.locator('.setup-code')).toContainText('$env:PYTHONPATH = "src"');
  await page.getByLabel('Your local AI server').selectOption('openai');
  await expect(page.locator('.setup-code')).toContainText(
    '--endpoint http://127.0.0.1:1234 --protocol openai',
  );
  await page.getByRole('button', { name: 'Copy setup commands' }).click();
  await expect(page.getByRole('status')).toHaveText('Copied to clipboard');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    'py -3 -m devicebench serve',
  );
  await expect(
    page.getByRole('dialog').getByRole('link', { name: '127.0.0.1:8766' }),
  ).toHaveAttribute('href', 'http://127.0.0.1:8766/');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test('clipboard denial leaves setup commands available to copy manually', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('Denied')) },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Get started' }).first().click();
  await page.getByText('Developer setup · source or Python package', { exact: true }).click();
  await page.getByRole('button', { name: 'Copy setup commands' }).click();
  await expect(page.getByRole('status')).toContainText('Select and copy');
  await expect(page.locator('.setup-code pre')).toContainText('devicebench serve');
});

test('a staged preview provides the application, checksum, and complete-folder instructions', async ({
  page,
}, testInfo) => {
  const filename = 'devicebench-0.2.0-linux-x86_64.tgz';
  const sha256 = 'a'.repeat(64);
  await page.route('**/downloads/manifest.json', (route) =>
    route.fulfill({
      json: {
        platform: 'linux-x86_64',
        status: 'local-preview',
        version: '0.2.0',
        filename,
        bytes: 16000000,
        sha256,
        glibc: '2.42',
      },
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Get started' }).first().click();
  await expect(page.getByRole('link', { name: 'Download Linux preview' })).toHaveAttribute(
    'href',
    `/downloads/${filename}`,
  );
  await expect(page.locator('.download-steps')).toContainText('Extract the complete folder');
  await expect(page.locator('.download-requirements')).toContainText('glibc 2.42');
  await expect(page.locator('.setup-code')).not.toBeVisible();
  await page.getByText('Verify your download', { exact: true }).click();
  await expect(page.locator('.download-verification code')).toHaveText(sha256);
  await expect(page.getByRole('link', { name: 'Download checksum' })).toHaveAttribute(
    'href',
    `/downloads/${filename}.sha256`,
  );
  await page.screenshot({ path: testInfo.outputPath('desktop-download.png') });
  await page.getByRole('tab', { name: 'macOS', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'macOS application pending' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download Linux preview' })).toHaveCount(0);
  await expect(page.locator('.download-steps')).toHaveCount(0);
});

test('missing or invalid download metadata shows an honest fallback', async ({ page }) => {
  for (const response of [
    { status: 404, body: 'Not found' },
    {
      json: {
        platform: 'linux-x86_64',
        status: 'local-preview',
        version: '0.2.0',
        filename: '../../bad-file',
        bytes: 100,
        sha256: 'a'.repeat(64),
        glibc: '2.42',
      },
    },
  ]) {
    await page.route('**/downloads/manifest.json', (route) => route.fulfill(response));
    await page.goto('/');
    await page.getByRole('button', { name: 'Get started' }).first().click();
    await expect(
      page.getByRole('heading', { name: 'Application download not available here' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Download Linux preview' })).toHaveCount(0);
    await expect(page.locator('.download-steps')).toHaveCount(0);
    await page.unrouteAll();
  }
});

test('the staged application downloads with the exact archive bytes', async ({ page, request }) => {
  const response = await request.get('/downloads/manifest.json');
  const manifest = await response.json().catch(() => null);
  test.skip(!manifest, 'Build and stage the application to verify its actual download.');
  await page.goto('/');
  await page.getByRole('button', { name: 'Get started' }).first().click();
  const event = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download Linux preview' }).click();
  const download = await event;
  const bytes = await readFile((await download.path())!);
  expect(download.suggestedFilename()).toBe(manifest.filename);
  expect(bytes.length).toBe(manifest.bytes);
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(manifest.sha256);
  expect(bytes.subarray(0, 2)).toEqual(Buffer.from([0x1f, 0x8b]));
});

test('workflow controls change the explanation and file preview', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: '04 Export the evidence' }).click();
  await expect(page.locator('#workflow-panel')).toContainText('report.html');
  await expect(page.locator('#workflow-panel')).toContainText('report.json');
  await expect(page.locator('.workflow-description')).toContainText('observed responses');
  await page.getByRole('tab', { name: '04 Export the evidence' }).press('Home');
  await expect(page.getByRole('tab', { name: '01 Diagnose your setup' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('tab', { name: '02 Inspect your model' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.locator('#workflow-panel')).toContainText('4096 tokens');
});

test('desktop page renders without horizontal overflow', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath('desktop.png'), fullPage: true });
  await page.screenshot({ path: testInfo.outputPath('desktop-hero.png') });
});

test('Tools navigation reaches the local toolkit and opens setup', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', { name: 'Tools', exact: true }).click();
  await expect(
    page.locator('#tools').getByRole('heading', { name: 'Local AI Doctor' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Set up the local toolkit' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Download. Open. Check.' })).toBeVisible();
});

test('mobile navigation, report views, and setup remain usable', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'How it works' }).click();
  await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await page.getByLabel('Example tool').selectOption('2');
  await expect(page.locator('.readiness-summary')).toContainText('Two checks passed');
  await page.getByRole('tab', { name: 'Raw evidence', exact: true }).click();
  await expect(page.locator('.raw-evidence pre')).toBeVisible();
  await page.getByRole('tab', { name: 'Overview', exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath('mobile.png'), fullPage: true });
  await page.screenshot({ path: testInfo.outputPath('mobile-hero.png') });
  for (const width of [390, 320, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBeTruthy();
  }
  await page.setViewportSize({ width: 320, height: 750 });
  await page.getByRole('button', { name: 'Get started' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('mobile-download.png') });
  expect(
    await page
      .getByRole('dialog')
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBeTruthy();
});
