# Affiliates Discovery Flow

Discover networks and their affiliates in each country, then apply `retransmits` to channels for accurate parent→affiliate relationships.

> **Note:** This flow uses maintenance scripts in `scripts/` (not shipped in the npm package). Output goes to `reports/`, which is gitignored—local only.

## Overview

Few broadcasters have enough reach to have affiliates. This flow helps:

1. **Discover** which networks have affiliates (from existing `retransmits`)
2. **Infer** channels that likely retransmit a parent but lack the field
3. **Apply** suggested retransmits to the JSON files

## Steps

### 1. Discover

```bash
node scripts/discover-affiliates.js
```

- Reads all `channels/*.json`
- Builds parent→affiliates from existing `retransmits`
- Infers name patterns (e.g. "Band Amazonas", "Band Bahia" → prefix "Band ")
- Suggests channels missing `retransmits` that match those patterns
- Excludes likely sister channels (News, Sports, Kids, etc.)
- Writes `reports/affiliates-discovery.json` (local; `reports/` is gitignored)

```bash
node scripts/discover-affiliates.js --summary
```

Prints networks per country and top suggestions.

### 2. Review

Inspect the local report `reports/affiliates-discovery.json`:

- `byCountry.{cc}.networks` — confirmed parent → [affiliates]
- `byCountry.{cc}.suggested` — channels possibly missing retransmits
- `suggestions` — flat list for apply

Remove false positives from the report before applying, or skip apply for countries with uncertain data.

### 3. Apply

```bash
node scripts/apply-retransmits.js --dry-run
```

Shows what would be changed.

```bash
node scripts/apply-retransmits.js
```

Updates `channels/*.json` with the suggested `retransmits` values.

### 4. Compact (optional)

```bash
node scripts/compact-channels.js
```

Omits default values to keep JSON files compact.

## Data rules

- **retransmits**: Use only for affiliates that rebroadcast the main network
- **Do not use** for sister/co-channels (e.g. Band News does not retransmit Band)
- Parent name in `retransmits` must match the canonical network name used in the data
