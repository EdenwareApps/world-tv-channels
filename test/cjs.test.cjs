const { describe, it } = require('node:test');
const assert = require('node:assert');
const { getChannels, listCountries, generate } = require('../dist/index.cjs');

describe('@edenware/tv-channels-by-country (CJS)', () => {
  it('getChannels works via require', async () => {
    const data = await getChannels('br');
    assert.ok(data, 'should return data');
    assert.ok(Object.keys(data).length > 0, 'should have categories');
  });

  it('listCountries works via require', async () => {
    const countries = await listCountries();
    assert.ok(Array.isArray(countries), 'should be array');
    assert.ok(countries.includes('br'), 'should include br');
  });

  it('generate works via require', async () => {
    const results = await generate({
      countries: ['br', 'us'],
      limit: 10,
      minPerCategory: 2
    });
    assert.ok(Array.isArray(results), 'should be array');
    assert.ok(results.length <= 10, 'should respect limit');
    if (results.length > 0) {
      assert.ok(results[0].country, 'should have country');
      assert.ok(results[0].category, 'should have category');
    }
  });
});
