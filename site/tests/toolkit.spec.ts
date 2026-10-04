import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

async function openDashboard(page: Page) {
  await page.goto('/');
  await expect(page.locator('#status')).toContainText('Completed');
  await expect(page.locator('#run')).toBeEnabled();
}

async function runCheck(page: Page) {
  const response = page.waitForResponse(
    (response) => response.url().endsWith('/api/run') && response.request().method() === 'POST',
  );
  await page.locator('#run').click();
  await response;
  await expect(page.locator('#run')).toBeEnabled();
  await expect(page.locator('#status')).toContainText('Completed');
  return JSON.parse((await page.locator('#raw-json').textContent())!);
}

async function expectNoReport(page: Page) {
  await expect(page.locator('#export-json')).toBeDisabled();
  await expect(page.locator('#export-html')).toBeDisabled();
  await expect(page.locator('#raw-json')).toBeEmpty();
  await expect(page.locator('#raw')).toBeHidden();
  await expect(page.locator('#findings .finding')).toHaveCount(0);
  await expect(page.locator('#status')).not.toContainText('Completed');
}

test('doctor, model sizing, native integration, and exports use real HTTP responses', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#result-title')).toHaveText('Local AI Doctor');
  await expect(page.locator('#status')).toContainText('Completed');
  await expect(page.locator('#findings')).toContainText('Runtime connection');
  await page.locator('.tool-card[data-tool="inspect"]').click();
  await page.locator('#context').fill('16384');
  await page.locator('#run').click();
  await expect(page.locator('#result-title')).toHaveText('Model & Context Checker');
  await expect(page.locator('.badge.fail')).toHaveCount(1);
  await page.locator('.tool-card[data-tool="compat"]').click();
  await page.locator('input[value="tools"]').check();
  await page.locator('input[value="embeddings"]').check();
  await page.locator('#embedding-model').selectOption('fixture-embed:latest');
  await page.locator('#run').click();
  await expect(page.locator('#result-title')).toHaveText('App Compatibility Tester');
  await expect(page.locator('.badge.pass')).toHaveCount(4);
  await expect(page.locator('#findings')).toContainText('No function was executed');
  const jsonEvent = page.waitForEvent('download');
  await page.locator('#export-json').click();
  const jsonDownload = await jsonEvent;
  const result = JSON.parse(await readFile((await jsonDownload.path())!, 'utf8'));
  expect(
    result.findings.every((finding: { status: string }) => finding.status === 'pass'),
  ).toBeTruthy();
  const htmlEvent = page.waitForEvent('download');
  await page.locator('#export-html').click();
  const htmlDownload = await htmlEvent;
  expect(await readFile((await htmlDownload.path())!, 'utf8')).toContain(
    'App Compatibility Tester',
  );
  expect(errors).toEqual([]);
});

