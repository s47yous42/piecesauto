import { marketplaces, marketplaceUrl, translateQuery } from '../src/marketplaces.js';
import { compareOffers } from '../src/offers.js';
import { extractOffers, fetchPublicPage } from './publicSources.js';
import { readExchangeRates } from './exchange.js';

export function validateRequest(body) {
  if (!body || typeof body !== 'object' || Object.keys(body).some((k) => !['query', 'type', 'part', 'vehicle', 'reference', 'country', 'condition'].includes(k))) throw new Error('Requête de comparaison invalide.');
  for (const key of ['query', 'part', 'vehicle', 'reference']) if (body[key] !== undefined && (typeof body[key] !== 'string' || body[key].length > 180)) throw new Error('Recherche trop longue ou invalide.');
  if (!body.query?.trim() || !body.part?.trim() || !['oem', 'plate', 'vin', 'model'].includes(body.type)) throw new Error('Précisez la pièce à rechercher.');
  if (body.reference && !/^[A-Z0-9 .-]{6,40}$/i.test(body.reference)) throw new Error('Référence OEM invalide.');
  if (!['all', ...marketplaces.map((m) => m.country)].includes(body.country || 'all') || !['all', 'new', 'used'].includes(body.condition || 'all')) throw new Error('Filtre invalide.');
  if (body.type !== 'oem' && !body.vehicle?.trim()) throw new Error('Précisez le véhicule confirmé.');
  return { ...body, country: body.country || 'all', condition: body.condition || 'all' };
}

export async function searchSource(source, criteria, { fetchImpl = fetch, signal } = {}) {
  const query = criteria.reference || translateQuery(criteria.query, source.country);
  const url = marketplaceUrl(source, query);
  try {
    const result = await fetchPublicPage(url, { fetchImpl, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) });
    if (!result.html) return { ...result, id: source.id, name: source.name, country: source.country, url };
    const parsed = extractOffers(result.html, source);
    return { id: source.id, name: source.name, country: source.country, url, status: parsed.recognized ? 'read' : 'unreadable', offers: parsed.offers };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { id: source.id, name: source.name, country: source.country, url, status: 'unavailable', offers: [] };
  }
}

export async function comparePublicOffers(body, { fetchImpl = fetch, signal } = {}) {
  const criteria = validateRequest(body);
  const queue = marketplaces.filter((source) => criteria.country === 'all' || source.country === criteria.country);
  const sources = [];
  // Keep public requests modest, and do not retry a blocked source.
  await Promise.all(Array.from({ length: Math.min(3, queue.length) }, async () => {
    while (queue.length) {
      const source = queue.shift();
      sources.push(await searchSource(source, criteria, { fetchImpl, signal }));
    }
  }));
  const rates = sources.some((s) => s.offers.some((o) => o.currency !== 'EUR')) ? await readExchangeRates({ fetchImpl, signal }) : null;
  return { ...compareOffers(sources.flatMap((s) => s.offers), criteria, { ...criteria, rates }), exchangeRates: rates, sources: sources.map(({ offers, ...source }) => ({ ...source, count: offers.length })), checkedAt: new Date().toISOString(), scope: 'Première page des annonces publiques accessibles. Prix hors livraison ; aucune garantie de prix minimum sur toute l’Europe.' };
}
