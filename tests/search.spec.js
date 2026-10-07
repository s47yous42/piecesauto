import { test, expect } from '@playwright/test';

const vin = '1HGCM82633A004352';
const decoderUrl = '**/vpic.nhtsa.dot.gov/api/**';

test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('description generates encoded merchant searches and filters country and condition', async ({ page }) => {
  await page.getByLabel('Référence OEM ou description', { exact: true }).fill('alternateur Clio 4');
  await page.getByRole('button', { name: 'Trouver ma pièce' }).click();
  await expect(page.locator('.query-summary')).toContainText('ALTERNATEUR CLIO 4');
  await page.getByRole('button', { name: 'Allemagne', exact: true }).click();
  await page.getByRole('button', { name: 'Occasion', exact: true }).click();
  await expect(page.locator('.supplier-card')).toHaveCount(1);
  const url = new URL(await page.locator('.supplier-link').getAttribute('href'));
  expect(url.searchParams.get('_nkw')).toContain('ALTERNATEUR CLIO 4');
  expect(url.searchParams.get('LH_ItemCondition')).toBe('3000');
  await expect(page.locator('.supplier-link')).toHaveAttribute('rel', 'noopener noreferrer');
});

test('empty descriptions and unsafe-looking text are handled as plain text', async ({ page }) => {
  await page.getByRole('button', { name: 'Trouver ma pièce' }).click();
  await expect(page.getByRole('alert')).toContainText('description');
  await page.getByLabel('Référence OEM ou description', { exact: true }).fill('<script>alert(1)</script> & filtre');
  await page.getByRole('button', { name: 'Trouver ma pièce' }).click();
  await expect(page.locator('.query-summary')).toContainText('<SCRIPT>ALERT(1)</SCRIPT>');
  const url = new URL(await page.locator('.supplier-link').first().getAttribute('href'));
  expect([...url.searchParams.values()].join(' ')).toContain('<SCRIPT>ALERT(1)</SCRIPT> & FILTRE');
});

test('plate requires the requested part and confirmed vehicle; never sends plate in search links', async ({ page }) => {
  await page.getByRole('tab', { name: 'Immatriculation' }).click();
  await page.getByLabel('Immatriculation du véhicule', { exact: true }).fill('ab 123 cd');
  await page.getByRole('button', { name: 'Trouver ma pièce' }).click();
  await expect(page.getByRole('alert')).toContainText('pièce');
  await page.getByLabel('Pièce ou référence OEM', { exact: true }).fill('alternateur');
  await page.getByRole('button', { name: 'Trouver ma pièce' }).click();
  await expect(page.getByRole('alert')).toContainText('Oscaro');
  await expect(page.getByRole('link', { name: 'Identifier chez Oscaro' })).toHaveAttribute('href', 'https://www.oscaro.com/');
  await page.getByLabel('Modèle et motorisation', { exact: true }).fill('Renault Clio IV 1.5 dCi 2016');
  await page.getByRole('button', { name: 'Trouver ma pièce' }).click();
  await expect(page.locator('.query-summary')).toContainText('alternateur Renault Clio IV');
  const links = await page.locator('.supplier-link').evaluateAll((elements) => elements.map((element) => element.href));
  for (const href of links) { expect(href).not.toMatch(/AB-123-CD|AB123CD/i); expect([...new URL(href).searchParams.values()].join(' ')).toContain('alternateur Renault Clio IV'); }
});

test('invalid plates cannot produce merchant results', async ({ page }) => {
  await page.getByRole('tab', { name: 'Immatriculation' }).click();
  await page.getByLabel('Immatriculation du véhicule', { exact: true }).fill('???');
  await page.getByRole('button', { name: 'Trouver ma pièce' }).click();
  await expect(page.getByRole('alert')).toContainText('plaque');
  await expect(page.locator('.supplier-link')).toHaveCount(0);
});

test('plate copy uses normalized plate', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('tab', { name: 'Immatriculation' }).click();
  await page.getByLabel('Immatriculation du véhicule', { exact: true }).fill('ab123cd');
  await page.getByRole('button', { name: 'Copier la plaque' }).click();
  await expect(page.getByRole('status')).toContainText('Plaque copiée');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('AB-123-CD');
});

