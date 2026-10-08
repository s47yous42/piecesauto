import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareVehicleSearch, vehicleSources, buildVehicleLink, loadVehicleExchange } from '../../src/vehicleSearch.js';

const prepare = (values = {}) => prepareVehicleSearch({ description: 'Renault Clio', ...values });
test('vehicle criteria exclude all part and VIN context', () => {
  const result = prepare({ vin: 'INVALID', part: 'alternateur', vehicle: 'Mercedes', condition: 'new' });
  assert.deepEqual(result.criteria, { description: 'Renault Clio', energy: 'all', yearMin: null, yearMax: null, kmMin: null, kmMax: null, priceMin: null, priceMax: null });
  assert.equal(vehicleSources.length, 8);
  assert.equal(new Set(vehicleSources.map((s) => s.country)).size, 8);
});
test('vehicle ranges reject invalid, reversed and fractional values while retaining zero', () => {
  for (const values of [{ description: '' }, { yearMin: '2020', yearMax: '2019' }, { kmMin: '-1' }, { priceMax: '10.5' }, { yearMin: 'abc' }, { energy: 'invalid' }]) assert.ok(prepare(values).error);
  assert.equal(prepare({ kmMin: '0', priceMin: '0', yearMin: '2020', yearMax: '2020' }).criteria.priceMin, 0);
});
test('Leboncoin searches cars with combined native ranges and energy', () => {
  const criteria = prepare({ yearMin: '2015', yearMax: '2022', kmMax: '100000', priceMax: '15000', energy: 'petrol' }).criteria;
  const link = buildVehicleLink(vehicleSources[0], criteria);
  const url = new URL(link.href);
  assert.equal(url.searchParams.get('category'), '2');
  assert.equal(url.searchParams.get('text'), 'Renault Clio');
  assert.equal(url.searchParams.get('regdate'), '2015-2022');
  assert.equal(url.searchParams.get('mileage'), '0-100000');
  assert.equal(url.searchParams.get('price'), '0-15000');
  assert.equal(url.searchParams.get('fuel'), '1');
  assert.deepEqual(link.manual, []);
});
test('free text stays encoded and unavailable native filters are explicitly reported', () => {
  const criteria = prepare({ description: 'Ford / Focus & price=1 #test', yearMin: '2015', kmMax: '90000', energy: 'plugin' }).criteria;
  const german = buildVehicleLink(vehicleSources[1], criteria);
  assert.ok(german.href.includes(encodeURIComponent(criteria.description)));
  const spanish = buildVehicleLink(vehicleSources[3], criteria);
  assert.deepEqual(spanish.manual, ['année', 'kilométrage', 'motorisation']);
  assert.ok(new URL(spanish.href).searchParams.get('s').includes('híbrido enchufable'));
});
test('Polish price ranges require an exchange rate and convert euros to zlotys', () => {
  const criteria = prepare({ priceMin: '5000', priceMax: '10000', kmMax: '100000' }).criteria;
  const source = vehicleSources.find((s) => s.id === 'olx');
  const unavailable = buildVehicleLink(source, criteria);
  assert.ok(unavailable.manual.includes('prix'));
  assert.equal(new URL(unavailable.href).searchParams.has('search[filter_float_price:from]'), false);
  const converted = buildVehicleLink(source, criteria, { rate: 4.3825, date: '2026-10-07' });
  assert.equal(new URL(converted.href).searchParams.get('search[filter_float_price:from]'), '21913');
  assert.equal(new URL(converted.href).searchParams.get('search[filter_float_price:to]'), '43825');
  assert.equal(criteria.priceMin, 5000);
});
test('exchange lookup rejects stale, wrong currency and failed responses', async () => {
  const now = Date.parse('2026-10-08T12:00:00Z');
  const valid = { date: '2026-10-07', base: 'EUR', quote: 'PLN', rate: 4.3825 };
  const fetchImpl = (value, ok = true) => async () => ({ ok, json: async () => value });
  assert.deepEqual(await loadVehicleExchange({ fetchImpl: fetchImpl(valid), now }), { date: valid.date, rate: valid.rate });
  for (const value of [{ ...valid, date: '2026-09-01' }, { ...valid, quote: 'USD' }, { ...valid, rate: -1 }]) await assert.rejects(loadVehicleExchange({ fetchImpl: fetchImpl(value), now }));
  await assert.rejects(loadVehicleExchange({ fetchImpl: fetchImpl(valid, false), now }));
});
