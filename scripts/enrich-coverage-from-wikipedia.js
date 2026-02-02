/**
 * Enriches channels/*.json for countries where our channel count is below 95% of
 * Wikipedia reference. Fetches "List of television stations in [country]" from
 * Wikipedia API and adds missing channel names. Run: node scripts/enrich-coverage-from-wikipedia.js
 * Optional: --dry-run | --only=CODE
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CHANNELS_DIR = join(ROOT, 'channels');
const WIKI_API = 'https://en.wikipedia.org/w/api.php';

const DELAY_BASE_MS = 1500;
const DELAY_INCREMENT_MS = 500;
const DELAY_MAX_MS = 4000;

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

const TITLE_OVERRIDES = {
  gb: 'List of television stations in the United Kingdom', ba: 'List of television stations in Bosnia and Herzegovina',
  bs: 'List of television stations in the Bahamas', do: 'List of television stations in the Dominican Republic',
  hk: 'List of television stations in Hong Kong', mo: 'List of television stations in Macau',
  ph: 'List of television stations in the Philippines', us: 'List of television stations in the United States'
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

function getCountryName(code) {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) || code;
  } catch {
    return code;
  }
}

function getWikipediaTitle(code) {
  const c = code.toLowerCase();
  if (TITLE_OVERRIDES[c]) return TITLE_OVERRIDES[c];
  return `List of television stations in ${getCountryName(code)}`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWikitext(title) {
  const params = new URLSearchParams({
    action: 'query', titles: title, prop: 'revisions', rvprop: 'content',
    rvslots: 'main', format: 'json', origin: '*', redirects: '1'
  });
  const res = await fetch(`${WIKI_API}?${params}`);
  if (!res.ok) throw new Error(`Wikipedia API HTTP ${res.status}`);
  const data = await res.json();
  const pages = data?.query?.pages ?? {};
  const page = Object.values(pages)[0];
  if (!page || page.missing !== undefined) return null;
  let content = page.revisions?.[0]?.slots?.main?.['*'] ?? null;
  if (content && /^\s*#REDIRECT\s*\[\[([^\]]+)\]\]/i.test(content)) {
    const target = content.replace(/^\s*#REDIRECT\s*\[\[([^\]]+)\]\]/i, (_, link) => link.split('|')[0].trim());
    if (target && target !== title) return fetchWikitext(target);
  }
  return content;
}

function stripWikiMarkup(text) {
  if (!text || typeof text !== 'string') return '';
  let s = text.trim();
  s = s.replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, (_, link) => link.trim());
  s = s.replace(/\[\[([^\]]+)\]\]/g, (_, link) => link.trim());
  s = s.replace(/'''?/g, '').replace(/''/g, '').replace(/\{\{[^}]*\}\}/g, '').replace(/\{\{[^}]*\|([^}|]+)\}\}/g, '$1');
  s = s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  return s;
}

function extractChannelNames(wikitext) {
  const names = new Set();
  if (!wikitext) return names;
  const listItemRegex = /^\s*\*\s*\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/gm;
  let m;
  while ((m = listItemRegex.exec(wikitext)) !== null) {
    const name = stripWikiMarkup(m[1]);
    if (isValidChannelName(name)) names.add(name);
  }
  const tableRowRegex = /\|\-\s*\n\s*\|[^|]*\|\s*([^|\n]+)/g;
  while ((m = tableRowRegex.exec(wikitext)) !== null) {
    const cell = stripWikiMarkup(m[1]);
    if (isValidChannelName(cell)) names.add(cell);
  }
  const plainListRegex = /^\s*\*\s+([^[\n–—]+?)(?:\s*[–—]|\s*$)/gm;
  while ((m = plainListRegex.exec(wikitext)) !== null) {
    const name = stripWikiMarkup(m[1]);
    if (isValidChannelName(name)) names.add(name);
  }
  return names;
}

function isValidChannelName(name) {
  if (!name || name.length < 2 || name.length > 120) return false;
  const lower = name.toLowerCase();
  const skip = ['n/a', 'na', 'none', 'tbd', 'see also', 'references', 'external links', 'call sign', 'television station', 'city of license', 'owner', 'website', 'vhf', 'uhf', 'erp', 'transmitter', 'coordinates', 'category', 'reflist', 'citation needed', 'datem', 'url', 'coord', 'cite web', 'cite', 'ref', 'list of', 'television stations in', 'television in'];
  if (skip.some((s) => lower === s || lower.startsWith(s + ' ') || lower.includes(' ' + s))) return false;
  if (/^\d+$/.test(name) || /^[\d\s\-–—]+$/.test(name)) return false;
  return true;
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
  const onlyCode = process.argv.find((a) => a.startsWith('--only='))?.slice(7)?.toLowerCase() ?? null;

  const countries = JSON.parse(readFileSync(join(CHANNELS_DIR, 'countries.json'), 'utf8'));
  const targetRatio = 0.95;
  const toEnrich = [];
  for (const code of countries) {
    if (onlyCode && code.toLowerCase() !== onlyCode) continue;
    const ref = wikiStations[code];
    if (ref == null) continue;
    const count = countChannels(code);
    if (count < Math.ceil(ref * targetRatio)) toEnrich.push({ code, count, ref, need: Math.ceil(ref * targetRatio) - count });
  }
  toEnrich.sort((a, b) => b.need - a.need);
  if (toEnrich.length === 0) {
    console.log('No countries below 95% (or filter --only=CODE has no match).');
    return;
  }
  console.log(`Countries below 95% to enrich from Wikipedia (${toEnrich.length}):`);
  toEnrich.forEach(({ code, count, ref, need }) => console.log(`  ${code}: ${count} / ${ref} (need +${need})`));

  let totalAdded = 0;
  let failed = 0;
  for (let i = 0; i < toEnrich.length; i++) {
    const { code, need } = toEnrich[i];
    if (i > 0) {
      const delay = Math.min(DELAY_BASE_MS + i * DELAY_INCREMENT_MS, DELAY_MAX_MS);
      await sleep(delay);
    }
    const title = getWikipediaTitle(code);
    let wikitext;
    try {
      wikitext = await fetchWikitext(title);
    } catch (err) {
      console.warn(`[${code}] Fetch failed: ${err.message}`);
      failed++;
      continue;
    }
    if (!wikitext) continue;

    const extracted = extractChannelNames(wikitext);
    if (extracted.size === 0) continue;

    const filePath = join(CHANNELS_DIR, `${code}.json`);
    const data = JSON.parse(readFileSync(filePath, 'utf8'));
    const existingNames = collectExistingNames(data);
    const category = getFirstCategory(data);

    let added = 0;
    for (const name of extracted) {
      if (added >= need) break;
      if (existingNames.has(name)) continue;
      if (!data[category]) data[category] = [];
      data[category].push({ name: name.trim(), isFree: true });
      existingNames.add(name);
      added++;
    }

    if (added > 0) {
      if (!dryRun) writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      totalAdded += added;
      console.log(`${code}.json: +${added} (Wikipedia: ${title})${dryRun ? ' (dry-run)' : ''}`);
    }
  }

  console.log(`\nDone. ${totalAdded} new channels ${dryRun ? 'would be ' : ''}added. Failed: ${failed}`);
  if (dryRun && totalAdded > 0) console.log('Run without --dry-run to apply.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
