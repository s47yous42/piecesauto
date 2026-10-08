import test from 'node:test';
import assert from 'node:assert/strict';
import { extractOffers, fetchPublicPage } from '../../server/publicSources.js';
import { marketplaces } from '../../src/marketplaces.js';
import { parseExchangeRates } from '../../server/exchange.js';

const market = marketplaces.find((m) => m.id === 'marktplaats');
const script = (value, next = false) => `<script ${next ? 'id="__NEXT_DATA__" type="application/json"' : 'type="application/ld+json"'}>${JSON.stringify(value)}</script>`;

test('public Marktplaats/2ememain listing data preserves cents, condition and source URL', () => {
  const listing = { title: 'Dynamo 231008918R', vipUrl: '/v/auto-onderdelen/example', priceInfo: { priceCents: 3512, priceType: 'FIXED' }, attributes: [{ key: 'condition', value: 'Gebruikt' }] };
  const html = script({ props: { pageProps: { searchRequestAndResponse: { listings: [listing, { ...listing, reserved: true }, { ...listing, priceInfo: { priceCents: 100, priceType: 'BIDDING' } }] } } } }, true);
  const parsed = extractOffers(html, market);
  assert.equal(parsed.recognized, true);
  assert.equal(parsed.offers.length, 1);
  assert.equal(parsed.offers[0].price, 35.12);
  assert.equal(parsed.offers[0].condition, 'used');
  assert.equal(parsed.offers[0].url, 'https://www.marktplaats.nl/v/auto-onderdelen/example');
  assert.equal(parsed.offers[0].shipping, null);
});

test('OLX nested offers are separate products; aggregate lowPrice is never an offer', () => {
  const source = marketplaces.find((m) => m.id === 'olx');
  const html = script({ '@type': 'Product', name: 'Części samochodowe', description: 'Recherche 231008918R', offers: { '@type': 'AggregateOffer', lowPrice: 1, offers: [{ '@type': 'Offer', name: 'Alternator 231008918R', price: 99, priceCurrency: 'PLN', itemCondition: 'https://schema.org/UsedCondition', availability: 'https://schema.org/InStock', url: 'https://www.olx.pl/d/oferta/example.html' }, { '@type': 'Offer', name: 'Alternator Renault Master 231007317R', price: 100, priceCurrency: 'PLN', url: '/d/oferta/master.html' }] } });
  const parsed = extractOffers(html, source);
  assert.equal(parsed.offers.length, 2);
  assert.equal(parsed.offers[0].price, 99);
  assert.equal(parsed.offers[0].title, 'Alternator 231008918R');
  assert.equal(parsed.offers[0].currency, 'PLN');
  assert.equal(parsed.offers[0].available, true);
  assert.equal(parsed.offers[1].description, '');
  assert.equal(parsed.offers[1].reference, '');
});

test('product metadata associates OEM and availability with its own Offer', () => {
  const html = script({ '@type': 'Product', name: 'Dynamo', mpn: '231008918R', offers: { '@type': 'Offer', price: '120.50', priceCurrency: 'EUR', url: '/v/part', itemCondition: 'https://schema.org/NewCondition', availability: 'https://schema.org/OutOfStock' } });
  const result = extractOffers(html, market).offers[0];
  assert.equal(result.reference, '231008918R');
  assert.equal(result.condition, 'new');
  assert.equal(result.available, false);
});

test('unsafe URLs, malformed data and aggregate price summaries are rejected', () => {
  for (const url of ['https://evil.test/offer', 'javascript:alert(1)', 'https://www.marktplaats.nl@evil.test/offer']) {
    const html = script({ '@type': 'Offer', name: 'Dynamo', price: 1, url });
    assert.equal(extractOffers(html, market).offers.length, 0);
  }
  assert.equal(extractOffers('<script type="application/ld+json">{broken</script>', market).recognized, false);
  assert.equal(extractOffers(script({ '@type': 'AggregateOffer', lowPrice: 1 }), market).offers.length, 0);
});

test('known empty search results differ from a page without usable data', () => {
  assert.equal(extractOffers(script({ props: { pageProps: { searchRequestAndResponse: { listings: [] } } } }, true), market).recognized, true);
  assert.equal(extractOffers('<html>No structured data</html>', market).recognized, false);
});

test('HTTP blocks and captcha pages are reported, never bypassed', async () => {
  for (const status of [401, 403, 429]) assert.equal((await fetchPublicPage('https://www.marktplaats.nl/', { fetchImpl: async () => new Response('', { status }) })).status, 'blocked');
  assert.equal((await fetchPublicPage('https://www.marktplaats.nl/', { fetchImpl: async () => new Response('<div id="captcha-box">Challenge</div>') })).status, 'blocked');
  assert.equal((await fetchPublicPage('https://www.marktplaats.nl/', { fetchImpl: async (_url, options) => { assert.equal(options.redirect, 'manual'); return new Response('', { status: 302 }); } })).status, 'unavailable');
});

test('canonical redirects stay on the original public host and have a strict limit', async () => {
  let calls = 0;
  const result = await fetchPublicPage('https://www.marktplaats.nl/l/q/ABC/', { fetchImpl: async (url) => { calls++; return calls === 1 ? new Response('', { status: 301, headers: { Location: '/l/q/abc/' } }) : new Response('<html>Canonical page</html>'); } });
  assert.match(result.html, /Canonical page/);
  assert.equal(calls, 2);
  const crossHost = await fetchPublicPage('https://www.marktplaats.nl/', { fetchImpl: async () => new Response('', { status: 302, headers: { Location: 'http://127.0.0.1/' } }) });
  assert.equal(crossHost.status, 'unavailable');
});

test('ECB conversion preserves the date and rejects malformed/missing rates', () => {
  const result = parseExchangeRates('<Cube time="2026-10-07"><Cube currency="PLN" rate="4.3825"/><Cube currency="USD" rate="0"/></Cube>');
  assert.equal(result.date, '2026-10-07');
  assert.equal(result.values.PLN, 4.3825);
  assert.equal(result.values.USD, undefined);
  assert.equal(parseExchangeRates('<html>Error</html>'), null);
});
