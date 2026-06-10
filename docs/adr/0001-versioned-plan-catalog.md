# Versioned Plan Catalog for Recommendation Reproducibility

Supplier plan rules change frequently in Israel's open electricity market. We need to reproduce why a Recommendation was made on a specific date — both for user transparency and for auditing referral payouts. Rather than snapshotting full plan rules into each Recommendation, we maintain a versioned Plan catalog where each Plan Version has `effectiveFrom` and `effectiveTo` dates. Recommendations store references to the Plan Version IDs they evaluated. This keeps the Plan history independently queryable and avoids duplicating plan data across every Recommendation.

## Considered Options

- **Snapshot on write**: copy full plan rules into each Recommendation at creation time. Simpler to query a single document, but bloats storage and makes plan-level history harder to analyze.
- **Versioned catalog (chosen)**: Plan Versions are first-class records; Recommendations reference them by ID.