test('VIN decoder runs only on request and confirmed vehicle produces part links', async ({ page }) => {
  let calls = 0;
  await page.route(decoderUrl, async (route) => {
    calls++;
    await route.fulfill({ json: { Results: [{ Make: 'HONDA', Model: 'Accord', ModelYear: '2003', DisplacementL: '3', ErrorCode: '0' }] } });
  });
  await page.getByRole('tab', { name: 'N° VIN' }).click();
  await page.getByLabel('Numéro VIN du véhicule', { exact: true }).fill(vin);
  expect(calls).toBe(0);
  await page.getByRole('button', { name: 'Identifier le véhicule avec le VIN' }).click();
  await expect(page.getByRole('button', { name: 'Utiliser ce véhicule' })).toBeVisible();
  await expect(page.getByLabel('Modèle et motorisation', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Utiliser ce véhicule' }).click();
  await page.getByLabel('Pièce ou référence OEM', { exact: true }).fill('filtre à huile');
  await page.getByRole('button', { name: 'Trouver ma pièce' }).click();
  await expect(page.locator('.query-summary')).toContainText('filtre à huile HONDA Accord 3 L 2003');
  expect(calls).toBe(1);
  for (const href of await page.locator('.supplier-link').evaluateAll((elements) => elements.map((e) => e.href))) expect(href).not.toContain(vin);
  await expect(page.locator('.vin-details')).toContainText(vin);
});

test('partial VIN decode and service failure allow manual search without invented vehicle', async ({ page }) => {
  await page.route(decoderUrl, (route) => route.fulfill({ json: { Results: [{ Make: 'CITROEN', ErrorCode: '7' }] } }));
  await page.getByRole('tab', { name: 'N° VIN' }).click();
  await page.getByLabel('Numéro VIN du véhicule', { exact: true }).fill('VF7SBHMZ0EW554823');
  await page.getByRole('button', { name: 'Identifier le véhicule avec le VIN' }).click();
  await expect(page.getByRole('status')).toContainText('incomplet');
  await expect(page.getByRole('button', { name: 'Utiliser ce véhicule' })).toHaveCount(0);
  await page.unroute(decoderUrl);
  await page.route(decoderUrl, (route) => route.abort());
  await page.getByRole('button', { name: 'Identifier le véhicule avec le VIN' }).click();
  await expect(page.getByRole('status')).toContainText('Décodage impossible');
  await page.getByLabel('Modèle et motorisation', { exact: true }).fill('Citroën C3 1.2');
  await page.getByLabel('Pièce ou référence OEM', { exact: true }).fill('alternateur');
  await page.getByRole('button', { name: 'Trouver ma pièce' }).click();
  await expect(page.locator('.query-summary')).toContainText('alternateur Citroën C3 1.2');
});

test('invalid VIN is rejected before any request', async ({ page }) => {
  let calls = 0;
  await page.route(decoderUrl, (route) => { calls++; return route.abort(); });
  await page.getByRole('tab', { name: 'N° VIN' }).click();
  await page.getByLabel('Numéro VIN du véhicule', { exact: true }).fill('INVALID');
  await page.getByRole('button', { name: 'Identifier le véhicule avec le VIN' }).click();
  await expect(page.getByRole('status')).toContainText('lettres I');
  await page.getByRole('button', { name: 'Trouver ma pièce' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(calls).toBe(0);
});

test('switching modes preserves their inputs and clears previous results', async ({ page }) => {
  await page.getByLabel('Référence OEM ou description', { exact: true }).fill('plaquettes Clio');
  await page.getByRole('button', { name: 'Trouver ma pièce' }).click();
  await page.getByRole('tab', { name: 'N° VIN' }).click();
  await expect(page.getByLabel('Numéro VIN du véhicule', { exact: true })).toHaveValue('');
  await page.getByLabel('Numéro VIN du véhicule', { exact: true }).fill(vin);
  await page.getByRole('tab', { name: 'Immatriculation' }).click();
  await expect(page.getByLabel('Immatriculation du véhicule', { exact: true })).toHaveValue('');
  await page.getByRole('tab', { name: 'Référence ou description' }).click();
  await expect(page.getByLabel('Référence OEM ou description', { exact: true })).toHaveValue('plaquettes Clio');
  await expect(page.locator('.supplier-link')).toHaveCount(0);
});

test('changing VIN cancels stale decoding and removes previous vehicle', async ({ page }) => {
  let release;
  const ready = new Promise((resolve) => { release = resolve; });
  await page.route(decoderUrl, async (route) => { await ready; await route.fulfill({ json: { Results: [{ Make: 'HONDA', Model: 'Accord', ErrorCode: '0' }] } }).catch(() => {}); });
  await page.getByRole('tab', { name: 'N° VIN' }).click();
  await page.getByLabel('Numéro VIN du véhicule', { exact: true }).fill(vin);
  await page.getByRole('button', { name: 'Identifier le véhicule avec le VIN' }).click();
  await expect(page.getByRole('button', { name: 'Identification…', exact: true })).toBeVisible();
  await page.getByLabel('Numéro VIN du véhicule', { exact: true }).fill('VF7SBHMZ0EW554823');
  release();
  await expect(page.getByRole('button', { name: 'Identifier le véhicule avec le VIN' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Utiliser ce véhicule' })).toHaveCount(0);
  await expect(page.getByLabel('Modèle et motorisation', { exact: true })).toHaveValue('');
});

test('mobile search modes remain usable without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  for (const mode of ['Immatriculation', 'N° VIN', 'Référence ou description']) {
    await page.getByRole('tab', { name: mode, exact: true }).click();
    await expect(page.getByRole('button', { name: 'Trouver ma pièce' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  }
});
