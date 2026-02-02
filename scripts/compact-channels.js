#!/usr/bin/env node
/**
 * Compact channels/*.json by omitting default values.
 * Omitted fields are normalized by the lib when parsing.
 * Omit: keywords identical to name (no accents, no excludes), retransmits/logo/website when null, shortName when equal to name, priority when 5 (default).
 * Usage: node scripts/compact-channels.js
 */
import { readFileSync, writeFileSync } from 'fs';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const channelsDir = join(__dirname, '..', 'channels');

function normalizeKeyword(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function hasExcludes(keywords) {
  return /\s-\S/.test(keywords) || /^-/.test(keywords);
}

function keywordsIdenticalToName(keywords, name) {
  if (!keywords || typeof keywords !== 'string') return false;
  const parts = keywords.split('|').map((p) => normalizeKeyword(p.trim()));
  return parts.length === 1 && parts[0] === normalizeKeyword(name) && !hasExcludes(keywords);
}

function shouldOmitKeywords(ch) {
  if (ch.keywords == null || ch.keywords === '') return true;
  return keywordsIdenticalToName(ch.keywords, ch.name);
}

const DEFAULT_PRIORITY = 5;

function compactChannel(ch) {
  const out = { name: ch.name, isFree: ch.isFree };

  if (!shouldOmitKeywords(ch)) out.keywords = ch.keywords;
  if (ch.retransmits != null) out.retransmits = ch.retransmits;
  if (ch.shortName != null && ch.shortName !== ch.name) out.shortName = ch.shortName;
  if (ch.logo != null) out.logo = ch.logo;
  if (ch.website != null) out.website = ch.website;
  if (ch.priority != null && ch.priority !== DEFAULT_PRIORITY) out.priority = ch.priority;

  return out;
}

function compactFile(filePath) {
  const data = JSON.parse(readFileSync(filePath, 'utf8'));
  const out = {};
  for (const [cat, channels] of Object.entries(data)) {
    out[cat] = channels.map(compactChannel);
  }
  writeFileSync(filePath, JSON.stringify(out, null, 2) + '\n', 'utf8');
}

const files = readdirSync(channelsDir).filter((f) => f.endsWith('.json') && f !== 'countries.json');
for (const f of files) {
  compactFile(join(channelsDir, f));
  console.log('Compacted:', f);
}
console.log('Done:', files.length, 'files');
