/**
 * Count channels per country and output table data for coverage-and-sources.md.
 * Run from repo root: node scripts/count-channels.js
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const channelsDir = join(__dirname, '..', 'channels');

// ISO 3166-1 alpha-2 → country name (for our codes only)
const countryNames = {
  ad: 'Andorra', ae: 'United Arab Emirates', af: 'Afghanistan', ag: 'Antigua and Barbuda',
  al: 'Albania', am: 'Armenia', ao: 'Angola', ar: 'Argentina', at: 'Austria', au: 'Australia',
  aw: 'Aruba', az: 'Azerbaijan', ba: 'Bosnia and Herzegovina', bb: 'Barbados', bd: 'Bangladesh',
  be: 'Belgium', bf: 'Burkina Faso', bg: 'Bulgaria', bh: 'Bahrain', bj: 'Benin', bo: 'Bolivia',
  bq: 'Caribbean Netherlands', br: 'Brazil', bs: 'Bahamas', by: 'Belarus', ca: 'Canada',
  cd: 'DR Congo', cg: 'Republic of the Congo', ch: 'Switzerland', ci: 'Ivory Coast',
  cl: 'Chile', cm: 'Cameroon', cn: 'China', co: 'Colombia', cr: 'Costa Rica', cu: 'Cuba',
  cw: 'Curaçao', cy: 'Cyprus', cz: 'Czech Republic', de: 'Germany', dk: 'Denmark',
  do: 'Dominican Republic', dz: 'Algeria', ec: 'Ecuador', ee: 'Estonia', eg: 'Egypt',
  es: 'Spain', et: 'Ethiopia', fi: 'Finland', fj: 'Fiji', fo: 'Faroe Islands', fr: 'France',
  gb: 'United Kingdom', ge: 'Georgia', gh: 'Ghana', gl: 'Greenland', gm: 'Gambia', gn: 'Guinea',
  gp: 'Guadeloupe', gq: 'Equatorial Guinea', gr: 'Greece', gt: 'Guatemala', hk: 'Hong Kong',
  hn: 'Honduras', hr: 'Croatia', ht: 'Haiti', hu: 'Hungary', id: 'Indonesia', ie: 'Ireland',
  il: 'Israel', in: 'India', iq: 'Iraq', ir: 'Iran', is: 'Iceland', it: 'Italy', jm: 'Jamaica',
  jo: 'Jordan', jp: 'Japan', ke: 'Kenya', kg: 'Kyrgyzstan', kh: 'Cambodia', kp: 'North Korea',
  kr: 'South Korea', kw: 'Kuwait', kz: 'Kazakhstan', la: 'Laos', lb: 'Lebanon', li: 'Liechtenstein',
  lk: 'Sri Lanka', lt: 'Lithuania', lu: 'Luxembourg', lv: 'Latvia', ly: 'Libya', ma: 'Morocco',
  mc: 'Monaco', md: 'Moldova', me: 'Montenegro', mk: 'North Macedonia', ml: 'Mali', mo: 'Macau',
  mq: 'Martinique', mt: 'Malta', mv: 'Maldives', mx: 'Mexico', my: 'Malaysia', mz: 'Mozambique',
  ne: 'Niger', ng: 'Nigeria', ni: 'Nicaragua', nl: 'Netherlands', no: 'Norway', np: 'Nepal',
  nz: 'New Zealand', om: 'Oman', pa: 'Panama', pe: 'Peru', pf: 'French Polynesia', ph: 'Philippines',
  pk: 'Pakistan', pl: 'Poland', pr: 'Puerto Rico', ps: 'Palestine', pt: 'Portugal', py: 'Paraguay',
  qa: 'Qatar', ro: 'Romania', rs: 'Serbia', ru: 'Russia', rw: 'Rwanda', sa: 'Saudi Arabia',
  sd: 'Sudan', se: 'Sweden', sg: 'Singapore', si: 'Slovenia', sk: 'Slovakia', sl: 'Sierra Leone',
  sm: 'San Marino', sn: 'Senegal', so: 'Somalia', sv: 'El Salvador', sy: 'Syria', th: 'Thailand',
  tj: 'Tajikistan', tm: 'Turkmenistan', tn: 'Tunisia', tr: 'Turkey', tt: 'Trinidad and Tobago',
  tw: 'Taiwan', tz: 'Tanzania', ua: 'Ukraine', ug: 'Uganda', us: 'United States', uy: 'Uruguay',
  uz: 'Uzbekistan', va: 'Vatican City', ve: 'Venezuela', vn: 'Vietnam', xk: 'Kosovo', ye: 'Yemen',
  yz: 'Special', za: 'South Africa', zm: 'Zambia'
};

// Wikipedia – List of countries by number of television broadcast stations (extracted)
const wikiStations = {
  ru: 6700, cn: 4900, us: 2761, in: 868, gb: 1822, ua: 647, tr: 635, fr: 584, ro: 575, za: 556,
  br: 384,
  de: 489, it: 458, es: 1780, ph: 350, mx: 236, jp: 291, se: 252, dk: 172, cz: 150, ca: 278,
  fi: 140, pk: 127, sa: 117, bd: 115, ch: 115, th: 137, pe: 105, au: 253, eg: 98, my: 262,
  sk: 130, rs: 400, tw: 86, vn: 145, af: 85, no: 144, ir: 78, ve: 66, al: 144, cl: 63, uy: 62,
  pt: 62, co: 60, cu: 58, kr: 87, hk: 55, id: 146, mk: 52, np: 50, am: 48, bo: 48, by: 96,
  dz: 46, sy: 44, lv: 44, ar: 92, nz: 41, pl: 200, md: 40, bg: 86, pa: 38, gr: 150, hr: 205,
  ma: 35, hu: 390, ba: 152, pr: 32, si: 73, ps: 31, uz: 28, lt: 61, tn: 26, gt: 26, do: 25,
  be: 89, jo: 22, nl: 394, iq: 21, cr: 20, az: 47, il: 17, ae: 35, lb: 15, lk: 34, is: 51,
  ci: 14, om: 13, me: 17, kw: 13, ly: 12, kz: 32, ge: 98, hn: 11, cy: 30, ee: 56, at: 54,
  zm: 9, kh: 9, ug: 8, kg: 8, ke: 75, la: 7, jm: 7, gh: 7, pf: 7, ec: 68, tt: 6, tj: 6, gn: 6,
  bj: 6, ao: 6, ng: 5, mc: 21, mt: 12, lu: 80, sv: 5, tm: 4, so: 4, sn: 4, kp: 4, fj: 4, cd: 4,
  ie: 75, py: 46, et: 92, fo: 3, bf: 3, sl: 2, rw: 2, er: 2, ag: 2, va: 1, ye: 3, tz: 3, sd: 3,
  ni: 3, bs: 2, ht: 2, bb: 1, li: 1, bq: 3, np: 50, ad: 1, qa: 15, lr: 4, ga: 4
};

function countChannels(code) {
  try {
    const raw = JSON.parse(readFileSync(join(channelsDir, `${code}.json`), 'utf8'));
    let n = 0;
    for (const arr of Object.values(raw)) {
      if (Array.isArray(arr)) n += arr.length;
    }
    return n;
  } catch (e) {
    return 0;
  }
}

function gapLabel(ours, ref) {
  if (ref == null) return '—';
  if (ours >= ref) return 'We have more';
  const r = ref > 0 ? ours / ref : 0;
  if (r >= 0.9) return 'Aligned';
  if (r >= 0.5) return 'Moderate';
  if (r >= 0.2) return 'Large';
  return 'Very large';
}

const countries = JSON.parse(readFileSync(join(channelsDir, 'countries.json'), 'utf8'));
const rows = [];

for (const code of countries) {
  const channels = countChannels(code);
  const ref = wikiStations[code] ?? null;
  const country = countryNames[code] ?? code;
  const gap = gapLabel(channels, ref);
  const refStr = ref != null ? ref.toLocaleString('en-US') : '—';
  rows.push({ code, channels, refStr, country, gap, ref });
}

// Sort by Wikipedia ref descending (so gaps show first), then by our count, then by code
rows.sort((a, b) => (b.ref ?? 0) - (a.ref ?? 0) || b.channels - a.channels || a.code.localeCompare(b.code));

const markdown = process.argv.includes('--markdown');
if (markdown) {
  console.log('| Code | Channels | ~Stations (ref.) | Country | Gap |');
  console.log('|------|----------|------------------|---------|-----|');
  for (const r of rows) {
    console.log(`| ${r.code} | ${r.channels.toLocaleString('en-US')} | ${r.refStr} | ${r.country} | ${r.gap} |`);
  }
} else {
  console.log(JSON.stringify(rows, null, 2));
}
