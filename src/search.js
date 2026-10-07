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

export function prepareSearch({ type, input, vehicle = '', part = '' }) {
  if (type === 'oem') {
    const query = normalizeSearch(input, type);
    return query ? { query } : { error: 'Saisissez une référence ou une description de la pièce.' };
  }
  const identity = type === 'vin' ? inspectVin(input) : inspectPlate(input);
  if (identity.error) return identity;
  if (!part.trim()) return { ...identity, error: 'Précisez la pièce ou la référence OEM recherchée.' };
  if (!vehicle.trim()) return { ...identity, error: type === 'vin'
    ? 'Identifiez le véhicule avec le VIN ou saisissez son modèle et sa motorisation.'
    : 'Identifiez votre véhicule chez Oscaro avec la plaque, puis renseignez le modèle et la motorisation ci-dessous.' };
  return { ...identity, query: buildVinPartsQuery(part, vehicle) };
}
