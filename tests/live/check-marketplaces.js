import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { comparePublicOffers } from '../../server/compare.js';
import { createOfferCriteria, compareOffers } from '../../src/offers.js';

// This is an explicit live check, never part of the deterministic unit suite.
const request = { type: 'model', query: 'alternateur Renault Clio IV 2016', vehicle: 'Renault Clio IV 2016', part: 'alternateur', reference: '231008918R', country: 'all', condition: 'all' };
const result = await comparePublicOffers(request);
const modeChecks = ['oem', 'plate', 'vin', 'model'].map((type) => {
  const criteria = createOfferCriteria({ ...request, type });
  const comparison = compareOffers(result.offers, criteria, { rates: result.exchangeRates });
  return { type, used: !!comparison.best.used, new: !!comparison.best.new, deliveredUsed: !!comparison.deliveredBest.used, deliveredNew: !!comparison.deliveredBest.new };
});
const report = { checkedAt: result.checkedAt, sources: result.sources, modeChecks, best: result.best, deliveredBest: result.deliveredBest, limitations: ['Compatibilité physique à confirmer par catalogue constructeur ou vendeur.', 'Une première page ne constitue pas une comparaison exhaustive des vendeurs.'] };
await mkdir('test-results', { recursive: true });
await writeFile('test-results/live-marketplaces.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ sources: result.sources.map((s) => ({ name: s.name, status: s.status, count: s.count })), modeChecks, best: result.best }, null, 2));
// Full coverage, both conditions, delivered prices and compatibility are required
// by the requested release. Passing mocked tests never overrides a live failure.
assert.ok(result.sources.every((s) => s.status === 'read'), 'Publication bloquée : au moins une source marchande est inaccessible ou non exploitable.');
assert.ok(modeChecks.every((m) => m.used && m.new && m.deliveredUsed && m.deliveredNew), 'Publication bloquée : équivalents neuf/occasion et prix livrés non validés dans chaque parcours.');
assert.ok(result.best.used?.match.kind === 'reference' && result.best.new?.match.kind === 'reference', 'Publication bloquée : les deux offres ne partagent pas la référence OEM recherchée.');
