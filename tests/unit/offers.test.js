import test from 'node:test';
import assert from 'node:assert/strict';
import { compareOffers, createOfferCriteria, matchOffer, normalizeCondition } from '../../src/offers.js';

const now = Date.parse('2026-10-07T18:00:00Z');
const criteria = { query: 'alternateur Renault Clio IV 2016', part: 'alternateur', vehicle: 'Renault Clio IV 2016', reference: '231008918R' };
const offer = (overrides = {}) => ({ title: 'Alternateur Renault Clio IV 231008918R', description: 'Pièce complète', url: 'https://www.marktplaats.nl/v/example-1', price: 50, currency: 'EUR', condition: 'used', country: 'nl', observedAt: new Date(now).toISOString(), shipping: null, ...overrides });
const compare = (offers, options = {}, request = criteria) => compareOffers(offers, request, { now, ...options });

test('same OEM distinguishes a real candidate from a different reference or substring', () => {
  assert.equal(matchOffer(offer(), criteria).kind, 'reference');
  assert.equal(matchOffer(offer({ title: 'Alternateur Renault 231008918R9' }), criteria), null);
  assert.equal(matchOffer(offer({ title: 'Alternateur Renault 231008919R' }), criteria), null);
  assert.equal(matchOffer(offer({ title: 'Dynamo Renault 231008918R' }), criteria).kind, 'reference');
  assert.equal(matchOffer(offer({ title: 'Connecteur pour alternateur 231008918R' }), criteria), null);
  assert.equal(matchOffer(offer({ title: 'Alternateur avec poulie 231008918R' }), criteria).kind, 'reference');
  assert.equal(matchOffer(offer({ title: 'Alternateur reconditionné 231008918R', condition: 'new' }), criteria), null);
});

test('descriptions cannot be promoted to confirmed equivalents and wrong model/year/part is excluded', () => {
  const descriptive = { ...criteria, reference: '' };
  const candidate = offer({ title: 'Alternateur Renault Clio IV 2016' });
  const result = compare([candidate], {}, descriptive);
  assert.equal(result.offers.length, 1);
  assert.equal(result.offers[0].match.kind, 'description');
  assert.equal(result.best.used, null);
  for (const title of ['Alternateur Renault Clio II 2016', 'Alternateur Renault Clio IV 2015', 'Démarreur Renault Clio IV 2016', 'Alternateur Ford Fiesta 2016']) {
    assert.equal(matchOffer(offer({ title }), descriptive), null, title);
  }
});

test('broken parts, repair services, unknown condition, out of stock and invalid prices cannot win', () => {
  const rejected = [offer({ description: 'hors service' }), offer({ description: 'defekt' }), offer({ description: 'repair service' }), offer({ available: false }), offer({ condition: 'unknown' }), offer({ condition: 'refurbished' }), offer({ price: 0 }), offer({ price: -1 }), offer({ price: NaN }), offer({ url: 'javascript:alert(1)' })];
  assert.equal(compare(rejected).offers.length, 0);
});

test('new and used are selected separately and deduplicated, respecting country and condition', () => {
  const used = offer();
  const cheaperUsed = offer({ price: 25, url: 'https://www.olx.pl/d/example', country: 'pl' });
  const fresh = offer({ price: 120, condition: 'new', url: 'https://www.marktplaats.nl/v/example-2' });
  const result = compare([used, used, fresh, cheaperUsed]);
  assert.equal(result.offers.length, 3);
  assert.equal(result.best.used.price, 25);
  assert.equal(result.best.new.price, 120);
  assert.equal(compare([used, fresh, cheaperUsed], { country: 'nl' }).best.used.price, 50);
  assert.equal(compare([used, fresh], { condition: 'used' }).best.new, null);
});

test('unknown delivery never becomes free delivery; destination and currency must match', () => {
  for (const shipping of [null, { price: 0, currency: 'EUR', country: 'NL', postalCode: '69390' }, { price: 5, currency: 'EUR', country: 'FR' }, { price: 5, currency: 'PLN', country: 'FR', postalCode: '69390' }]) {
    assert.equal(compare([offer({ shipping })]).deliveredBest.used, null);
  }
  const shipping = { price: 10, currency: 'EUR', country: 'FR', postalCode: '69390' };
  assert.equal(compare([offer({ shipping })]).deliveredBest.used.totalEUR, 60);
});

test('cheapest delivered differs from cheapest advertised and money is rounded', () => {
  const a = offer({ price: 25.12, shipping: { price: 40, currency: 'EUR', country: 'FR', postalCode: '69390' } });
  const b = offer({ price: 30.15, url: 'https://www.marktplaats.nl/v/example-2', shipping: { price: 5.13, currency: 'EUR', country: 'FR', postalCode: '69390' } });
  const result = compare([a, b]);
  assert.equal(result.best.used.url, a.url);
  assert.equal(result.deliveredBest.used.url, b.url);
  assert.equal(result.deliveredBest.used.totalEUR, 35.28);
});

test('different currencies require a dated, recent exchange rate', () => {
  const pln = offer({ price: 100, currency: 'PLN' });
  assert.equal(compare([pln]).best.used, null);
  assert.equal(compare([pln]).offers[0].euroPrice, null);
  const rates = { date: '2026-10-07', values: { PLN: 4 } };
  assert.equal(compare([pln], { rates }).best.used.euroPrice, 25);
  assert.equal(compare([pln], { rates: { ...rates, date: '2026-09-01' } }).best.used, null);
  assert.equal(compare([pln], { rates: { ...rates, date: '2026-10-08' } }).best.used, null);
});

test('stale and future-dated offers cannot be advertised as current', () => {
  for (const observedAt of ['invalid', '2026-10-06T18:00:00Z', '2026-10-07T19:00:00Z']) assert.equal(compare([offer({ observedAt })]).offers.length, 0);
});

test('all search modes build criteria without transmitting VIN or plate identifiers', () => {
  for (const type of ['oem', 'plate', 'vin', 'model']) {
    const request = createOfferCriteria({ ...criteria, type });
    assert.equal(request.type, type);
    assert.equal(request.reference, '231008918R');
    assert.equal('vin' in request || 'plate' in request || 'input' in request, false);
    assert.equal(compare([offer(), offer({ condition: 'new', url: 'https://www.marktplaats.nl/v/example-2' })], {}, request).offers.length, 2);
  }
  assert.equal(createOfferCriteria({ query: 'alternateur 231008918R', type: 'oem' }).reference, '231008918R');
});

test('explicit states only: reconditioned and ambiguous states are not new or used', () => {
  for (const value of ['NewCondition', 'Neuf', 'Nieuw', 'Nowe']) assert.equal(normalizeCondition(value), 'new');
  for (const value of ['https://schema.org/UsedCondition', 'Gebruikt', 'Utilisé', 'Używane']) assert.equal(normalizeCondition(value), 'used');
  for (const value of ['Reconditionné', 'RefurbishedCondition', 'Comme neuf', '', '1000']) assert.equal(normalizeCondition(value), 'unknown');
});
