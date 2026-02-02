#!/usr/bin/env node
/**
 * Apply retransmits suggestions from reports/affiliates-discovery.json to channels/*.json.
 * Usage: node scripts/apply-retransmits.js [--dry-run]
 * Run scripts/discover-affiliates.js first.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const channelsDir = join(__dirname, '..', 'channels');
const reportPath = join(__dirname, '..', 'reports', 'affiliates-discovery.json');
const dryRun = process.argv.includes('--dry-run');

function applyRetransmits() {
  if (!existsSync(reportPath)) {
    console.error('Run scripts/discover-affiliates.js first to generate reports/affiliates-discovery.json');
    process.exit(1);
  }

  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  const suggestions = report.suggestions || [];
  if (suggestions.length === 0) {
    console.log('No suggestions to apply.');
    return;
  }

  const byCountry = {};
  for (const s of suggestions) {
    if (!byCountry[s.country]) byCountry[s.country] = [];
    byCountry[s.country].push(s);
  }

  let applied = 0;
  for (const [country, list] of Object.entries(byCountry)) {
    const filePath = join(channelsDir, `${country}.json`);
    if (!existsSync(filePath)) continue;

    const data = JSON.parse(readFileSync(filePath, 'utf8'));
    const toApply = new Map(list.map((s) => [s.channel, s.retransmits]));

    for (const [category, channels] of Object.entries(data)) {
      if (!Array.isArray(channels)) continue;
      for (const ch of channels) {
        if (toApply.has(ch.name) && (ch.retransmits == null || ch.retransmits === '')) {
          ch.retransmits = toApply.get(ch.name);
          applied++;
        }
      }
    }

    if (!dryRun && list.length > 0) {
      writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
      console.log(`Updated ${country}.json (${list.length} retransmits)`);
    }
  }

  if (dryRun) {
    console.log(`[dry-run] Would apply ${applied} retransmits across ${Object.keys(byCountry).length} countries`);
    for (const [country, list] of Object.entries(byCountry)) {
      console.log(`  ${country}: ${list.map((s) => `${s.channel} → ${s.retransmits}`).join(', ').slice(0, 80)}...`);
    }
  } else {
    console.log(`Applied ${applied} retransmits.`);
  }
}

applyRetransmits();
