import { test, expect } from '@playwright/test';

// Synthetic serial number with the same documented chassis type.
const vin = 'WDB12324310999999';

test('the requested part and VIN remain combined across tabs and all merchant links', async ({ page }) => {
  let decoderCalls = 0;
  await page.route('**/vpic.nhtsa.dot.gov/api/**', (route) => { decoderCalls++; return route.abort(); });
  await page.goto('/');
  await page.getByLabel('Référence OEM ou description', { exact: true }).fill('moteur 2.3l E');
  await page.getByRole('tab', { name: 'N° VIN' }).click();
  await page.getByLabel('Numéro VIN du véhicule', { exact: true }).fill(vin);
  await expect(page.getByLabel('Pièce ou référence OEM', { exact: true })).toHaveValue('moteur 2.3l E');
  await expect(page.getByLabel('Modèle et motorisation', { exact: true })).toHaveValue(/Mercedes-Benz 230 CE C123 M102\.980/);
  await page.getByRole('button', { name: 'Trouver ma pièce' }).click();
  await expect(page.locator('.query-summary')).toContainText('Mercedes-Benz 230 CE C123 M102.980');
  await page.getByRole('button', { name: 'Identifier le véhicule avec le VIN' }).click();
  await expect(page.getByRole('status')).toContainText('Type constructeur 123.243');
  expect(decoderCalls).toBe(0);
  await page.getByRole('tab', { name: 'Référence ou description' }).click();
  await expect(page.getByLabel('Véhicule associé à la recherche')).toContainText('230 CE');
  await page.getByRole('button', { name: 'Trouver ma pièce' }).click();
  await expect(page.locator('.query-summary')).toContainText('MOTEUR 2.3L E Mercedes-Benz 230 CE C123 M102.980');
  const links = await page.locator('.supplier-link').evaluateAll((items) => items.map((item) => item.href));
  expect(links.length).toBeGreaterThan(0);
  for (const link of links) {
    const url = new URL(link);
    const query = `${decodeURIComponent(url.pathname)} ${[...url.searchParams.values()].join(' ')}`;
    expect(query).toContain('Mercedes-Benz 230 CE C123 M102.980');
    expect(link).not.toContain(vin);
  }
  await page.getByLabel('Référence OEM ou description', { exact: true }).fill('moteur 3.0L');
  await page.getByRole('button', { name: 'Trouver ma pièce' }).click();
  await expect(page.getByRole('alert')).toContainText('contredit la motorisation');
  await expect(page.locator('.supplier-link')).toHaveCount(0);
  await page.getByRole('button', { name: 'Retirer le véhicule associé' }).click();
  await page.getByRole('button', { name: 'Trouver ma pièce' }).click();
  await expect(page.locator('.query-summary')).not.toContainText('Mercedes-Benz');
});

test('changing a VIN removes the previous target and blocks a generic description until resolved', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'N° VIN' }).click();
  await page.getByLabel('Numéro VIN du véhicule', { exact: true }).fill(vin);
  await page.getByLabel('Pièce ou référence OEM', { exact: true }).fill('moteur 2.3l E');
  await page.getByRole('button', { name: 'Trouver ma pièce' }).click();
  await expect(page.locator('.supplier-link').first()).toBeVisible();
  await page.getByLabel('Numéro VIN du véhicule', { exact: true }).fill('WDB12399910999999');
  await expect(page.getByLabel('Modèle et motorisation', { exact: true })).toHaveValue('');
  await page.getByRole('tab', { name: 'Référence ou description' }).click();
  await page.getByRole('button', { name: 'Trouver ma pièce' }).click();
  await expect(page.getByRole('alert')).toContainText('VIN associé');
  await expect(page.locator('.supplier-link')).toHaveCount(0);
});

test('a confirmed decoded vehicle is also used when searching from the description tab', async ({ page }) => {
  await page.route('**/vpic.nhtsa.dot.gov/api/**', (route) => route.fulfill({ json: { Results: [{ Make: 'HONDA', Model: 'Accord', ModelYear: '2003', EngineModel: 'K24A', DisplacementL: '2.4', ErrorCode: '0' }] } }));
  await page.goto('/');
  await page.getByRole('tab', { name: 'N° VIN' }).click();
  await page.getByLabel('Numéro VIN du véhicule', { exact: true }).fill('1HGCM82633A004352');
  await page.getByRole('button', { name: 'Identifier le véhicule avec le VIN' }).click();
  await page.getByRole('button', { name: 'Utiliser ce véhicule' }).click();
  await page.getByRole('tab', { name: 'Référence ou description' }).click();
  await page.getByLabel('Référence OEM ou description', { exact: true }).fill('moteur 2.4L');
  await page.getByRole('button', { name: 'Trouver ma pièce' }).click();
  await expect(page.locator('.query-summary')).toContainText('MOTEUR 2.4L HONDA Accord K24A 2.4 L 2003');
  await page.getByRole('tab', { name: 'N° VIN' }).click();
  await expect(page.getByLabel('Pièce ou référence OEM', { exact: true })).toHaveValue('moteur 2.4L');
});
