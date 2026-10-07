import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVinPartsQuery, inspectVin } from './vin.js';
import { buildSupplierUrl, suppliers } from './suppliersConfig.js';

test('normalizes the article VIN and separates WMI, VDS and VIS', () => {
  assert.deepEqual(inspectVin(' vf7-sbhmz0 ew554823 '), {
    vin: 'VF7SBHMZ0EW554823', wmi: 'VF7', vds: 'SBHMZ0', vis: 'EW554823', manufacturer: 'Citroën',
  });
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
      const search = [...url.searchParams.values()].join(' ');
      assert.ok(search.includes(query), supplier.id);
      assert.ok(!url.href.includes('VF7SBHMZ0EW554823'));
      assert.equal(url.protocol, 'https:');
    }
  }
});
