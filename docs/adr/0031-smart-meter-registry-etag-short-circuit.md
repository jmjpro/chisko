# Smart Meter Registry refresh trusts source ETag to skip processing

The IEC CSV source returns an `ETag` header. On each weekly cron run, `doRefresh` issues a `HEAD` request and compares the ETag against the value stored in `smartMeterRegistryMeta`. If they match, the action exits immediately — no download, no paginated key-load, no mutations. Only when the ETag changes (or is absent) does the full diff-and-insert run.

This was chosen over always running the full diff because on the Convex free plan, loading the existing-key set for ~430k address rows (105+ paginated queries) consumed most of the 600s action budget every week just to confirm nothing had changed. Trusting the ETag makes the common case (source unchanged) cost a single HTTP HEAD and one metadata read.

The risk is that a CDN misconfiguration on the IEC side could serve a stale ETag and cause us to miss a real update. We accept this: the Smart Meter Registry is append-only and a missed weekly update means a one-week delay in new address coverage, not data corruption. If ETags ever stop being reliable, revert to always processing — `lastCheckedAt` vs `lastRefreshedAt` diverging in the metadata is the diagnostic signal.
