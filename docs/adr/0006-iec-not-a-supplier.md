# IEC is not modeled as a Supplier

IEC (Israel Electric Corporation) appears in the wizard's "current supplier" dropdown because the majority of users are still on IEC before switching to the open market. We do not add IEC to the `suppliers` table. Instead, selecting IEC sets `currentSupplierId` to `null` — the same value used for "don't know" — because both cases produce identical engine behavior: the full IEC Rate with no discount is used as the cost baseline.

We considered adding IEC as an inactive `suppliers` row (so the UI could reference it by ID like any other supplier). We rejected this because IEC is not a Supplier in our domain — it cannot be a Referral target, has no Plans, and carries no payout logic. Mixing it into the `suppliers` table would blur the boundary between "the open-market providers we refer to" and "the incumbent grid operator we compare against," and force every query that lists Suppliers to filter out IEC explicitly.
