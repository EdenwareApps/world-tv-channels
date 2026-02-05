# TV Channels by Country 🌍

[![npm version](https://img.shields.io/npm/v/@edenware/tv-channels-by-country.svg)](https://www.npmjs.com/package/@edenware/tv-channels-by-country)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)

A **community-maintained** JSON list of TV station names and categories from around the world — free to use in any project that needs structured channel data.

Whether you're building an IPTV app, a channel lookup tool, or anything else, you're welcome here.

## Table of contents

- [Install](#install)
- [Usage](#usage)
- [API](#api)
- [Data format](#data-format-channels)
- [Contributing](#contributing)
- [License](#license)

---

## Install

```bash
npm install @edenware/tv-channels-by-country
```

---

## Usage

```js
// ESM
import { getChannels, listCountries, search, generate } from '@edenware/tv-channels-by-country';

// CJS
const { getChannels, listCountries, search, generate } = require('@edenware/tv-channels-by-country');

// Channels by country (loads only the requested country, cached)
const br = await getChannels('br');
// { "Religious": [{ name, keywords, ... }], "News": [...], ... }

// List all available country codes
const countries = await listCountries();

// Search by keywords
const matches = await search('globo', { countries: ['br'], limit: 18 });
// [{ name, keywords, country, category, ... }, ...]

// Generate a list from multiple countries by priority
const list = await generate({ countries: ['br', 'us'], limit: 256, minPerCategory: 18 });
// [{ name, keywords, country, category, ... }, ...]
```

**TypeScript:** types are included. **Dual format:** ESM and CommonJS. Direct JSON: `import br from '@edenware/tv-channels-by-country/channels/br.json'` (with bundler).

---

## API

### `getChannels(countryCode)`

Returns channels grouped by category for a country. Uses ISO 3166-1 alpha-2 (e.g. `'br'`, `'us'`). Case-insensitive. Returns `null` if country not found.

### `listCountries()`

Returns a sorted array of available country codes.

### `search(keywords, options?)`

Searches channels by keywords across countries and categories.

| Option        | Type     | Default | Description                          |
|---------------|----------|---------|--------------------------------------|
| `countries`   | string[] | all     | Filter by country codes              |
| `categories`  | string[] | all     | Filter by category names             |
| `retransmits` | string   | `'all'` | `'parents'` \| `'affiliates'` \| `'all'` |
| `limit`       | number   | 100     | Max results                          |

### `generate(options)`

Builds a list of channels from multiple countries, sorted by priority, with balanced categories.

| Option             | Type     | Default | Description                                         |
|--------------------|----------|---------|-----------------------------------------------------|
| `countries`        | string[] | required| Country codes to merge                              |
| `categories`       | string[] | all     | Filter by category                                  |
| `retransmits`      | string   | `'all'` | `'parents'` \| `'affiliates'` \| `'all'`            |
| `limit`            | number   | 256     | Max results                                         |
| `minPerCategory`   | number   | 18      | Target channels per category                        |
| `mainCountryFull`  | boolean  | false   | If true, include ALL channels from first country    |
| `freeOnly`         | boolean  | false   | If true, includes only free-to-air channels (`isFree: true`) |

---

## Data format (channels/)

Files: `channels/{country}.json`. Each file maps category name → array of channel objects.

| Field          | Type            | Description |
|----------------|-----------------|-------------|
| `name`         | string          | Display name (required) |
| `keywords`     | string          | Search terms for M3U lookup. Use `-x` for excludes; `\|` for OR. |
| `retransmits`  | string \| null  | Affiliate: parent network rebroadcast |
| `shortName`    | string \| null  | Acronym or short name |
| `isFree`       | boolean         | Free-to-air |
| `logo`         | string \| null  | Logo URL |
| `website`      | string \| null  | Official site |
| `priority`     | number          | 0–10, relative to country+category. Default 5. |

**Compact format:** Omit `keywords` when derived from name, `logo`/`website`/`retransmits` when null, `priority` when 5.

See [channels/README.md](channels/README.md) for full schema.

---

## Contributing

Contributions are welcome.

- Fix typos
- Add missing channels for your country
- Improve keywords for better matching
- Open issues for suggestions or bugs

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

[MIT](LICENSE) © Efox
