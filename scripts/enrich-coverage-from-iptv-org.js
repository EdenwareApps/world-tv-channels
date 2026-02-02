/**
 * Enriches channels/*.json for countries where our channel count is below 95% of
 * Wikipedia reference (~Stations). Fetches iptv-org/api channels.json and adds
 * missing channels by name. Run from repo root: node scripts/enrich-coverage-from-iptv-org.js
 * Optional: --dry-run to only print what would be added.
 *
 * Note: 95% is often not reachable from iptv-org alone — the API has fewer channel
 * names than our files for many countries (e.g. RU, CN, ES). For those, use
 * Wikipedia "List of television stations in [country]" or epg.best.
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CHANNELS_DIR = join(ROOT, 'channels');
const CHANNELS_URL = 'https://iptv-org.github.io/api/channels.json';

// Wikipedia – List of countries by number of television broadcast stations (same as count-channels.js)
const wikiStations = {
  ru: 6700, cn: 4900, us: 2761, in: 868, gb: 1822, ua: 647, tr: 635, fr: 584, ro: 575, za: 556,
  br: 384, de: 489, it: 458, es: 1780, ph: 350, mx: 236, jp: 291, se: 252, dk: 172, cz: 150, ca: 278,
  fi: 140, pk: 127, sa: 117, bd: 115, ch: 115, th: 137, pe: 105, au: 253, eg: 98, my: 262,
  sk: 130, rs: 400, tw: 86, vn: 145, af: 85, no: 144, ir: 78, ve: 66, al: 144, cl: 63, uy: 62,
  pt: 62, co: 60, cu: 58, kr: 87, hk: 55, id: 146, mk: 52, np: 50, am: 48, bo: 48, by: 96,
  dz: 46, sy: 44, lv: 44, ar: 92, nz: 41, pl: 200, md: 40, bg: 86, pa: 38, gr: 150, hr: 205,
  ma: 35, hu: 390, ba: 152, pr: 32, si: 73, ps: 31, uz: 28, lt: 61, tn: 26, gt: 26, do: 25,
  be: 89, jo: 22, nl: 394, iq: 21, cr: 20, az: 47, il: 17, ae: 35, lb: 15, lk: 34, is: 51,
  ci: 14, om: 13, me: 17, kw: 13, ly: 12, kz: 32, ge: 98, hn: 11, cy: 30, ee: 56, at: 54,
  zm: 9, kh: 9, ug: 8, kg: 8, ke: 75, la: 7, jm: 7, gh: 7, pf: 7, ec: 68, tt: 6, tj: 6, gn: 6,
  bj: 6, ao: 6, ng: 5, mc: 21, mt: 12, lu: 80, sv: 5, tm: 4, so: 4, sn: 4, kp: 4, fj: 4, cd: 4,
  ie: 75, py: 46, et: 92, fo: 3, bf: 3, sl: 2, rw: 2, ag: 2, va: 1, ye: 3, tz: 3, sd: 3, ni: 3,
  bs: 2, ht: 2, bb: 1, li: 1, bq: 3, np: 50, ad: 1, qa: 15
};

const CATEGORY_MAP = {
  religious: 'Religious', news: 'News', sports: 'Sports', entertainment: 'Entertainment',
  general: 'Entertainment', movies: 'Movies & Series', series: 'Movies & Series',
  documentary: 'Education & Culture', education: 'Education & Culture', culture: 'Education & Culture',
  kids: 'Kids', animation: 'Kids', music: 'Music Videos', shop: 'Shop', comedy: 'Entertainment',
  lifestyle: 'Entertainment', cooking: 'Entertainment', travel: 'Entertainment', auto: 'Entertainment',
  outdoor: 'Entertainment', business: 'News', public: 'News', weather: 'News', classic: 'Movies & Series',
  xxx: 'Entertainment', relax: 'Entertainment'
};

function countChannels(code) {
  try {
    const raw = JSON.parse(readFileSync(join(CHANNELS_DIR, `${code}.json`), 'utf8'));
    let n = 0;
    for (const arr of Object.values(raw)) {
      if (Array.isArray(arr)) n += arr.length;
    }
    return n;
  } catch {
    return 0;
  }
}

function getOurCategory(iptvCategories, existingCategories) {
  if (!Array.isArray(iptvCategories) || iptvCategories.length === 0) return 'Entertainment';
  for (const c of iptvCategories) {
    const mapped = CATEGORY_MAP[(c || '').toLowerCase()];
    if (mapped && existingCategories.has(mapped)) return mapped;
  }
  for (const c of iptvCategories) {
    const mapped = CATEGORY_MAP[(c || '').toLowerCase()];
    if (mapped) return mapped;
  }
  return existingCategories.has('Entertainment') ? 'Entertainment' : Array.from(existingCategories)[0] || 'Entertainment';
}

function collectExistingNames(data) {
  const set = new Set();
  for (const entries of Object.values(data)) {
    if (!Array.isArray(entries)) continue;
    for (const ch of entries) {
      if (ch && typeof ch.name === 'string') set.add(ch.name.trim());
    }
  }
  return set;
}

function collectExistingCategories(data) {
  const set = new Set();
  for (const key of Object.keys(data)) {
    if (Array.isArray(data[key])) set.add(key);
  }
  return set;
}

/** Compact entry: omit null/empty fields per channels/README. */
function toCompactChannel(ch) {
  const name = (ch.name || '').trim();
  if (!name) return null;
  const isFree = ch.is_nsfw === false ? true : null;
  const logo = ch.logo && typeof ch.logo === 'string' ? ch.logo.trim() : null;
  const website = ch.website && typeof ch.website === 'string' ? ch.website.trim() : null;
  const out = { name };
  if (isFree !== null) out.isFree = isFree;
  if (logo) out.logo = logo;
  if (website) out.website = website;
  return out;
}

