import { normalizeSearch } from './suppliersConfig.js';

// WMI examples documented by Outils OBD Facile; this is not a complete registry.
const manufacturers = {
  VF1: 'Renault', VF3: 'Peugeot', VF7: 'Citroën', UU1: 'Dacia',
  WVW: 'Volkswagen', W0L: 'Opel', WBA: 'BMW', WDB: 'Mercedes',
  WF0: 'Ford', WME: 'Smart', WMW: 'Mini', WP0: 'Porsche',
  TMB: 'Škoda', JTD: 'Toyota', JMZ: 'Mazda', JF1: 'Subaru',
};

export function inspectVin(value) {
  const vin = normalizeSearch(value, 'vin');
  if (!vin) return { error: 'Saisissez le VIN indiqué en case E de votre carte grise.' };
  if (/[IOQ]/.test(vin)) return { error: 'Un VIN ne contient pas les lettres I, O ou Q. Vérifiez la case E de votre carte grise.' };
  if (!/^[A-HJ-NPR-Z0-9]+$/.test(vin)) return { error: 'Le VIN doit contenir uniquement des lettres et des chiffres.' };
  if (vin.length !== 17) return { error: `Le VIN doit contenir 17 caractères (${vin.length} saisis). Pour un véhicule ancien, utilisez la recherche par description.` };
  return {
    vin,
    wmi: vin.slice(0, 3),
    vds: vin.slice(3, 9),
    vis: vin.slice(9),
    manufacturer: manufacturers[vin.slice(0, 3)] || '',
  };
}

export function buildVinPartsQuery(part, vehicle) {
  return [part, vehicle].map((value) => value.normalize('NFKC').trim().replace(/\s+/g, ' ')).filter(Boolean).join(' ');
}
