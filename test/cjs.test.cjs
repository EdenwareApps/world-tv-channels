const { describe, it } = require('node:test');
const assert = require('node:assert');
const { getChannels, listCountries } = require('../index.cjs');

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
});
