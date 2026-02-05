import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getChannels, listCountries } from '../dist/index.mjs';

describe('@edenware/tv-channels-by-country', () => {
  describe('getChannels', () => {
    it('returns channels for valid country code (br)', async () => {
      const data = await getChannels('br');
      assert.ok(data, 'should return data');
      assert.ok(typeof data === 'object', 'should be an object');
      const categories = Object.keys(data);
      assert.ok(categories.length > 0, 'should have categories');
      assert.ok(categories.includes('Religious') || categories.includes('News'), 'should have expected category');
      const firstCategory = categories[0];
      const channels = data[firstCategory];
      assert.ok(Array.isArray(channels), 'category value should be array');
      if (channels.length > 0) {
        const ch = channels[0];
        assert.ok(ch.name, 'channel should have name');
        assert.ok('keywords' in ch, 'channel should have keywords');
        assert.ok('priority' in ch, 'channel should have priority');
        assert.ok(ch.priority >= 0 && ch.priority <= 10, 'priority should be 0-10');
      }
    });

    it('returns null for invalid country code', async () => {
      const data = await getChannels('zz');
      assert.strictEqual(data, null);
    });

    it('returns null for empty string', async () => {
      const data = await getChannels('');
      assert.strictEqual(data, null);
    });

    it('caches result on second call', async () => {
      const a = await getChannels('us');
      const b = await getChannels('us');
      assert.strictEqual(a, b, 'should return same reference from cache');
    });

    it('is case-insensitive', async () => {
      const lower = await getChannels('br');
      const upper = await getChannels('BR');
      assert.deepStrictEqual(lower, upper);
    });

    it('applies category priority limits and retransmits rules', async () => {
      const data = await getChannels('br');
      assert.ok(data, 'should return data');
      
      // Check Religious category max priority (5) - only for channels without retransmits
      if (data.Religious && data.Religious.length > 0) {
        for (const ch of data.Religious) {
          if (ch.retransmits == null || String(ch.retransmits).trim() === '') {
            assert.ok(ch.priority <= 5, `Religious channel ${ch.name} without retransmits priority ${ch.priority} should be <= 5`);
          }
        }
      }
      
      // Check Shop category max priority (4) - only for channels without retransmits
      if (data.Shop && data.Shop.length > 0) {
        for (const ch of data.Shop) {
          if (ch.retransmits == null || String(ch.retransmits).trim() === '') {
            assert.ok(ch.priority <= 4, `Shop channel ${ch.name} without retransmits priority ${ch.priority} should be <= 4`);
          }
        }
      }
      
      // Check channels with retransmits have minimum priority 8
      for (const [cat, channels] of Object.entries(data)) {
        for (const ch of channels) {
          if (ch.retransmits != null && String(ch.retransmits).trim() !== '') {
            assert.ok(ch.priority >= 8, `Channel ${ch.name} with retransmits should have priority >= 8, got ${ch.priority}`);
          }
        }
      }
    });
  });

  describe('listCountries', () => {
    it('returns array of country codes', async () => {
      const countries = await listCountries();
      assert.ok(Array.isArray(countries), 'should be array');
      assert.ok(countries.length > 100, 'should have many countries');
      assert.ok(countries.includes('br'), 'should include br');
      assert.ok(countries.includes('us'), 'should include us');
    });

    it('returns sorted list', async () => {
      const countries = await listCountries();
      const sorted = [...countries].sort();
      assert.deepStrictEqual(countries, sorted, 'should be sorted');
    });
  });
});
