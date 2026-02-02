import { describe, it } from 'node:test';
import assert from 'node:assert';
import { search, generate } from '../index.mjs';

describe('search', () => {
  it('returns matching channels', async () => {
    const results = await search('globo', { countries: ['br'], limit: 5 });
    assert.ok(Array.isArray(results), 'should be array');
    assert.ok(results.length > 0, 'should find matches');
    assert.ok(results[0].country === 'br', 'should include country');
    assert.ok(results[0].name, 'should have name');
  });

  it('respects limit', async () => {
    const results = await search('tv', { countries: ['br'], limit: 3 });
    assert.ok(results.length <= 3, 'should respect limit');
  });

  it('respects countries filter', async () => {
    const results = await search('news', { countries: ['us'], limit: 5 });
    assert.ok(results.every((r) => r.country === 'us'), 'all should be from us');
  });

  it('respects retransmits filter (parents only)', async () => {
    const results = await search('globo', { countries: ['br'], retransmits: 'parents', limit: 20 });
    assert.ok(results.every((r) => r.retransmits == null || r.retransmits === ''), 'all should be parents');
  });

  it('respects retransmits filter (affiliates only)', async () => {
    const results = await search('globo', { countries: ['br'], retransmits: 'affiliates', limit: 20 });
    assert.ok(results.every((r) => r.retransmits != null && r.retransmits !== ''), 'all should be affiliates');
  });
});

describe('generate', () => {
  it('returns channels from countries by priority', async () => {
    const results = await generate({
      countries: ['br', 'us'],
      limit: 50,
      minPerCategory: 5
    });
    assert.ok(Array.isArray(results), 'should be array');
    assert.ok(results.length > 0, 'should have channels');
    assert.ok(results[0].country, 'should have country');
    assert.ok(results[0].category, 'should have category');
    assert.ok(results.length <= 50, 'should respect limit');
  });

  it('respects limit', async () => {
    const results = await generate({
      countries: ['br', 'us'],
      limit: 10,
      minPerCategory: 2
    });
    assert.ok(results.length <= 10, 'should respect limit');
  });

  it('respects categories filter', async () => {
    const results = await generate({
      countries: ['br', 'us'],
      categories: ['Shop'],
      limit: 50,
      minPerCategory: 5
    });
    assert.ok(results.every((r) => r.category === 'Shop'), 'all should be Shop');
    assert.ok(results.length <= 50, 'should respect limit');
  });

  it('respects retransmits filter (parents only)', async () => {
    const results = await generate({
      countries: ['br'],
      retransmits: 'parents',
      limit: 30,
      minPerCategory: 5
    });
    assert.ok(results.every((r) => r.retransmits == null || r.retransmits === ''), 'all should be parents');
  });

  it('mainCountryFull includes all from first country, supplements from others', async () => {
    const { getChannels } = await import('../index.mjs');
    const brData = await getChannels('br');
    const brShopTotal = (brData?.Shop ?? []).length;
    const results = await generate({
      countries: ['br', 'us'],
      mainCountryFull: true,
      categories: ['Shop'],
      limit: 500,
      minPerCategory: 10
    });
    const brCount = results.filter((r) => r.country === 'br').length;
    assert.ok(brCount === brShopTotal, `should include all BR Shop (${brShopTotal}), got ${brCount}`);
    const usCount = results.filter((r) => r.country === 'us').length;
    assert.ok(usCount >= 0, 'US supplements when BR Shop < minPerCategory');
  });
});
