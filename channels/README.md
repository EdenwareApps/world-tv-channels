# Channel data (schema)

**Files:** `channels/*.json`. See [docs/affiliates-flow.md](../docs/affiliates-flow.md) for the affiliates discovery flow. Channel objects use a **compact format** — omit defaults to save space. The lib normalizes when parsing. Omit: `keywords` when identical to name (no accents, no excludes); `retransmits`, `logo`, `website` when null; `shortName` when equal to name; `priority` when 5 (default).

| Field        | Type    | Description |
|-------------|---------|-------------|
| `name`      | string  | Display name (required). |
| `keywords`  | string  | Search terms for IPTV M3U lookup. **Never accented** (normalized to ASCII, e.g. "canção" → "cancao"). When not set, derived from channel name (lowercased). If another channel in the same file has name = this name + " " + suffix (e.g. "Esporte Interativo 2"), an exclude is added so the base does not match the variant: `esporte interativo -2` vs `esporte interativo 2`. Exclude tokens start with `-`; `\|` = OR. |
| `retransmits` | string \| null | **Affiliate only:** station that rebroadcasts the main network's programming (e.g. TV Globo Minas retransmits Rede Globo). Do **not** use for sister/co-channels (e.g. ABC Kids does not retransmit ABC; Band News does not retransmit Band). |
| `shortName` | string \| null | Short name or acronym (e.g. `"RBS"`). |
| `isFree`    | boolean \| null | Whether the channel is free-to-air. |
| `logo`      | string \| null | URL to channel logo. |
| `website`   | string \| null | Official website URL. |
| `priority`  | number \| null | 0–10, relative to same country+category. 0=no audience, 5=medium (default, omit), 10=high. Used for sorting in search/generate. |

Example (all fields):

```json
{
  "name": "RBS",
  "keywords": "rede globo sul | rbs -news -minas",
  "retransmits": "Rede Globo",
  "shortName": "RBS",
  "isFree": true,
  "logo": "https://...",
  "website": "https://g1.com"
}
```
