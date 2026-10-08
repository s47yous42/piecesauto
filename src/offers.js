import { partNames } from './marketplaces.js';

export const fold = (value = '') => String(value).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[ß]/g, 'ss').replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = (value) => fold(value).split(' ').filter(Boolean);

export function referenceTokens(value) {
  return String(value).toUpperCase().match(/[A-Z0-9]+(?:[-.][A-Z0-9]+)*/g)?.map((v) => v.replace(/[^A-Z0-9]/g, '')).filter((v) => v.length >= 6 && /\d/.test(v)) || [];
}

export function createOfferCriteria({ query, type, vehicle = '', part = '', reference = '' }) {
  const inferredReference = referenceTokens(part || query).find((token) => /\d.*\d.*\d/.test(token)) || '';
  return { query, type, vehicle, part: part || query, reference: reference.trim().toUpperCase() || inferredReference };
}

export function matchOffer(offer, criteria) {
  const text = fold(`${offer.title} ${offer.description || ''} ${offer.reference || ''}`);
  const title = fold(offer.title);
  const requestedGroup = partNames.find((names) => names.some((name) => fold(criteria.part).includes(fold(name))));
  const accessoryIndex = title.search(/\b(connecteur|connector|poulie|pulley|courroie|belt|support|halter|repair kit|kit reparation)\b/);
  const partIndexes = (requestedGroup || []).map((name) => title.indexOf(fold(name))).filter((index) => index >= 0);
  const partIndex = partIndexes.length ? Math.min(...partIndexes) : -1;
  if (accessoryIndex >= 0 && (partIndex < 0 || accessoryIndex < partIndex) && !/\b(connecteur|connector|poulie|pulley|courroie|belt|support|halter|kit)\b/.test(fold(criteria.part))) return null;
  // Reject repair services, cores, non-working parts and requests for parts.
  if (/\b(defekt|defective|reparatur|repair service|pour pieces|hors service|panne|a reparer|for parts|schlachtfest|gesucht|recherche achat)\b/.test(text)) return null;
  if (offer.condition === 'new' && /\b(reconditionne|refurbished|remanufactured|generaluberholt|regenerowany)\b/.test(title)) return null;
  if (criteria.reference) {
    const reference = criteria.reference.replace(/[^A-Z0-9]/g, '');
    if (!referenceTokens(`${offer.title} ${offer.description || ''} ${offer.reference || ''}`).includes(reference)) return null;
    // A reference mentioned on a repair service is not an equivalent part.
    const partGroup = partNames.find((names) => names.some((name) => fold(criteria.part).includes(fold(name))));
    if (partGroup && !partGroup.some((name) => text.includes(fold(name)))) return null;
    return { kind: 'reference', label: 'Même référence OEM mentionnée par le vendeur ; montage à confirmer.' };
  }
  const words = tokens(criteria.part).filter((t) => !['de', 'du', 'la', 'le', 'pour', 'un', 'une', 'avec'].includes(t));
  if (!words.length) return null;
  const matches = (word) => {
    const group = partNames.find((names) => names.some((name) => fold(name) === word));
    return group ? group.some((name) => text.includes(fold(name))) : tokens(text).includes(word);
  };
  if (!words.every(matches) || !tokens(criteria.vehicle).every(matches)) return null;
  return { kind: 'description', label: 'Description correspondante ; référence et compatibilité non confirmées.' };
}

export function normalizeCondition(value = '') {
  const condition = fold(String(value).split('/').pop());
  if (['newcondition', 'neuf', 'neu', 'nuovo', 'nuevo', 'nieuw', 'nowe', 'new'].includes(condition)) return 'new';
  if (['usedcondition', 'occasion', 'gebraucht', 'usato', 'usado', 'gebruikt', 'utilise', 'uzywane', 'used'].includes(condition)) return 'used';
  return 'unknown';
}

export function compareOffers(offers, criteria, { country = 'all', condition = 'all', rates = null, now = Date.now() } = {}) {
  const seen = new Set();
  const valid = offers.flatMap((offer) => {
    const match = matchOffer(offer, criteria);
    if (!match || !['new', 'used'].includes(offer.condition) || offer.available === false || !Number.isFinite(offer.price) || offer.price <= 0 || !/^[A-Z]{3}$/.test(offer.currency) || !/^https:\/\//.test(offer.url)) return [];
    if ((country !== 'all' && offer.country !== country) || (condition !== 'all' && offer.condition !== condition)) return [];
    const observedAt = Date.parse(offer.observedAt);
    if (!Number.isFinite(observedAt) || now - observedAt > 15 * 60 * 1000 || observedAt > now + 60000) return [];
    const key = `${offer.url}|${offer.condition}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const rateDate = Date.parse(rates?.date);
    const rate = offer.currency === 'EUR' ? 1 : Number.isFinite(rateDate) && now - rateDate <= 7 * 86400000 && rateDate <= now && rates?.values?.[offer.currency];
    const euroPrice = rate > 0 ? Math.round(offer.price / rate * 100) / 100 : null;
    // Only an explicit rate for this exact destination supports a delivered total.
    const shipping = offer.shipping?.country === 'FR' && offer.shipping?.postalCode === '69390' && offer.shipping?.currency === offer.currency && Number.isFinite(offer.shipping?.price) && offer.shipping.price >= 0 ? offer.shipping.price : null;
    const totalEUR = euroPrice !== null && shipping !== null ? Math.round((offer.price + shipping) / rate * 100) / 100 : null;
    return [{ ...offer, match, euroPrice, totalEUR, exchangeDate: offer.currency === 'EUR' ? null : rates?.date || null }];
  });
  valid.sort((a, b) => (a.euroPrice ?? Infinity) - (b.euroPrice ?? Infinity));
  const best = (kind, delivered) => valid.filter((o) => o.condition === kind && o.match.kind === 'reference' && (delivered ? o.totalEUR !== null : o.euroPrice !== null)).sort((a, b) => (delivered ? a.totalEUR - b.totalEUR : a.euroPrice - b.euroPrice))[0] || null;
  return { offers: valid, best: { used: best('used', false), new: best('new', false) }, deliveredBest: { used: best('used', true), new: best('new', true) }, destination: { country: 'FR', postalCode: '69390', city: 'Vernaison' } };
}
