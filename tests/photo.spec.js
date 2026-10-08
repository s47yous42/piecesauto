import { test, expect } from '@playwright/test';

// Photo recognition is optional; these checks use simulated Gemini responses.
const image = { name: 'piece.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jVpsAAAAASUVORK5CYII=', 'base64') };

test('photo recognition fills the description but cannot assert an OEM or compatibility', async ({ page }) => {
  let call;
  await page.route('**/generativelanguage.googleapis.com/**', async (route) => {
    call = route.request().postDataJSON();
    await route.fulfill({ json: { candidates: [{ content: { parts: [{ text: 'alternateur Renault Clio' }] } }] } });
  });
  await page.goto('/');
  await page.locator('#part-photo').setInputFiles(image);
  await page.getByLabel('Clé API Gemini', { exact: true }).fill('test-key-not-a-real-secret');
  await page.getByRole('button', { name: 'Identifier', exact: true }).click();
  await expect(page.getByLabel('Référence OEM ou description', { exact: true })).toHaveValue('alternateur Renault Clio');
  await expect(page.getByLabel('Référence OEM à comparer (facultatif)', { exact: true })).toHaveValue('');
  expect(call.contents[0].parts[1].inline_data.mime_type).toBe('image/png');
  expect(await page.evaluate(() => ({ ...localStorage }))).not.toHaveProperty('apiKey');
});

test('photo analysis needs a user key and API failure produces no fabricated description', async ({ page }) => {
  await page.goto('/');
  await page.locator('#part-photo').setInputFiles(image);
  await page.getByRole('button', { name: 'Identifier', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('clé API');
  await page.getByLabel('Clé API Gemini', { exact: true }).fill('test-key-not-a-real-secret');
  await page.route('**/generativelanguage.googleapis.com/**', (route) => route.fulfill({ status: 429, json: { error: { message: 'Quota de test dépassé' } } }));
  await page.getByRole('button', { name: 'Identifier', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Quota de test dépassé');
  await expect(page.getByLabel('Référence OEM ou description', { exact: true })).toHaveValue('');
});

test('non-image uploads are rejected before analysis', async ({ page }) => {
  await page.goto('/');
  await page.locator('#part-photo').setInputFiles({ name: 'piece.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });
  await expect(page.getByRole('alert')).toContainText('fichier image');
  await expect(page.getByRole('button', { name: 'Identifier', exact: true })).toHaveCount(0);
});
