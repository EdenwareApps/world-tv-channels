#!/usr/bin/env node
/**
 * Discover networks and their affiliates in each country.
 * 1. Reports existing parent→affiliates from retransmits
 * 2. Infers name patterns from known affiliates
 * 3. Suggests channels missing retransmits that match those patterns
 * Output: reports/affiliates-discovery.json
 * Usage: node scripts/discover-affiliates.js [--summary] [--dry-run]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const channelsDir = join(__dirname, '..', 'channels');
const reportsDir = join(__dirname, '..', 'reports');

const SKIP_FILES = new Set(['countries.json', 'README.md']);
const showSummary = process.argv.includes('--summary');

// Suffixes that typically indicate sister/co-channels, not affiliates (per README)
const SISTER_SUFFIXES = new Set(
  [
    'news', 'noticias', 'notícias', 'sports', 'kids', 'international', 'world', 'documentary', 'documentario',
    'movie', 'movies', 'series', 'music', 'info', 'weather', 'parliament', 'memória', 'memoria', 'africa',
    'europa', 'americas', 'arabic', 'persian', 'español', 'espanol', 'golazo', 'next', 'bs1', 'bsp', 'network',
    'hq', 'premium', 'two', 'bs', 'bs8k', 'bsp4k'
  ].map((s) => normalize(s))
);

function normalize(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Extract possible name prefixes from affiliate/parent name (for pattern matching). */
function extractPrefixes(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const prefixes = [];
  for (let i = 1; i <= parts.length; i++) {
    const p = parts.slice(0, i).join(' ') + ' ';
    if (p.length >= 4) prefixes.push(p);
  }
  return prefixes;
}

function discoverAffiliates() {
  const files = readdirSync(channelsDir, { withFileTypes: true })
    .filter((f) => f.isFile() && f.name.endsWith('.json') && !SKIP_FILES.has(f.name));

  const report = {
    byCountry: {},
    suggestions: [],
    summary: { countries: 0, parents: 0, knownAffiliates: 0, suggested: 0 }
  };

  for (const f of files) {
    const country = f.name.replace(/\.json$/, '');
    const filePath = join(channelsDir, f.name);
    const data = JSON.parse(readFileSync(filePath, 'utf8'));

    const parents = {};
    const allChannels = [];
    const prefixToParent = new Map();

    for (const [category, channels] of Object.entries(data)) {
      if (!Array.isArray(channels)) continue;
      for (const ch of channels) {
        const name = ch?.name;
        if (!name || typeof name !== 'string') continue;
        allChannels.push({ ...ch, category });

        const parent = ch?.retransmits;
        if (parent != null && String(parent).trim() !== '') {
          const p = String(parent).trim();
          if (!parents[p]) parents[p] = [];
          parents[p].push(name);

          // Build prefix→parent from known affiliates (only prefixes shared by 2+ affiliates to reduce false positives)
          for (const prefix of extractPrefixes(name)) {
            const n = normalize(prefix);
            if (n.length < 4) continue;
            const key = n;
            const existing = prefixToParent.get(key);
            if (!existing) {
              prefixToParent.set(key, { parent: p, count: 1 });
            } else if (existing.parent === p) {
              existing.count++;
            }
          }
          // Parent name + space (exact match)
          const parentNorm = normalize(p + ' ');
          if (parentNorm.length >= 4) {
            const ex = prefixToParent.get(parentNorm);
            if (!ex || ex.parent !== p) prefixToParent.set(parentNorm, { parent: p, count: 999 });
          }
        }
      }
    }

    const isLikelySister = (chName, parentName) => {
      const nName = normalize(chName);
      const nParent = normalize(parentName);
      const rest = nName.startsWith(nParent) ? nName.slice(nParent.length).trim() : nName;
      const words = rest.split(/\s+/).filter(Boolean);
      return words.some((w) => SISTER_SUFFIXES.has(w) || /^\d+$/.test(w));
    };

    const parentNames = new Set(Object.keys(parents).map((p) => normalize(p)));
    const suggested = [];
    const suggestedChannels = new Set();
    for (const ch of allChannels) {
      if (ch.retransmits != null && String(ch.retransmits).trim() !== '') continue;

      const name = ch.name;
      const nName = normalize(name);
      if (parentNames.has(nName)) continue;
      if ([...parentNames].some((p) => nName.replace(/\s/g, '') === p.replace(/\s/g, ''))) continue;
      if (/\(.*(channel|network|television|televisão)\).*$/i.test(name)) continue;
      let found = false;
      for (const prefix of extractPrefixes(name)) {
        const n = normalize(prefix);
        const match = prefixToParent.get(n);
        if (match && match.count >= 2 && !suggestedChannels.has(name)) {
          if (isLikelySister(name, match.parent)) continue;
          suggested.push({ country, category: ch.category, channel: name, retransmits: match.parent });
          suggestedChannels.add(name);
          found = true;
          break;
        }
      }
      if (found) continue;
      for (const p of Object.keys(parents)) {
        if (normalize(name).startsWith(normalize(p) + ' ') && name !== p && !suggestedChannels.has(name)) {
          if (isLikelySister(name, p)) continue;
          suggested.push({ country, category: ch.category, channel: name, retransmits: p });
          suggestedChannels.add(name);
          break;
        }
      }
    }

    const sortedParents = {};
    for (const [p, affs] of Object.entries(parents).sort((a, b) => b[1].length - a[1].length)) {
      sortedParents[p] = [...new Set(affs)].sort();
    }

    if (Object.keys(sortedParents).length > 0 || suggested.length > 0) {
      report.byCountry[country] = {
        networks: sortedParents,
        suggested
      };
      report.summary.countries++;
      report.summary.parents += Object.keys(sortedParents).length;
      report.summary.knownAffiliates += Object.values(sortedParents).reduce((a, arr) => a + arr.length, 0);
      report.summary.suggested += report.byCountry[country].suggested.length;
    }

    for (const s of suggested) {
      report.suggestions.push(s);
    }
  }

  report.suggestions = report.suggestions.filter(
    (s, i, arr) => arr.findIndex((x) => x.country === s.country && x.channel === s.channel) === i
  );

  if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true });
  const outPath = join(reportsDir, 'affiliates-discovery.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');

  console.log(`Networks: ${report.summary.parents} parents, ${report.summary.knownAffiliates} known affiliates`);
  console.log(`Suggestions: ${report.suggestions.length} channels possibly missing retransmits`);
  console.log(`Report: ${outPath}`);

  if (showSummary) {
    console.log('\n--- Networks by country ---');
    for (const [cc, data] of Object.entries(report.byCountry).sort()) {
      console.log(`\n${cc.toUpperCase()}:`);
      for (const [parent, affs] of Object.entries(data.networks)) {
        console.log(`  ${parent}: ${affs.length} affiliates`);
      }
      if (data.suggested?.length > 0) {
        console.log(`  Suggested (${data.suggested.length}):`);
        for (const s of data.suggested.slice(0, 5)) {
          console.log(`    - ${s.channel} → ${s.retransmits}`);
        }
        if (data.suggested.length > 5) console.log(`    ... and ${data.suggested.length - 5} more`);
      }
    }
  }

  return report;
}

discoverAffiliates();
