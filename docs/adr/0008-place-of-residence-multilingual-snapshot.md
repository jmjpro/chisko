# Place of Residence is stored as a multilingual snapshot on the Home Profile

The `placeOfResidence` field on `homeProfiles` stores a multilingual object — `{ he, en?, ar?, ru? }` — captured at selection time, rather than a string or a foreign key into the `israelPlaces` table.

We considered three alternatives:

1. **Hebrew string only** — simple, but forces Hebrew display in the wizard review for all languages.
2. **Foreign key into `israelPlaces`** — always up-to-date, but couples every Home Profile display to a live cache table. If a record is replaced during a weekly refresh, historical Home Profiles would break at render time.
3. **Multilingual snapshot (chosen)** — self-contained for display in any language, no dependency on the `israelPlaces` cache at render time. Consistent with how Recommendations snapshot Plan Version data.

The `israelPlaces` table is a refreshable cache, not a source of truth for historical records. Snapshots are the right pattern when the source is mutable.

For Home Profiles collected via the Smart Meter Registry cascade (where the IEC data source is Hebrew-only), the cascade cross-references the `israelPlaces` table at selection time to populate all available language fields. If no match is found, only `{ he: cityName }` is stored.

English names from the government source are ALL CAPS; display components apply `text-transform: capitalize` via CSS rather than transforming stored data.
