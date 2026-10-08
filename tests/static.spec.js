import { test, expect } from '@playwright/test';

for (const mode of ['oem', 'plate', 'vin', 'model']) {
  test(`static ${mode} search keeps merchant links without calling the comparison service`, async ({ page }) => {
    const comparisonRequests = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.endsWith('/api/offers')) comparisonRequests.push(request.url());
    });
    await page.goto('/');
    if (mode === 'oem') {
      await page.getByLabel('Référence OEM ou description', { exact: true }).fill('alternateur Clio IV');
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
    await page.getByRole('button', { name: 'Trouver ma pièce' }).click();
    await expect(page.locator('.supplier-link').first()).toBeVisible();
    await expect(page.locator('.price-note')).toContainText('comparaison automatique des prix est désactivée');
    await expect(page.locator('.offer-comparison')).toHaveCount(0);
    await expect(page.locator('#offer-reference')).toHaveCount(0);
    await page.getByRole('button', { name: 'Allemagne', exact: true }).click();
    await page.getByRole('button', { name: 'Occasion', exact: true }).click();
    const ebay = page.locator('.supplier-card').filter({ hasText: 'eBay' });
    await expect(ebay).toHaveCount(1);
    const href = new URL(await ebay.locator('.supplier-link').getAttribute('href'));
    expect(href.hostname).toBe('www.ebay.de');
    expect(href.searchParams.get('_nkw').toLowerCase()).toContain('alternateur');
    expect(href.searchParams.get('LH_ItemCondition')).toBe('3000');
    await expect(page.locator('.offer-comparison')).toHaveCount(0);
    expect(comparisonRequests).toEqual([]);
  });
}
