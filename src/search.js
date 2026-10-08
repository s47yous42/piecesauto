import { normalizeSearch } from './suppliersConfig.js';
import { buildVinPartsQuery, inspectVin } from './vin.js';
import { identifyVinProfile } from './vinProfiles.js';

function partConflict(part, profile, vehicle) {
  if (!profile || vehicle !== profile.description || !/\b(moteur|engine|motor)\b/i.test(part)) return '';
  const litres = part.match(/\b(\d+(?:[.,]\d+)?)\s*l(?:itres?)?\b/i);
  const engine = part.match(/\b(?:OM|M)\s*\d{3}[.\s]?\d{3}\b/i)?.[0].replace(/\s|\./g, '').toUpperCase();
  if ((litres && Math.abs(Number(litres[1].replace(',', '.')) - parseFloat(profile.capacity)) > 0.05)
      || /\bdiesel\b/i.test(part)
      || (engine && engine !== profile.engine.replace('.', ''))) {
    return `La pièce demandée contredit la motorisation d’origine du type ${profile.chassis} : ${profile.engine}, ${profile.capacity} essence. Vérifiez le descriptif ou renseignez le moteur réellement monté dans l’onglet N° VIN.`;
  }
  return '';
}

export function inspectPlate(value) {
  const compact = value.normalize('NFKC').toUpperCase().replace(/[\s-]/g, '');
  if (!/^[A-Z0-9]{2,15}$/.test(compact) || !/\d/.test(compact)) {
    return { error: 'Saisissez une plaque composée de lettres et de chiffres, par exemple AB-123-CD.' };
  }
  const plate = /^[A-Z]{2}\d{3}[A-Z]{2}$/.test(compact)
    ? `${compact.slice(0, 2)}-${compact.slice(2, 5)}-${compact.slice(5)}` : compact;
  return { plate };
}

export function prepareSearch({ type, input, vehicle = '', part = '', year = '', vinContext = null }) {
  if (type === 'oem') {
    const query = normalizeSearch(input, type);
    if (!query) return { error: 'Saisissez une référence ou une description de la pièce.' };
    if (!vinContext?.vin?.trim()) return { query };
    const identity = inspectVin(vinContext.vin);
    if (identity.error) return { error: `VIN associé : ${identity.error}` };
    const profile = identifyVinProfile(identity.vin);
    const targetVehicle = vinContext.vehicle?.trim() || profile?.description;
    if (!targetVehicle) return { error: 'Le VIN associé ne permet pas encore de cibler le véhicule. Dans l’onglet N° VIN, identifiez le véhicule ou renseignez son modèle et sa motorisation, ou retirez le véhicule associé.' };
    const conflict = partConflict(query, profile, targetVehicle);
    if (conflict) return { error: conflict };
    return { ...identity, query: buildVinPartsQuery(query, targetVehicle), vehicle: targetVehicle, part: query };
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
    return { query: buildVinPartsQuery(part, `${model} ${year}`), model, year, vehicle: `${model} ${year}`, part };
  }
  const identity = type === 'vin' ? inspectVin(input) : inspectPlate(input);
  if (identity.error) return identity;
  if (!part.trim()) return { ...identity, error: 'Précisez la pièce ou la référence OEM recherchée.' };
  const profile = type === 'vin' ? identifyVinProfile(identity.vin) : null;
  const targetVehicle = vehicle.trim() || profile?.description || '';
  if (!targetVehicle) return { ...identity, error: type === 'vin'
    ? 'Identifiez le véhicule avec le VIN ou saisissez son modèle et sa motorisation.'
    : 'Identifiez votre véhicule chez Oscaro avec la plaque, puis renseignez le modèle et la motorisation ci-dessous.' };
  const conflict = partConflict(part, profile, targetVehicle);
  if (conflict) return { ...identity, error: conflict };
  return { ...identity, query: buildVinPartsQuery(part, targetVehicle), vehicle: targetVehicle, part };
}
