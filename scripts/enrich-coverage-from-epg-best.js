/**
 * Enriches channels/*.json for countries where our channel count is below 95% of
 * Wikipedia reference. Fetches epg.best/api/channels and adds missing channels
 * by display_name. Run: node scripts/enrich-coverage-from-epg-best.js
 * Optional: --dry-run
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CHANNELS_DIR = join(ROOT, 'channels');
const EPG_CHANNELS_URL = 'https://epg.best/api/channels';

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

async function fetchAllChannels() {
  const all = [];
  let page = 1;
  const perPage = 500;
  while (true) {
    const url = `${EPG_CHANNELS_URL}?per_page=${perPage}&page=${page}`;
    const res = await fetch(url);
    if (res.status === 429) {
      console.warn('epg.best rate limit (429). Skip or run later.');
      break;
    }
    if (!res.ok) throw new Error(`epg.best HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    all.push(...data);
    if (data.length < perPage) break;
    page++;
  }
  return all;
}

function groupByCountry(channels) {
  const by = {};
  for (const ch of channels) {
    const code = (ch.country || '').toLowerCase().trim();
    if (!code || code.length > 3) continue;
    if (!by[code]) by[code] = [];
    const name = (ch.display_name || '').trim();
    if (name) by[code].push({ name });
  }
  return by;
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

function getFirstCategory(data) {
  const keys = Object.keys(data).filter((k) => Array.isArray(data[k]));
  return keys[0] || 'Entertainment';
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
    console.log('All countries with ref are at or above 95%.');
    return;
  }
  console.log(`Countries below 95% (${toEnrich.length}). Fetching epg.best/api/channels...`);
  const channels = await fetchAllChannels();
  const byCountry = groupByCountry(channels);
  console.log(`Loaded ${channels.length} channels, ${Object.keys(byCountry).length} country codes.`);

  let totalAdded = 0;
  for (const { code, need } of toEnrich) {
    const apiChannels = byCountry[code.toLowerCase()] || [];
    if (!apiChannels.length) continue;

    const filePath = join(CHANNELS_DIR, `${code}.json`);
    const data = JSON.parse(readFileSync(filePath, 'utf8'));
    const existingNames = collectExistingNames(data);
    const category = getFirstCategory(data);
    let added = 0;

    for (const ch of apiChannels) {
      if (added >= need) break;
      const name = ch.name.trim();
      if (!name || existingNames.has(name)) continue;
      if (!data[category]) data[category] = [];
      data[category].push({ name, isFree: true });
      existingNames.add(name);
      added++;
    }

    if (added > 0) {
      if (!dryRun) writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      totalAdded += added;
      console.log(`${code}.json: +${added}${dryRun ? ' (dry-run)' : ''}`);
    }
  }
  console.log(`\nDone. ${totalAdded} new channels ${dryRun ? 'would be ' : ''}added.`);
  if (dryRun && totalAdded > 0) console.log('Run without --dry-run to apply.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
