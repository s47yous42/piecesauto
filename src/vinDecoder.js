import { inspectVin } from './vin.js';

export function parseDecodedVehicle(payload) {
  const result = payload?.Results?.[0];
  if (!result || typeof result !== 'object') throw new Error('Réponse du décodeur VIN inexploitable.');
  const field = (key) => typeof result[key] === 'string' ? result[key].trim() : '';
  const make = field('Make');
  const model = field('Model');
  const year = /^\d{4}$/.test(field('ModelYear')) ? field('ModelYear') : '';
  const displacement = Number(field('DisplacementL'));
  const engine = field('EngineModel');
  const capacity = Number.isFinite(displacement) && displacement > 0 ? `${Number(displacement.toFixed(1))} L` : '';
  const errorCodes = field('ErrorCode').split(',').map((code) => code.trim()).filter(Boolean);
  const reliable = errorCodes.length > 0 && errorCodes.every((code) => code === '0') && Boolean(make && model);
  return { make, model, year, engine, capacity, reliable,
    description: [make, model, engine, capacity, year].filter(Boolean).join(' '),
    warning: reliable ? '' : 'Décodage incomplet ou anomalie signalée : vérifiez le VIN et renseignez le véhicule manuellement. Ces informations ne confirment pas la compatibilité des pièces.',
  };
}

export async function decodeVin(value, { signal, fetchImpl = fetch } = {}) {
  const details = inspectVin(value);
  if (details.error) throw new Error(details.error);
  const response = await fetchImpl(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(details.vin)}?format=json`, { signal });
  if (!response.ok) throw new Error('Le service VIN est indisponible. Réessayez ou renseignez le véhicule manuellement.');
  return parseDecodedVehicle(await response.json());
}