test('OpenAI-compatible mode refreshes inventory and tests the selected protocol', async ({
  page,
}) => {
  await openDashboard(page);
  await page.locator('.tool-card[data-tool="compat"]').click();
  await runCheck(page);
  await page.locator('#protocol').selectOption('openai');
  await expect(page.locator('#run')).toBeEnabled();
  await expect(page.locator('.tool-card[data-tool="compat"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('#model')).toHaveValue('fixture:latest');
  await expectNoReport(page);
  const result = await runCheck(page);
  await expect(page.locator('#result-title')).toHaveText('App Compatibility Tester');
  await expect(page.locator('.badge.pass')).toHaveCount(2);
  await expect(page.locator('#raw-json')).toContainText('/v1/chat/completions');
  expect(result.protocol).toBe('openai');
});

test('each tool shows only the report matching its selected settings', async ({ page }) => {
  await openDashboard(page);
  const doctor = await page.locator('#raw-json').textContent();
  await page.locator('.tool-card[data-tool="inspect"]').click();
  await expect(page.locator('#result-title')).toHaveText('Model & Context Checker');
  await expectNoReport(page);
  const inspection = await runCheck(page);
  await page.locator('.tool-card[data-tool="compat"]').click();
  await expect(page.locator('#result-title')).toHaveText('App Compatibility Tester');
  await expectNoReport(page);
  await page.locator('.tool-card[data-tool="doctor"]').click();
  await expect(page.locator('#raw-json')).toHaveText(doctor!);
  await expect(page.locator('#export-json')).toBeEnabled();
  await page.locator('.tool-card[data-tool="inspect"]').click();
  expect(JSON.parse((await page.locator('#raw-json').textContent())!).id).toBe(inspection.id);
});

test('changed model, context, features, and embedding model invalidate exports', async ({
  page,
}) => {
  await openDashboard(page);
  await page.locator('.tool-card[data-tool="inspect"]').click();
  await runCheck(page);
  await page.locator('#context').fill('8192');
  await expectNoReport(page);
  await runCheck(page);
  await page.locator('#model').selectOption('fixture-embed:latest');
  await expectNoReport(page);
  await page.locator('#model').selectOption('fixture:latest');
  await expect(page.locator('#export-json')).toBeEnabled();
  await page.locator('.tool-card[data-tool="compat"]').click();
  await runCheck(page);
  await page.locator('input[value="tools"]').check();
  await expectNoReport(page);
  await runCheck(page);
  await page.locator('input[value="embeddings"]').check();
  await expectNoReport(page);
  await page.locator('#embedding-model').selectOption('fixture-embed:latest');
  await runCheck(page);
  await page.locator('#embedding-model').selectOption('');
  await expectNoReport(page);
});

test('refreshing inventory preserves the current model check and its exports', async ({ page }) => {
  await openDashboard(page);
  await page.locator('.tool-card[data-tool="inspect"]').click();
  const inspection = await runCheck(page);
  const refreshResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/run') && response.request().postDataJSON().tool === 'doctor',
  );
  await page.locator('#refresh').click();
  await refreshResponse;
  await expect(page.locator('#run')).toBeEnabled();
  await expect(page.locator('#result-title')).toHaveText('Model & Context Checker');
  expect(JSON.parse((await page.locator('#raw-json').textContent())!).id).toBe(inspection.id);
  await expect(page.locator('#export-json')).toBeEnabled();
  await expect(page.locator('#connection-status')).toContainText('Connected');
});

test('a failed rerun clears the previous report and blocks stale exports while busy', async ({
  page,
}) => {
  await openDashboard(page);
  await page.locator('.tool-card[data-tool="compat"]').click();
  await runCheck(page);
  let releaseRequest!: () => void;
  const heldRequest = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });
  await page.route('**/api/run', async (route) => {
    await heldRequest;
    await route.fulfill({ status: 503, json: { error: 'Runtime stopped during this check.' } });
  });
  const started = page.waitForRequest('**/api/run');
  await page.locator('#run').click();
  await started;
  try {
    await expectNoReport(page);
    await expect(page.locator('#run')).toBeDisabled();
    await expect(page.locator('#protocol')).toBeDisabled();
    await expect(page.locator('.tool-card[data-tool="doctor"]')).toBeDisabled();
  } finally {
    releaseRequest();
  }
  await expect(page.locator('#error')).toContainText('Runtime stopped during this check.');
  await expect(page.locator('#run')).toBeEnabled();
  await expectNoReport(page);
  await page.unroute('**/api/run');
  await runCheck(page);
  await expect(page.locator('#error')).toBeHidden();
  await expect(page.locator('#export-json')).toBeEnabled();
});

test('an invalid context in a hidden panel does not block other tools', async ({ page }) => {
  await openDashboard(page);
  await page.locator('.tool-card[data-tool="inspect"]').click();
  await page.locator('#context').fill('0');
  await page.locator('.tool-card[data-tool="compat"]').click();
  await expect(page.locator('#context')).toBeDisabled();
  const compatibility = await runCheck(page);
  expect(compatibility.tool).toBe('App Compatibility Tester');
  await page.locator('.tool-card[data-tool="doctor"]').click();
  await expect(page.locator('#context')).toBeDisabled();
  await expect(page.locator('#model')).toBeDisabled();
  const doctor = await runCheck(page);
  expect(doctor.tool).toBe('Local AI Doctor');
});

