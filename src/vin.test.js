import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVinPartsQuery, inspectVin } from './vin.js';
import { buildSupplierUrl, suppliers } from './suppliersConfig.js';
import { decodeVin, parseDecodedVehicle } from './vinDecoder.js';
import { inspectPlate, prepareSearch } from './search.js';

test('description, plate and VIN searches prepare the requested piece', () => {
  assert.equal(prepareSearch({ type: 'oem', input: ' alternateur  Clio 4 ' }).query, 'ALTERNATEUR CLIO 4');
  for (const [type, input] of [['plate', 'ab 123 cd'], ['vin', 'VF7SBHMZ0EW554823']]) {
    const result = prepareSearch({ type, input, part: 'filtre à huile', vehicle: 'Clio 1.5 dCi' });
    assert.equal(result.query, 'filtre à huile Clio 1.5 dCi');
    assert.ok(!result.query.includes(input));
    assert.equal(result.error, undefined);
  }
});

test('model searches require and include the make, model, year and requested part', () => {
  const result = prepareSearch({ type: 'model', input: ' Renault   Clio IV ', year: '2016', part: ' alternateur ' });
  assert.equal(result.query, 'alternateur Renault Clio IV 2016');
  assert.equal(result.model, 'Renault Clio IV');
  assert.equal(result.year, '2016');

  assert.match(prepareSearch({ type: 'model', input: '', year: '2016', part: 'alternateur' }).error, /marque et le modèle/);
  assert.match(prepareSearch({ type: 'model', input: 'Renault Clio IV', year: '2016', part: '' }).error, /pièce/);
  for (const year of ['', '16', 'abcd', '1885', String(new Date().getFullYear() + 2)]) {
    assert.ok(prepareSearch({ type: 'model', input: 'Renault Clio IV', year, part: 'alternateur' }).error, year);
  }
});

test('plate normalization accepts common separators without claiming vehicle identification', () => {
  assert.deepEqual(inspectPlate(' ab-123 cd '), { plate: 'AB-123-CD' });
  assert.deepEqual(inspectPlate('1234 AB 75'), { plate: '1234AB75' });
  for (const plate of ['', '???', 'ABC', 'AB/123/CD']) assert.ok(inspectPlate(plate).error);
});

test('identity modes require both requested part and confirmed vehicle', () => {
  for (const [type, input] of [['plate', 'AB123CD'], ['vin', 'VF7SBHMZ0EW554823']]) {
    assert.ok(prepareSearch({ type, input }).error);
    assert.ok(prepareSearch({ type, input, part: 'alternateur' }).error);
    assert.ok(prepareSearch({ type, input: '?', vehicle: 'Clio', part: 'alternateur' }).error);
  }
  assert.ok(prepareSearch({ type: 'oem', input: '   ' }).error);
});

test('normalizes the article VIN and separates WMI, VDS and VIS', () => {
  assert.deepEqual(inspectVin(' vf7-sbhmz0 ew554823 '), {
    vin: 'VF7SBHMZ0EW554823', wmi: 'VF7', vds: 'SBHMZ0', vis: 'EW554823', manufacturer: 'Citroën',
  });
});

test('complete decoding exposes only returned vehicle attributes', () => {
  const decoded = parseDecodedVehicle({ Results: [{ Make: 'BMW', Model: 'X3', ModelYear: '2011', DisplacementL: '3.000000', ErrorCode: '0' }] });
  assert.equal(decoded.description, 'BMW X3 3 L 2011');
  assert.equal(decoded.reliable, true);
  assert.equal(decoded.engine, '');
});

test('partial or erroneous VIN decoding cannot fill the vehicle automatically', () => {
  for (const result of [{ Make: 'BMW', Model: 'X3', ErrorCode: '1' }, { Make: 'CITROEN', ErrorCode: '0' }, { Make: 'BMW', Model: 'X3' }, { Make: 'BMW', Model: 'X3', ErrorCode: '0,14' }]) {
    const decoded = parseDecodedVehicle({ Results: [result] });
    assert.equal(decoded.reliable, false);
    assert.ok(decoded.warning);
  }
  assert.throws(() => parseDecodedVehicle({ Results: [] }));
});

test('decoder validates before sending and propagates cancellation', async () => {
  let calls = 0;
  await assert.rejects(decodeVin('INVALID', { fetchImpl: async () => { calls++; } }));
  assert.equal(calls, 0);
  const controller = new AbortController();
  await decodeVin(' vf7-sbhmz0 ew554823 ', { signal: controller.signal, fetchImpl: async (url, options) => {
    assert.ok(url.includes('/VF7SBHMZ0EW554823?format=json'));
    assert.equal(options.signal, controller.signal);
    return { ok: true, json: async () => ({ Results: [{ Make: 'CITROEN', ErrorCode: '7' }] }) };
  } });
});

test('decoder handles service errors instead of fabricating a vehicle', async () => {
  await assert.rejects(decodeVin('VF7SBHMZ0EW554823', { fetchImpl: async () => ({ ok: false }) }), /indisponible/);
  await assert.rejects(decodeVin('VF7SBHMZ0EW554823', { fetchImpl: async () => { throw new TypeError('network'); } }), /network/);
});

test('rejects forbidden letters, punctuation and incorrect lengths', () => {
  for (const vin of ['', 'VF7SBHMZ0EW55482', 'VF7SBHMZ0EW5548234', 'VF7SBHMZIEW554823', 'VF7SBHMZOEW554823', 'VF7SBHMZQEW554823', 'VF7SBHMZ.EW554823']) {
    assert.ok(inspectVin(vin).error, vin);
  }
});

test('does not reject unknown manufacturers or impose a universal check digit', () => {
  const result = inspectVin('ZZZSBHMZ0EW554823');
  assert.equal(result.manufacturer, '');
  assert.equal(result.error, undefined);
});

test('supplier links search the requested part and vehicle without disclosing the VIN', () => {
  const query = buildVinPartsQuery(' alternateur ', ' Citroën   C3 1.2 ');
  assert.equal(query, 'alternateur Citroën C3 1.2');
  for (const supplier of suppliers) {
    for (const condition of ['all', ...supplier.conditions]) {
      const url = new URL(buildSupplierUrl(supplier, query, condition));
      const search = `${decodeURIComponent(url.pathname)} ${[...url.searchParams.values()].join(' ')}`;
      const words = ['alternateur', 'lichtmaschine', 'alternatore', 'alternador', 'dynamo', 'alternator'];
      assert.ok(words.some((word) => search.includes(`${word} Citroën C3 1.2`)), supplier.id);
      assert.ok(!url.href.includes('VF7SBHMZ0EW554823'));
      assert.equal(url.protocol, 'https:');
    }
  }
});
