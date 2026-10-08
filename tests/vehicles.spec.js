import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api.frankfurter.dev/**', (route) => route.fulfill({ json: { date: new Date().toISOString().slice(0, 10), base: 'EUR', quote: 'PLN', rate: 4.3825 } }));
  await page.goto('/');
});

test('vehicle search is independent of VIN and parts and preserves its own criteria', async ({ page }) => {
  const requests = [];
  page.on('request', (request) => { if (/vpic|\/api\/offers/.test(request.url())) requests.push(request.url()); });
  await page.getByLabel('Référence OEM ou description', { exact: true }).fill('alternateur');
  await page.getByRole('tab', { name: 'N° VIN' }).click();
  await page.getByLabel('Numéro VIN du véhicule', { exact: true }).fill('INVALID');
  await page.getByRole('tab', { name: 'Véhicules', exact: true }).click();
  await expect(page.getByLabel('Numéro VIN du véhicule', { exact: true })).toBeHidden();
  await page.getByLabel('Marque, modèle ou descriptif du véhicule', { exact: true }).fill('Renault Clio');
  await page.locator('#vehicle-yearMin').fill('2015');
  await page.locator('#vehicle-yearMax').fill('2022');
  await page.locator('#vehicle-energy').selectOption('petrol');
  await page.locator('#vehicle-kmMax').fill('100000');
  await page.locator('#vehicle-priceMax').fill('15000');
  await page.getByRole('button', { name: 'Rechercher les véhicules' }).click();
  await expect(page.locator('.vehicle-link')).toHaveCount(8);
  await expect(page.locator('.vehicle-source-card').filter({ hasText: 'OLX' })).toContainText('Budget converti en PLN');
  const href = new URL(await page.locator('.vehicle-source-card').filter({ hasText: 'Leboncoin' }).locator('a').getAttribute('href'));
  expect(href.searchParams.get('text')).toBe('Renault Clio');
  expect(href.searchParams.get('regdate')).toBe('2015-2022');
  expect(href.searchParams.get('fuel')).toBe('1');
  expect(href.searchParams.get('mileage')).toBe('0-100000');
  expect(href.searchParams.get('price')).toBe('0-15000');
  await page.getByRole('tab', { name: 'Référence ou description' }).click();
  await expect(page.getByLabel('Référence OEM ou description', { exact: true })).toHaveValue('alternateur');
  await expect(page.locator('.vehicle-link')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Véhicules', exact: true }).click();
  await expect(page.locator('#vehicle-description')).toHaveValue('Renault Clio');
  await page.getByRole('group', { name: 'Pays des annonces de véhicules' }).getByRole('button', { name: 'Allemagne', exact: true }).click();
  await expect(page.locator('.vehicle-link')).toHaveCount(1);
  await expect(page.locator('.vehicle-link')).toHaveAttribute('href', /kleinanzeigen\.de\/s-autos\//);
  await page.locator('#vehicle-description').fill('Ford Focus');
  await expect(page.locator('.vehicle-link')).toHaveCount(0);
  expect(requests).toEqual([]);
});

test('vehicle validation and mobile layout', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.getByRole('tab', { name: 'Véhicules', exact: true }).click();
  await page.getByRole('button', { name: 'Rechercher les véhicules' }).click();
  await expect(page.getByRole('alert')).toContainText('Décrivez');
  await page.locator('#vehicle-description').fill('Ford Focus');
  await page.locator('#vehicle-yearMin').fill('2022');
  await page.locator('#vehicle-yearMax').fill('2015');
  await page.getByRole('button', { name: 'Rechercher les véhicules' }).click();
  await expect(page.getByRole('alert')).toContainText('borne minimale');
  await page.locator('#vehicle-yearMax').fill('2023');
  await page.getByRole('button', { name: 'Rechercher les véhicules' }).click();
  await expect(page.locator('.vehicle-link')).toHaveCount(8);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('failed currency conversion keeps Polish price manual', async ({ page }) => {
  await page.route('**/api.frankfurter.dev/**', (route) => route.abort());
  await page.getByRole('tab', { name: 'Véhicules', exact: true }).click();
  await page.locator('#vehicle-description').fill('Ford Focus');
  await page.locator('#vehicle-priceMax').fill('10000');
  await page.getByRole('button', { name: 'Rechercher les véhicules' }).click();
  const card = page.locator('.vehicle-source-card').filter({ hasText: 'OLX' });
  await expect(page.getByRole('status')).toContainText('indisponible');
  await expect(card).toContainText('À compléter sur le site : prix');
  expect(new URL(await card.locator('a').getAttribute('href')).searchParams.has('search[filter_float_price:to]')).toBe(false);
});