test('guided next steps and app presets configure checks without running inference', async ({
  page,
}) => {
  await openDashboard(page);
  const requests: unknown[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/api/run')) requests.push(request.postDataJSON());
  });
  await page.locator('#next-step').click();
  await expect(page.locator('.tool-card[data-tool="inspect"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(requests).toEqual([]);
  await runCheck(page);
  const afterInspection = requests.length;
  await page.locator('#next-step').click();
  await expect(page.locator('.tool-card[data-tool="compat"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.locator('#app-preset').selectOption('chatbot');
  await expect(page.locator('input[value="streaming"]')).toBeChecked();
  await expect(page.locator('input[value="json"]')).not.toBeChecked();
  await page.locator('#app-preset').selectOption('extraction');
  await expect(page.locator('input[value="streaming"]')).not.toBeChecked();
  await expect(page.locator('input[value="json"]')).toBeChecked();
  await page.locator('#app-preset').selectOption('assistant');
  await expect(page.locator('input[value="streaming"]')).toBeChecked();
  await expect(page.locator('input[value="tools"]')).toBeChecked();
  await page.locator('#app-preset').selectOption('search');
  await expect(page.locator('input[value="embeddings"]')).toBeChecked();
  await expect(page.locator('#embedding-controls')).toBeVisible();
  await page.locator('input[value="streaming"]').check();
  await expect(page.locator('#app-preset')).toHaveValue('custom');
  expect(requests).toHaveLength(afterInspection);
  const result = await runCheck(page);
  expect(result.findings.map((finding: { id: string }) => finding.id)).toEqual([
    'streaming',
    'embeddings',
  ]);
});

test('empty feature selection and unsupported embeddings are explained', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#status')).toContainText('Completed');
  await page.locator('.tool-card[data-tool="compat"]').click();
  await page.locator('input[value="streaming"]').uncheck();
  await page.locator('input[value="json"]').uncheck();
  await page.locator('#run').click();
  await expect(page.locator('#error')).toContainText('Select at least one');
  await page.locator('input[value="embeddings"]').check();
  await page.locator('#run').click();
  await expect(page.locator('.badge.unsupported')).toHaveCount(1);
  await expect(page.locator('#findings')).toContainText('No inference request was made');
});

test('runtime outage and untrusted output remain visible as text', async ({ page }) => {
  await page.route('**/api/run', async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        id: 'fixture-offline',
        tool: 'Local AI Doctor',
        endpoint: 'http://127.0.0.1:1',
        created_at: new Date().toISOString(),
        scope: 'Synthetic browser test',
        protocol: 'ollama',
        models: [],
        findings: [
          {
            id: 'runtime',
            title: '<script>window.injected=true</script>',
            status: 'unavailable',
            detail: 'Runtime unavailable',
            action: 'Start the runtime',
            evidence: null,
          },
        ],
      },
    });
  });
  await page.goto('/');
  await expect(page.locator('.badge.unavailable')).toHaveCount(1);
  await expect(page.locator('#connection-status')).toContainText('Unavailable');
  await expect(page.locator('#next-step')).toBeHidden();
  await expect(page.locator('#findings')).toContainText('<script>');
  expect(await page.evaluate(() => Object.hasOwn(window, 'injected'))).toBeFalsy();
});

test('dashboard works at desktop and narrow mobile widths without accessibility violations', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await expect(page.locator('#status')).toContainText('Completed');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('toolkit-desktop.png'), fullPage: true });
  for (const width of [390, 320, 768, 1024, 1100]) {
    await page.setViewportSize({ width, height: 844 });
    for (const tool of ['doctor', 'inspect', 'compat']) {
      await page.locator(`.tool-card[data-tool="${tool}"]`).click();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBeTruthy();
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.tool-card[data-tool="inspect"]').click();
  await runCheck(page);
  await expect(page.locator('#result-title')).toHaveText('Model & Context Checker');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('toolkit-mobile.png'), fullPage: true });
  await page.locator('.tool-card[data-tool="compat"]').click();
  await page.locator('input[value="embeddings"]').check();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.locator('#help-open').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#help-dialog')).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.keyboard.press('Escape');
  await expect(page.locator('#help-dialog')).toBeHidden();
  await expect(page.locator('#help-open')).toBeFocused();
});
