import { normalizeSearch } from './suppliersConfig.js';
import { buildVinPartsQuery, inspectVin } from './vin.js';

export function inspectPlate(value) {
  const compact = value.normalize('NFKC').toUpperCase().replace(/[\s-]/g, '');
  if (!/^[A-Z0-9]{2,15}$/.test(compact) || !/\d/.test(compact)) {
    return { error: 'Saisissez une plaque composée de lettres et de chiffres, par exemple AB-123-CD.' };
  }
  const plate = /^[A-Z]{2}\d{3}[A-Z]{2}$/.test(compact)
    ? `${compact.slice(0, 2)}-${compact.slice(2, 5)}-${compact.slice(5)}` : compact;
  return { plate };
}

export function prepareSearch({ type, input, vehicle = '', part = '', year = '' }) {
  if (type === 'oem') {
    const query = normalizeSearch(input, type);
    return query ? { query } : { error: 'Saisissez une référence ou une description de la pièce.' };
  }
  if (type === 'model') {
    if (!input.trim()) return { error: 'Saisissez la marque et le modèle du véhicule.' };
    if (!part.trim()) return { error: 'Précisez la pièce ou la référence OEM recherchée.' };
    if (!/^\d{4}$/.test(year)) return { error: 'Saisissez une année au format AAAA, par exemple 2016.' };
    const numericYear = Number(year);
    if (numericYear < 1886 || numericYear > new Date().getFullYear() + 1) {
      return { error: 'Saisissez une année comprise entre 1886 et l’année prochaine.' };
    }
    const model = input.trim().replace(/\s+/g, ' ');
    return { query: buildVinPartsQuery(part, `${model} ${year}`), model, year };
  }
  const identity = type === 'vin' ? inspectVin(input) : inspectPlate(input);
  if (identity.error) return identity;
  if (!part.trim()) return { ...identity, error: 'Précisez la pièce ou la référence OEM recherchée.' };
  if (!vehicle.trim()) return { ...identity, error: type === 'vin'
    ? 'Identifiez le véhicule avec le VIN ou saisissez son modèle et sa motorisation.'
    : 'Identifiez votre véhicule chez Oscaro avec la plaque, puis renseignez le modèle et la motorisation ci-dessous.' };
  return { ...identity, query: buildVinPartsQuery(part, vehicle) };
}
