export const vehicleEnergies = [
  { id: 'all', label: 'Toutes les énergies' }, { id: 'petrol', label: 'Essence' },
  { id: 'diesel', label: 'Diesel' }, { id: 'hybrid', label: 'Hybride' },
  { id: 'plugin', label: 'Hybride rechargeable' }, { id: 'electric', label: 'Électrique' },
  { id: 'lpg', label: 'GPL' }, { id: 'cng', label: 'GNV / gaz naturel' },
  { id: 'hydrogen', label: 'Hydrogène' }, { id: 'other', label: 'Autre motorisation' },
];

export const emptyVehicleFilters = { description: '', yearMin: '', yearMax: '', energy: 'all', kmMin: '', kmMax: '', priceMin: '', priceMax: '' };

export function prepareVehicleSearch(values) {
  // Explicit allowlist: no VIN, plate, part, OEM or piece-condition context.
  const description = String(values.description || '').normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (!description) return { error: 'Décrivez le véhicule recherché : marque, modèle, version…' };
  if (description.length > 180) return { error: 'Limitez le descriptif du véhicule à 180 caractères.' };
  const energy = values.energy || 'all';
  if (!vehicleEnergies.some((item) => item.id === energy)) return { error: 'Choisissez une motorisation proposée dans la liste.' };
  const criteria = { description, energy };
  for (const [prefix, label, min, max] of [['year', 'année', 1886, new Date().getFullYear() + 1], ['km', 'kilométrage', 0, 10000000], ['price', 'prix', 0, 1000000000]]) {
    for (const suffix of ['Min', 'Max']) {
      const key = prefix + suffix;
      const raw = String(values[key] ?? '').trim();
      if (!raw) { criteria[key] = null; continue; }
      if (!/^\d+$/.test(raw) || Number(raw) < min || Number(raw) > max) return { error: `Le champ ${label} doit être un entier compris entre ${min} et ${max}.` };
      criteria[key] = Number(raw);
    }
    if (criteria[prefix + 'Min'] !== null && criteria[prefix + 'Max'] !== null && criteria[prefix + 'Min'] > criteria[prefix + 'Max']) return { error: `La borne minimale de ${label} doit être inférieure ou égale à la borne maximale.` };
  }
  return { criteria };
}

const fuelTerms = {
  fr: ['essence', 'diesel', 'hybride', 'hybride rechargeable', 'électrique', 'GPL', 'GNV', 'hydrogène', ''],
  de: ['Benzin', 'Diesel', 'Hybrid', 'Plug-in Hybrid', 'Elektro', 'Autogas LPG', 'Erdgas CNG', 'Wasserstoff', ''],
  it: ['benzina', 'diesel', 'ibrida', 'ibrida plug-in', 'elettrica', 'GPL', 'metano', 'idrogeno', ''],
  es: ['gasolina', 'diésel', 'híbrido', 'híbrido enchufable', 'eléctrico', 'GLP', 'GNC', 'hidrógeno', ''],
  nl: ['benzine', 'diesel', 'hybride', 'plug-in hybride', 'elektrisch', 'LPG', 'CNG', 'waterstof', ''],
  pl: ['benzyna', 'diesel', 'hybryda', 'hybryda plug-in', 'elektryczny', 'LPG', 'CNG', 'wodór', ''],
};
const set = (params, key, value) => { if (value !== null && value !== undefined && value !== '') params.set(key, String(value)); };
const hasRange = (c, prefix) => c[prefix + 'Min'] !== null || c[prefix + 'Max'] !== null;
const range = (c, prefix, separator, lower = '', upper = '') => `${c[prefix + 'Min'] ?? lower}${separator}${c[prefix + 'Max'] ?? upper}`;

export const vehicleSources = [
  { id: 'leboncoin', name: 'Leboncoin', country: 'fr', color: 'orange', base: 'https://www.leboncoin.fr/recherche', currency: 'EUR', native: ['year', 'km', 'price'], fuel: { petrol: '1', diesel: '2', lpg: '3', electric: '4', hybrid: '5' } },
  { id: 'kleinanzeigen', name: 'Kleinanzeigen', country: 'de', color: 'green', base: 'https://www.kleinanzeigen.de/s-autos/', currency: 'EUR', native: ['year', 'km', 'price'], fuel: { petrol: 'benzin', diesel: 'diesel', hybrid: 'hybrid', electric: 'elektro', lpg: 'lpg', cng: 'cng' } },
  { id: 'subito', name: 'Subito', country: 'it', color: 'red', base: 'https://www.subito.it/annunci-italia/vendita/auto/', currency: 'EUR', native: ['price'], fuel: {} },
  { id: 'milanuncios', name: 'Milanuncios', country: 'es', color: 'green', base: 'https://www.milanuncios.com/coches-de-segunda-mano/', currency: 'EUR', native: [], fuel: {} },
  { id: 'marktplaats', name: 'Marktplaats', country: 'nl', color: 'blue', base: 'https://www.marktplaats.nl/l/auto-s/', currency: 'EUR', native: ['price'], fuel: {} },
  { id: 'olx', name: 'OLX', country: 'pl', color: 'teal', base: 'https://www.olx.pl/motoryzacja/samochody/', currency: 'PLN', native: ['year', 'km', 'price'], fuel: { petrol: 'petrol', diesel: 'diesel', hybrid: 'hybrid', electric: 'electric', lpg: 'lpg', cng: 'cng' } },
  { id: 'willhaben', name: 'Willhaben', country: 'at', color: 'navy', base: 'https://www.willhaben.at/iad/gebrauchtwagen/auto/gebrauchtwagenboerse', currency: 'EUR', native: ['year', 'km', 'price'], fuel: {} },
  { id: '2ememain', name: '2ememain', country: 'be', color: 'yellow', base: 'https://www.2ememain.be/l/autos/', currency: 'EUR', native: ['price'], fuel: {} },
];