async function fetchChannels() {
  const res = await fetch(CHANNELS_URL);
  if (!res.ok) throw new Error(`iptv-org fetch failed: ${res.status}`);
  return res.json();
}

function groupByCountry(channels) {
  const byCountry = {};
  for (const ch of channels) {
    const code = (ch.country || '').toUpperCase();
    if (!code || code.length !== 2) continue;
    if (!byCountry[code]) byCountry[code] = [];
    byCountry[code].push(ch);
  }
  return byCountry;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const countries = JSON.parse(readFileSync(join(CHANNELS_DIR, 'countries.json'), 'utf8'));
  const targetRatio = 0.95;
  const toEnrich = [];
  for (const code of countries) {
    const ref = wikiStations[code];
    if (ref == null) continue;
    const count = countChannels(code);
    const target = Math.ceil(ref * targetRatio);
    if (count < target) toEnrich.push({ code, count, ref, target, need: target - count });
  }
  toEnrich.sort((a, b) => b.need - a.need);
  if (toEnrich.length === 0) {
    console.log('All countries with a Wikipedia reference are already at or above 95% coverage.');
    return;
  }
  console.log(`Countries below 95% of ref (${toEnrich.length}):`);
  toEnrich.forEach(({ code, count, ref, target, need }) => {
    console.log(`  ${code}: ${count} / ${ref} (target ${target}, need +${need})`);
  });

  console.log('\nFetching iptv-org/api channels.json...');
  const channels = await fetchChannels();
  const byCountry = groupByCountry(channels);
  console.log(`Loaded ${channels.length} channels, ${Object.keys(byCountry).length} countries in API.`);

  let totalAdded = 0;
  for (const { code, need } of toEnrich) {
    const upper = code.toUpperCase();
    let apiChannels = byCountry[upper] || [];
    if (upper === 'GB' && !apiChannels.length && byCountry['UK']) {
      apiChannels = byCountry['UK'];
    }
    if (!apiChannels.length) continue;

    const filePath = join(CHANNELS_DIR, `${code}.json`);
    const data = JSON.parse(readFileSync(filePath, 'utf8'));
    const existingNames = collectExistingNames(data);
    const existingCategories = collectExistingCategories(data);
    let added = 0;

    for (const ch of apiChannels) {
      if (added >= need) break;
      const name = (ch.name || '').trim();
      if (!name || existingNames.has(name)) continue;

      const compact = toCompactChannel(ch);
      if (!compact) continue;

      const category = getOurCategory(ch.categories, existingCategories);
      if (!data[category]) data[category] = [];
      data[category].push(compact);
      existingNames.add(name);
      added++;
    }

    if (added > 0) {
      if (!dryRun) {
        writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      }
      totalAdded += added;
      console.log(`${code}.json: +${added} channels${dryRun ? ' (dry-run)' : ''}`);
    }
  }

  console.log(`\nDone. ${totalAdded} new channels ${dryRun ? 'would be ' : ''}added.`);
  if (dryRun && totalAdded > 0) {
    console.log('Run without --dry-run to apply changes.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
