# Off-Bill Benefit Willingness gates eligibility, not display

When a user states they are unwilling to accept off-bill benefits (i.e., `willingToAcceptOffBillBenefits: false`), all Plan Versions with `benefitDelivery: "appCredit"` are marked ineligible and excluded from the Recommendation entirely — they are not shown with a disclosure or ranked lower. This mirrors the existing `willingToShiftUsage` pattern: a stated user preference produces a hard eligibility gate, not a soft display hint.

## Considered Options

- **Gate eligibility entirely (chosen)**: plans with `appCredit` Benefit Delivery are excluded before cost calculations run, the same path as `requiresSmartMeter` or `membershipRequired` failing. The user's preference is respected unconditionally.
- **Show with disclosure**: run the plan through cost calculations, display it on the results page, but add a prominent callout explaining the off-bill delivery. Rejected because it undermines the preference the user stated, adds UI complexity, and creates an inconsistency with how `willingToShiftUsage` works — a user who says "no" should not see the thing they said no to.