export function buildVehicleLink(source, criteria, exchange = null) {
  const c = { ...criteria };
  const applied = [], manual = [];
  const labels = { year: 'année', km: 'kilométrage', price: 'prix', energy: 'motorisation' };
  const fuel = source.fuel[c.energy];
  const language = source.country === 'at' ? 'de' : source.country === 'be' ? 'fr' : source.country;
  const energyIndex = vehicleEnergies.findIndex((item) => item.id === c.energy) - 1;
  const fuelTerm = c.energy === 'all' || fuel ? '' : fuelTerms[language]?.[energyIndex] || '';
  const query = [c.description, fuelTerm].filter(Boolean).join(' ');
  let priceAvailable = true;
  if (source.currency === 'PLN' && hasRange(c, 'price')) {
    priceAvailable = Boolean(exchange?.rate > 0);
    if (priceAvailable) {
      if (c.priceMin !== null) c.priceMin = Math.ceil(c.priceMin * exchange.rate);
      if (c.priceMax !== null) c.priceMax = Math.floor(c.priceMax * exchange.rate);
    }
  }
  for (const prefix of ['year', 'km', 'price']) {
    if (hasRange(c, prefix)) (source.native.includes(prefix) && (prefix !== 'price' || priceAvailable) ? applied : manual).push(labels[prefix]);
  }
  if (c.energy !== 'all') (fuel ? applied : manual).push(labels.energy);
  const url = new URL(source.base);
  const p = url.searchParams;
  if (source.id === 'leboncoin') {
    p.set('category', '2'); p.set('text', query);
    for (const [key, prefix] of [['regdate', 'year'], ['mileage', 'km'], ['price', 'price']]) if (hasRange(c, prefix)) p.set(key, range(c, prefix, '-', prefix === 'year' ? 'min' : '0', 'max'));
    set(p, 'fuel', fuel);
  } else if (source.id === 'kleinanzeigen') {
    const price = hasRange(c, 'price') ? `preis:${range(c, 'price', ':')}/` : '';
    const filters = [hasRange(c, 'year') && `autos.ez_i:${range(c, 'year', ',')}`, hasRange(c, 'km') && `autos.km_i:${range(c, 'km', ',')}`, fuel && `autos.fuel_s:${fuel}`].filter(Boolean);
    // Encode the description as one segment; never let free text become a filter.
    return { href: `${source.base}${price}${encodeURIComponent(query)}/k0c216${filters.map((f) => '+' + f).join('')}`, applied, manual };
  } else if (source.id === 'subito') {
    p.set('q', query); set(p, 'ps', c.priceMin); set(p, 'pe', c.priceMax);
  } else if (source.id === 'milanuncios') {
    p.set('s', query);
  } else if (source.id === 'marktplaats' || source.id === '2ememain') {
    url.pathname += `q/${encodeURIComponent(query)}/`;
    // These sites read range filters from the browser fragment, not query parameters.
    const filters = [];
    if (c.priceMin !== null) filters.push(`PriceCentsFrom:${c.priceMin * 100}`);
    if (c.priceMax !== null) filters.push(`PriceCentsTo:${c.priceMax * 100}`);
    url.hash = filters.join('|');
  } else if (source.id === 'olx') {
    url.pathname += `q-${encodeURIComponent(query)}/`;
    for (const [key, prefix] of [['year', 'year'], ['milage', 'km'], ['price', 'price']]) {
      if (prefix === 'price' && !priceAvailable) continue;
      set(p, `search[filter_float_${key}:from]`, c[prefix + 'Min']);
      set(p, `search[filter_float_${key}:to]`, c[prefix + 'Max']);
    }
    set(p, 'search[filter_enum_petrol][0]', fuel);
  } else if (source.id === 'willhaben') {
    p.set('keyword', query);
    for (const [key, prefix] of [['YEAR_MODEL', 'year'], ['MILEAGE', 'km'], ['PRICE', 'price']]) {
      set(p, `${key}_FROM`, c[prefix + 'Min']); set(p, `${key}_TO`, c[prefix + 'Max']);
    }
  }
  return { href: url.href, applied, manual, exchange: source.currency === 'PLN' && hasRange(c, 'price') && priceAvailable ? exchange : null };
}

export async function loadVehicleExchange({ fetchImpl = fetch, signal, now = Date.now() } = {}) {
  const response = await fetchImpl('https://api.frankfurter.dev/v2/providers/ecb/rate/EUR/PLN', { signal });
  if (!response.ok) throw new Error('Taux EUR/PLN indisponible.');
  const data = await response.json();
  const time = Date.parse(data.date);
  if (!(Number.isFinite(data.rate) && data.rate > 0) || data.base !== 'EUR' || data.quote !== 'PLN' || !Number.isFinite(time) || time > now || now - time > 7 * 86400000) throw new Error('Taux EUR/PLN non valide ou trop ancien.');
  return { rate: data.rate, date: data.date };
}
