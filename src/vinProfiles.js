import { inspectVin } from './vin.js';

// Limited, documented chassis-type lookup, not a full vehicle/datacard decoder.
// Never infer the build year, installed engine or individual equipment from it.
const source = {
  title: 'Catalogue Motorservice / Pierburg — Mercedes-Benz',
  url: 'https://www.ms-motorservice.com/MediaAssets/2486694_pg_50003569_web.pdf',
};
const mercedesTypes = {
  '123223': { model: '230 E', series: 'W123' },
  '123243': { model: '230 CE', series: 'C123' },
  '123283': { model: '230 TE', series: 'S123' },
};

export function identifyVinProfile(value) {
  const details = inspectVin(value);
  if (details.error || details.wmi !== 'WDB') return null;
  const type = details.vin.slice(3, 9);
  const model = mercedesTypes[type];
  if (!model) return null;
  return {
    make: 'Mercedes-Benz', ...model,
    chassis: `${type.slice(0, 3)}.${type.slice(3)}`,
    engine: 'M102.980', capacity: '2.3 L', fuel: 'essence', source,
    description: `Mercedes-Benz ${model.model} ${model.series} M102.980 2.3 L essence`,
  };
}
