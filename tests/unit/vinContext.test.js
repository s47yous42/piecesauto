import test from 'node:test';
import assert from 'node:assert/strict';
import { identifyVinProfile } from '../../src/vinProfiles.js';
import { decodeVin } from '../../src/vinDecoder.js';
import { prepareSearch } from '../../src/search.js';
import { buildSupplierUrl, suppliers } from '../../src/suppliersConfig.js';

// Synthetic serial number; no user's full VIN is committed.
const vin = 'WDB12324310999999';

test('documented chassis types identify the model and original engine without guessing a year', async () => {
  const profile = identifyVinProfile(vin);
  assert.equal(profile.model, '230 CE');
  assert.equal(profile.chassis, '123.243');
  assert.equal(profile.engine, 'M102.980');
  const decoded = await decodeVin(vin, { fetchImpl: () => { throw new Error('Known type must not send the VIN externally'); } });
  assert.equal(decoded.identification, 'chassis-type');
  assert.equal(decoded.year, '');
  assert.ok(decoded.source.url.startsWith('https://www.ms-motorservice.com/'));
  assert.match(decoded.warning, /à confirmer/);
  assert.equal(identifyVinProfile('WDB12324310888888').model, '230 CE');
  for (const other of ['WDB12399910999999', 'VF712324310999999', 'WDB1232431099999', '???']) {
    assert.equal(identifyVinProfile(other), null);
  }
});

test('description and VIN modes combine the requested engine with the same vehicle on every merchant link', () => {
  const description = prepareSearch({ type: 'oem', input: 'moteur 2.3l E', vinContext: { vin } });
  const identity = prepareSearch({ type: 'vin', input: vin, part: 'moteur 2.3l E' });
  assert.equal(description.query.toLowerCase(), identity.query.toLowerCase());
  for (const result of [description, identity]) {
    assert.equal(result.error, undefined);
    assert.match(result.query, /Mercedes-Benz 230 CE C123 M102\.980/);
    for (const supplier of suppliers) {
      const url = new URL(buildSupplierUrl(supplier, result.query, 'all'));
      const search = `${decodeURIComponent(url.pathname)} ${[...url.searchParams.values()].join(' ')}`;
      assert.match(search, /Mercedes-Benz 230 CE C123 M102\.980/, supplier.id);
      assert.ok(!url.href.includes(vin), supplier.id);
    }
  }
});

test('an unresolved or invalid associated VIN cannot silently become a generic description search', () => {
  for (const value of ['WDB12399910999999', 'INVALID']) {
    const result = prepareSearch({ type: 'oem', input: 'moteur 2.3l E', vinContext: { vin: value } });
    assert.ok(result.error);
    assert.equal(result.query, undefined);
  }
  const resolved = prepareSearch({ type: 'oem', input: 'filtre', vinContext: { vin: '1HGCM82633A004352', vehicle: 'Honda Accord 2.4 L' } });
  assert.equal(resolved.query, 'FILTRE Honda Accord 2.4 L');
  assert.equal(prepareSearch({ type: 'oem', input: 'filtre' }).query, 'FILTRE');
});

test('conflicting engine descriptions cannot override a documented VIN profile silently', () => {
  for (const part of ['moteur 3.0L', 'moteur 2.3L diesel', 'moteur M102.982']) {
    assert.match(prepareSearch({ type: 'vin', input: vin, part }).error, /contredit/);
    assert.match(prepareSearch({ type: 'oem', input: part, vinContext: { vin } }).error, /contredit/);
  }
  assert.ok(prepareSearch({ type: 'vin', input: vin, part: 'moteur 2,3 L essence M102.980' }).query);
  // A replacement engine explicitly entered by the user is retained.
  assert.match(prepareSearch({ type: 'vin', input: vin, part: 'moteur 3.0L', vehicle: 'Mercedes moteur remplacé 3.0L' }).query, /moteur remplacé/);
});
