import { test, expect } from '@playwright/test';
import { compareOffers } from '../src/offers.js';
import { marketplaces } from '../src/marketplaces.js';

const ref = '231008918R';
const fixture = (criteria) => {
  const observedAt = new Date().toISOString();
  const offers = ['used', 'new'].flatMap((condition) => marketplaces.map((source) => ({ title: `Alternateur Renault Clio IV ${ref}`, description: 'Pièce complète', condition, price: condition === 'used' ? 45 : 140, currency: 'EUR', source: source.name, sourceId: source.id, country: source.country, url: `https://${source.domain}/example/${condition}`, observedAt, available: true, shipping: null })));
  return { ...compareOffers(offers, criteria, criteria), sources: marketplaces.filter((s) => criteria.country === 'all' || s.country === criteria.country).map((s) => ({ id: s.id, name: s.name, status: 'read', count: 2 })), checkedAt: observedAt, scope: 'Données simulées pour les tests navigateur.' };
};

async function prepare(page, mode) {
  await page.goto('/');
  if (mode === 'oem') {
    await page.getByLabel('Référence OEM ou description', { exact: true }).fill('alternateur');
  } else if (mode === 'model') {
    await page.getByRole('tab', { name: 'Modèle / année' }).click();
    await page.getByLabel('Marque et modèle du véhicule', { exact: true }).fill('Renault Clio IV');
    await page.getByLabel('Année du véhicule', { exact: true }).fill('2016');
    await page.getByLabel('Pièce ou référence OEM', { exact: true }).fill('alternateur');
  } else {
    await page.getByRole('tab', { name: mode === 'vin' ? 'N° VIN' : 'Immatriculation' }).click();
    await page.getByLabel(mode === 'vin' ? 'Numéro VIN du véhicule' : 'Immatriculation du véhicule', { exact: true }).fill(mode === 'vin' ? 'VF15R0J0A59000000' : 'AB-123-CD');
    await page.getByLabel('Modèle et motorisation', { exact: true }).fill('Renault Clio IV 2016');
    await page.getByLabel('Pièce ou référence OEM', { exact: true }).fill('alternateur');
  }
  await page.getByLabel('Référence OEM à comparer (facultatif)', { exact: true }).fill(ref);
  await page.getByRole('button', { name: 'Trouver ma pièce' }).click();
}

for (const mode of ['oem', 'plate', 'vin', 'model']) {
  test(`${mode}: compares the same OEM in used and new listings without exposing identifiers`, async ({ page }) => {
    let body;
    await page.route('**/api/offers', async (route) => { body = route.request().postDataJSON(); await route.fulfill({ json: fixture(body) }); });
    await prepare(page, mode);
    const used = page.getByRole('region', { name: 'Meilleure offre occasion' });
    const fresh = page.getByRole('region', { name: 'Meilleure offre neuve' });
    await expect(used).toContainText(ref);
    await expect(fresh).toContainText(ref);
    await expect(used).toContainText('45,00');
    await expect(fresh).toContainText('140,00');
    await expect(used).toContainText('total inconnu');
    expect(body.type).toBe(mode);
    expect(JSON.stringify(body)).not.toMatch(/AB-123-CD|VF15R0J0A59000000/);
    expect(body.reference).toBe(ref);
  });
}

test('every country and condition filter applies to both offers and merchants', async ({ page }) => {
  await page.route('**/api/offers', async (route) => route.fulfill({ json: fixture(route.request().postDataJSON()) }));
  await prepare(page, 'model');
  for (const source of marketplaces) {
    const countryLabels = { fr: 'France', de: 'Allemagne', it: 'Italie', es: 'Espagne', nl: 'Pays-Bas', pl: 'Pologne', at: 'Autriche', be: 'Belgique' };
    await page.getByRole('button', { name: countryLabels[source.country], exact: true }).click();
    for (const [label, expectedState] of [['Neuf', 'new'], ['Occasion', 'used'], ['Tous', 'all']]) {
      await page.getByRole('button', { name: label, exact: true }).click();
      await expect(page.locator('.best-offers .offer-card')).toHaveCount(expectedState === 'all' ? 2 : 1);
      await expect(page.locator('.best-offers')).toContainText(source.name);
      const hrefs = await page.locator('.best-offers a').evaluateAll((links) => links.map((link) => link.href));
      expect(hrefs.every((href) => new URL(href).hostname === source.domain)).toBe(true);
    }
  }
});

test('outages, no matches and absent new counterpart do not fabricate a best price', async ({ page }) => {
  await page.route('**/api/offers', (route) => route.fulfill({ status: 503, body: '{}' }));
  await prepare(page, 'oem');
  await expect(page.locator('.offer-comparison')).toContainText('service de comparaison est indisponible');
  await expect(page.locator('.best-offers .offer-card')).toHaveCount(0);
  await page.unroute('**/api/offers');
  await page.route('**/api/offers', (route) => route.fulfill({ json: { ...fixture(route.request().postDataJSON()), offers: [], best: { used: null, new: null }, sources: [{ id: 'leboncoin', name: 'Leboncoin', status: 'blocked', count: 0 }] } }));
  await page.getByRole('button', { name: 'Actualiser les offres' }).click();
  await expect(page.getByRole('region', { name: 'Meilleure offre neuve' })).toContainText('Aucune offre');
  await expect(page.locator('.offer-comparison')).not.toContainText('0,00');
  await page.locator('.offer-comparison summary').click();
  await expect(page.locator('.source-status')).toContainText('Accès automatisé refusé');
});

test('without an OEM, description candidates are not called equivalent new or used parts', async ({ page }) => {
  await page.route('**/api/offers', (route) => route.fulfill({ json: fixture(route.request().postDataJSON()) }));
  await page.goto('/');
  await page.getByLabel('Référence OEM ou description', { exact: true }).fill('alternateur');
  await page.getByRole('button', { name: 'Trouver ma pièce' }).click();
  await expect(page.locator('.offer-comparison')).toContainText('Ajoutez la référence OEM');
  await expect(page.locator('.best-offers .offer-card')).toHaveCount(0);
});

test('changing the search cancels stale offers and mobile layout remains usable', async ({ page }) => {
  let release;
  const ready = new Promise((resolve) => { release = resolve; });
  await page.route('**/api/offers', async (route) => { await ready; await route.fulfill({ json: fixture(route.request().postDataJSON()) }).catch(() => {}); });
  await page.setViewportSize({ width: 320, height: 720 });
  await prepare(page, 'model');
  await expect(page.locator('.offer-comparison')).toContainText('Consultation');
  await page.getByLabel('Pièce ou référence OEM', { exact: true }).fill('démarreur');
  release();
  await expect(page.locator('.offer-comparison')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
