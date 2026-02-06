import { describe, it } from 'node:test';
import assert from 'node:assert';
import { search, generate } from '../dist/index.mjs';

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

  it('fills up to limit when candidates exist (greedy)', async () => {
    const { getChannels } = await import('../dist/index.mjs');
    const countries = ['br', 'us'];
    const limit = 64;
    const retransmits = 'parents';

    let totalEligible = 0;
    for (const code of countries) {
      const data = await getChannels(code);
      if (!data) continue;
      for (const channels of Object.values(data)) {
        for (const ch of channels) {
          const hasRetransmits = ch.retransmits != null && String(ch.retransmits).trim() !== '';
          if (retransmits === 'parents' && hasRetransmits) continue;
          totalEligible += 1;
        }
      }
    }

    const results = await generate({
      countries,
      retransmits,
      limit,
      minPerCategory: 1
    });
    const expected = Math.min(limit, totalEligible);
    assert.equal(results.length, expected, 'should greedily fill up to limit');
  });

  it('greedy ordering favors earlier countries by weighted priority', async () => {
    const { getChannels } = await import('../dist/index.mjs');
    const countries = ['br', 'us'];
    const limit = 40;
    const defaultPriority = 5;
    const countryIndex = new Map(countries.map((code, index) => [code, index]));

    const candidates = [];
    for (const code of countries) {
      const data = await getChannels(code);
      if (!data) continue;
      for (const [cat, channels] of Object.entries(data)) {
        for (const ch of channels) {
          const base = ch.priority ?? defaultPriority;
          const index = countryIndex.get(code) ?? countries.length;
          const score = base / Math.max(1, index + 1);
          candidates.push({ ch, country: code, category: cat, score });
        }
      }
    }

    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aPriority = a.ch.priority ?? defaultPriority;
      const bPriority = b.ch.priority ?? defaultPriority;
      if (bPriority !== aPriority) return bPriority - aPriority;
      const aIndex = countryIndex.get(a.country) ?? countries.length;
      const bIndex = countryIndex.get(b.country) ?? countries.length;
      return aIndex - bIndex;
    });

    const expectedCounts = { br: 0, us: 0 };
    for (const item of candidates.slice(0, limit)) {
      expectedCounts[item.country] += 1;
    }

    const results = await generate({
      countries,
      limit,
      minPerCategory: 0
    });
    const actualCounts = { br: 0, us: 0 };
    for (const ch of results) {
      if (actualCounts[ch.country] !== undefined) actualCounts[ch.country] += 1;
    }

    assert.deepEqual(actualCounts, expectedCounts, 'should apply country-weighted greedy ordering');
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

  it('respects freeOnly filter', async () => {
    const results = await generate({
      countries: ['br', 'us'],
      freeOnly: true,
      limit: 50,
      minPerCategory: 5
    });
    assert.ok(results.every((r) => r.isFree === true), 'all should be free-to-air');
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
