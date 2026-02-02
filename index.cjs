'use strict';

var module$1 = require('module');
var path = require('path');

const _require = module$1.createRequire(__filename);
const cache = new Map();

function loadJson(relativePath) {
  const fullPath = path.join(__dirname, relativePath);
  return _require(fullPath);
}

function normalizeKeyword(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function deriveKeywords(name) {
  return normalizeKeyword(name).replace(/\s+/g, ' ');
}

const DEFAULT_PRIORITY = 5;

function normalizeChannel(ch) {
  return {
    name: ch.name,
    keywords: ch.keywords !== undefined ? ch.keywords : deriveKeywords(ch.name),
    retransmits: ch.retransmits ?? null,
    shortName: ch.shortName !== undefined ? ch.shortName : ch.name,
    isFree: ch.isFree ?? true,
    logo: ch.logo ?? null,
    website: ch.website ?? null,
    priority: ch.priority !== undefined ? ch.priority : DEFAULT_PRIORITY
  };
}

function sortByPriority(channels) {
  return [...channels].sort((a, b) => (b.priority ?? DEFAULT_PRIORITY) - (a.priority ?? DEFAULT_PRIORITY));
}

function passesRetransmitsFilter(ch, mode) {
  if (!mode || mode === 'all') return true;
  const hasRetransmits = ch.retransmits != null && String(ch.retransmits).trim() !== '';
  if (mode === 'parents') return !hasRetransmits;
  if (mode === 'affiliates') return hasRetransmits;
  return true;
}

function normalizeChannels(data) {
  const out = {};
  for (const [cat, channels] of Object.entries(data)) {
    out[cat] = channels.map(normalizeChannel);
  }
  return out;
}

async function getChannels(countryCode) {
  if (!countryCode || typeof countryCode !== 'string') return null;
  const code = countryCode.toLowerCase().trim();

  if (cache.has(code)) {
    return cache.get(code);
  }

  try {
    const raw = loadJson(`channels/${code}.json`);
    const data = normalizeChannels(raw);
    cache.set(code, data);
    return data;
  } catch (e) {
    if (e?.code === 'MODULE_NOT_FOUND' || e?.code === 'ERR_MODULE_NOT_FOUND') {
      return null;
    }
    throw e;
  }
}

async function listCountries() {
  return loadJson('channels/countries.json');
}

async function search(keywords, opts = {}) {
  const { countries: countriesOpt = null, categories: categoriesOpt = null, retransmits: retransmitsOpt = 'all', limit = 18 } = opts;
  const countries = countriesOpt ?? (await listCountries());
  const needle = normalizeKeyword(keywords);
  const results = [];

  for (const code of countries) {
    if (results.length >= limit) break;
    const data = await getChannels(code);
    if (!data) continue;

    for (const [cat, channels] of Object.entries(data)) {
      if (categoriesOpt != null && !categoriesOpt.includes(cat)) continue;
      const matching = channels.filter((ch) => {
        if (!passesRetransmitsFilter(ch, retransmitsOpt)) return false;
        const haystack = normalizeKeyword((ch.keywords ?? '') + ' ' + (ch.name ?? ''));
        return haystack.includes(needle);
      });
      const sorted = sortByPriority(matching);
      for (const ch of sorted) {
        if (results.length >= limit) break;
        results.push({ ...ch, country: code });
      }
    }
  }
  return sortByPriority(results).slice(0, limit);
}

async function generate(opts = {}) {
  const { countries = [], categories: categoriesOpt = null, retransmits: retransmitsOpt = 'all', mainCountryFull = false, limit = 256, minPerCategory = 18 } = opts;
  const byCategory = {};
  let total = 0;

  const countriesToProcess = [...countries];
  const mainCountry = mainCountryFull && countriesToProcess.length > 0 ? countriesToProcess[0] : null;
  const others = mainCountryFull && countriesToProcess.length > 1 ? countriesToProcess.slice(1) : countriesToProcess;

  if (mainCountry) {
    const data = await getChannels(mainCountry);
    if (data) {
      for (const [cat, channels] of Object.entries(data)) {
        if (categoriesOpt != null && !categoriesOpt.includes(cat)) continue;
        const filtered = channels.filter((ch) => passesRetransmitsFilter(ch, retransmitsOpt));
        const list = sortByPriority(filtered).map((ch) => ({ ...ch, country: mainCountry, category: cat }));
        byCategory[cat] = list;
        total += list.length;
      }
    }
  }

  for (const code of others) {
    if (total >= limit) break;
    const data = await getChannels(code);
    if (!data) continue;

    for (const [cat, channels] of Object.entries(data)) {
      if (categoriesOpt != null && !categoriesOpt.includes(cat)) continue;
      if (total >= limit) break;
      const current = byCategory[cat] ?? [];
      if (current.length >= minPerCategory) continue;

      const filtered = channels.filter((ch) => passesRetransmitsFilter(ch, retransmitsOpt));
      const needed = minPerCategory - current.length;
      const remaining = limit - total;
      const take = Math.min(needed, remaining, filtered.length);
      const sorted = sortByPriority(filtered);

      for (let i = 0; i < take; i++) {
        const ch = sorted[i];
        if (ch) current.push({ ...ch, country: code, category: cat });
      }
      byCategory[cat] = current;
      total += take;
    }
  }

  const out = [];
  for (const channels of Object.values(byCategory)) {
    out.push(...channels);
  }
  return out.slice(0, limit);
}

exports.generate = generate;
exports.getChannels = getChannels;
exports.listCountries = listCountries;
exports.search = search;
