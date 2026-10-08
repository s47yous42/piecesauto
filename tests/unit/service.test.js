import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { validateRequest, comparePublicOffers } from '../../server/compare.js';
import { createApp } from '../../server/index.js';
import { marketplaces, marketplaceUrl, translateQuery } from '../../src/marketplaces.js';

const request = { query: 'alternateur Renault Clio IV 2016', part: 'alternateur', vehicle: 'Renault Clio IV 2016', reference: '231008918R', type: 'model' };

test('every European market has a part-specific HTTPS URL and translated query', () => {
  assert.equal(new Set(marketplaces.map((m) => m.country)).size, 8);
  for (const source of marketplaces) {
    const query = translateQuery(request.query, source.country);
    const url = new URL(marketplaceUrl(source, query));
    assert.equal(url.hostname, source.domain);
    assert.equal(url.protocol, 'https:');
    assert.ok(decodeURIComponent(url.href).includes('Clio IV 2016'));
  }
  assert.equal(translateQuery('alternateur Renault', 'de'), 'lichtmaschine Renault');
  assert.equal(translateQuery('alternateur Renault', 'nl'), 'dynamo Renault');
});

test('server validates each search mode and rejects raw identifiers, arbitrary URLs and filters', () => {
  for (const type of ['oem', 'plate', 'vin', 'model']) assert.equal(validateRequest({ ...request, type }).type, type);
  for (const body of [{ ...request, type: 'bogus' }, { ...request, vin: '1HGCM82633A004352' }, { ...request, plate: 'AB-123-CD' }, { ...request, url: 'http://localhost' }, { ...request, country: 'XX' }, { ...request, condition: 'refurbished' }, { ...request, vehicle: '' }, { ...request, query: 'x'.repeat(181) }, { ...request, reference: 'https://evil.test' }]) assert.throws(() => validateRequest(body));
});

test('country filters limit network requests; source failures remain visible', async () => {
  const urls = [];
  const result = await comparePublicOffers({ ...request, country: 'fr' }, { fetchImpl: async (url) => { urls.push(url); return new Response('', { status: 403 }); } });
  assert.equal(urls.length, 1);
  assert.equal(result.sources[0].status, 'blocked');
  assert.equal(result.best.new, null);
  assert.equal(result.best.used, null);
  assert.equal(result.destination.postalCode, '69390');
});

test('partial source failure does not turn unrelated or inaccessible results into a best price', async () => {
  const html = `<script type="application/ld+json">${JSON.stringify({ '@type': 'Offer', name: 'Alternateur 231008918R', price: 50, priceCurrency: 'EUR', itemCondition: 'https://schema.org/UsedCondition', url: '/v/part' })}</script>`;
  const result = await comparePublicOffers({ ...request, country: 'nl' }, { fetchImpl: async () => new Response(html) });
  assert.equal(result.best.used.price, 50);
  assert.equal(result.best.new, null);
  assert.equal(result.deliveredBest.used, null);
  assert.match(result.scope, /Première page/);
});

test('local HTTP service validates method, origin, JSON size and exposes the comparison', async (t) => {
  const app = createApp({ compare: async (body) => { validateRequest(body); return { accepted: true }; } });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  t.after(() => new Promise((resolve) => { app.closeAllConnections(); app.close(resolve); }));
  const url = `http://127.0.0.1:${app.address().port}/api/offers`;
  assert.equal((await fetch(url)).status, 405);
  assert.equal((await fetch(url, { method: 'POST', body: '{}' })).status, 415);
  const post = (body, headers = {}) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body });
  assert.equal((await post('{}', { Origin: 'https://evil.test' })).status, 403);
  assert.equal((await post('{broken')).status, 400);
  assert.equal((await post('x'.repeat(5000))).status, 413);
  assert.equal((await post(JSON.stringify({ ...request, vin: 'private' }))).status, 400);
  assert.deepEqual(await (await post(JSON.stringify(request))).json(), { accepted: true });
});
