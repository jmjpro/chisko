# Electricity Plan Comparison (Israel)

A consumer tool that analyzes household electricity usage and recommends the best-fit plan from Israel's open electricity market, with optional referral handoff to suppliers.

## Language

**Recommendation**:
The engine's output for a given home profile — includes a Primary Recommendation, optionally a No-Change Recommendation, projected annual savings for each, confidence level, and the assumptions used. Stored as a snapshot so it can be reproduced later. When confidence is too low to reliably estimate day/night usage split, the engine restricts output to Fixed Plans only and explains why. Each Recommendation has a shareable link using a 6-character code (curated 32-char alphabet, rate-limited) that shows the full result to anyone with the link — no auth required.
_Avoid_: Result, suggestion, analysis

**Primary Recommendation**:
The plan with the highest expected annual savings for a household, regardless of whether it requires behavior change. Displayed as the #1 ranked card on the results page.
_Avoid_: Best plan, top recommendation

**Alternative Recommendation**:
The 2nd and 3rd highest-saving eligible plans for a household, drawn from the evaluated plan pool and ranked by annual savings after the Primary Recommendation. Displayed as #2 and #3 on the results page, revealed behind a show-more toggle. Up to two Alternative Recommendations may be shown; fewer (or none) are shown when the eligible pool is too small.
_Avoid_: Runner-up, secondary plan, other options

**No-Change Recommendation**:
The best Fixed Plan available for a household — shown alongside the Primary Recommendation when the user is unwilling to shift appliance usage, or when the savings gap between it and the Primary Recommendation exceeds ₪200/year. Always a Fixed Plan.
_Avoid_: Safe plan, safer plan, fallback plan

**Lead**:
A user who provided contact information via the lead-capture form — either after completing the recommendation flow or directly from the standalone plans browsing page. Explicit consent to share data with a specific supplier is obtained at the moment of each Referral, not upfront in ToS. A Lead is never created for anonymous click-through Referrals. A session is not limited to a single Lead — it may submit the lead-capture form more than once over its lifetime (e.g. once from the standalone plans page, later again from the wizard), creating a separate Lead each time.
_Avoid_: User, prospect, signup

**Consent**:
Explicit per-supplier permission granted by the user at the moment of Referral, authorizing their personal data to be shared with that specific supplier. Not a blanket upfront agreement. A single form submission can grant Consent for several suppliers at once — see Supplier Fan-Out.
_Avoid_: Terms of service agreement, opt-in

**Supplier Fan-Out**:
A second, separate step offered after the initial lead-capture submission (which immediately creates the Lead and one form-handoff Referral for the clicked supplier). The dialog then lists every other supplier in the Fan-Out Scope individually (logo + name), each pre-checked; the user may uncheck any. Fan-Out requires its own explicit confirm action — dismissing the dialog after the initial submission, without confirming this step, creates no additional Referrals even though suppliers are pre-checked. When confirmed, one form-handoff Referral — each with its own Consent and timestamp — is created per checked supplier. _Fan-Out Scope_ is the Recommendation's full eligible-plan pool when a Recommendation exists for the session — including plans never rendered on screen, such as still-collapsed alternatives — or every active Supplier when no Recommendation exists for the session. Suppliers that don't support form handoff are excluded from the listed Fan-Out Scope entirely. Suppliers already referred-to earlier in the same session — whether via a prior direct submission, a prior Fan-Out confirmation, or a prior click-through Referral, on any card — are also excluded, so a supplier already holding a Referral this session (of any handoff type) is never re-offered.
_Avoid_: Bulk consent, mass referral, broadcast lead, all-suppliers toggle

**Mail Access Authorization**:
The one-time permission a user grants the IEC smart-meter retrieval extension, at extension setup, to read their Gmail/Outlook/Yahoo inbox — scoped strictly to detecting the IEC OTP code and the smart-meter report attachment. Distinct from Consent: it is not granted at a data-sharing moment and does not involve a Supplier.
_Avoid_: Email access, inbox permission, OAuth scope

**Data Retention**:
Parsed bill and usage data is retained indefinitely. Smart-meter CSV data is parsed entirely on the user's device and never uploaded, so there is no raw file to retain or delete for that input mode. Raw PDF bill uploads are deleted after 30 days. Full user data deletion (contact info, Recommendations, parsed data) is available on request.
_Avoid_: Privacy policy, data policy

**Qualified Lead**:
A lead that a supplier has accepted as actionable — the user is eligible to switch to that supplier's plan.
_Avoid_: Converted lead, approved lead

**Payout State**:
The current status of a Referral's commission lifecycle. States are supplier-configurable at onboarding, since each supplier specifies their own payout trigger (e.g., per accepted lead, per signed contract, per first bill). Not hardcoded per handoff type.
_Avoid_: Commission status, referral status

**Referral**:
The handoff event when a user is sent to a specific supplier, including timestamp, destination supplier, handoff type, and payout state. Three handoff types are supported: click-through (tracking link to supplier site; UI-labeled "מעבר ללא נציג"), form handoff (lead details submitted on behalf of user to supplier; UI-labeled "השאירו פרטים"), and phone-based (user's phone number passed to a supplier rep for outbound call). A Referral does not always have a Lead: click-through Referrals are anonymous, identified by session and a generated click ID rather than contact details, since the click-through flow never collects them. Form-handoff and phone-based Referrals always have a Lead. A plan whose supplier supports both click-through and form handoff shows both CTAs side by side — they are not mutually exclusive. The stored timestamp field is named `consentGivenAt` for historical reasons but only represents actual Consent for form-handoff and phone-based Referrals; for click-through it just records the click timestamp, since no personal data is exchanged and there is nothing to consent to.
_Avoid_: Conversion, signup, click-through

**Click ID**:
A short opaque code (same 6-character Crockford-style alphabet as a Recommendation's share code) generated server-side and stored on a click-through Referral, passed to the supplier as an attribution parameter in the outbound redirect URL. Idempotent per session+supplier+Plan Version: re-clicking the same supplier's link within the same session reuses the existing click-through Referral's Click ID and re-redirects rather than minting a new one or inserting a new Referral row.
_Avoid_: Tracking ID, click token, ref ID

**Form Submission Delivery**:
The internal record tracking whether a form-handoff Referral's details have been relayed onward to the supplier — for now via a notification email to a configurable internal address, standing in for direct supplier integration until one exists per Supplier. One Form Submission Delivery exists per form-handoff Referral, not per Lead or per dialog interaction — each Supplier Fan-Out Referral gets its own. Three states: `open` (queued), `processing` (claimed by a batch run, in flight), `closed` (terminal — either delivered, or permanently failed after exhausting retry attempts). A delivery that errors while `processing` reverts to `open` for retry, up to a capped number of attempts; one stuck in `processing` past a staleness threshold (an abandoned batch run) is also reclaimed back to `open`. Click-through and phone-based Referrals never get a Form Submission Delivery.
_Avoid_: Form submission, submission status, delivery status, notification status

**Supplier**:
A licensed electricity provider in Israel's open market (not IEC the grid operator).
_Avoid_: Provider, vendor, company

**Plan**:
A supplier's electricity pricing structure, including discount logic, eligible hours, and eligibility rules. Plans are versioned — each version has an effective date range.
_Avoid_: Offer, tariff, package

**Plan Version**:
A specific revision of a Plan, valid for a defined date range. A Recommendation records the exact Plan Versions it evaluated so it can be reproduced later.
_Avoid_: Plan snapshot, plan revision

## Confidence Levels

**High Confidence**:
Smart-meter CSV with hourly data is present. All plan types (Fixed, Day, Night) are eligible for recommendation.

**Medium Confidence**:
No smart-meter data, but at least two strong questionnaire signals are present (work-from-home status, EV charging timing, or washer/dryer timing explicitly stated). Day and Night plans may be recommended with a visible "based on estimated usage pattern" notice.

**Low Confidence**:
Questionnaire only, with fewer than two strong signals. Only Fixed Plans are recommended. The Recommendation explains that more data is needed to evaluate time-of-use plans.

## Plan Types

**Fixed Plan**:
A plan with a consistent % discount (typically 5–7%) off IEC's published rate at all hours and days. No behavior change required.
_Avoid_: Flat plan, standard plan

**Day Plan**:
A plan with a ~15% discount applied only during 07:00–17:00, Sunday–Thursday. All other hours (including weekends) are billed at the full IEC rate with no discount.
_Avoid_: Daytime plan, working-hours plan

**Night Plan**:
A plan with a ~20% discount applied only during 23:00–07:00, Sunday–Thursday. All other hours (including weekends) are billed at the full IEC rate with no discount.
_Avoid_: Nighttime plan, off-peak plan

**IEC Rate**:
The Israel Electric Corporation's published reference tariff. All supplier discounts are expressed as a percentage reduction from this rate. It is the cost baseline for a Recommendation calculation whenever a Current Plan Baseline isn't available.

**Current Plan Baseline**:
The household's actual current plan, used instead of the IEC Rate as the cost baseline for a Recommendation when known. Computed by treating the current plan as just another evaluated Plan Version — deriving its own savings-vs-IEC-Rate the same way every candidate's savings are calculated — then subtracting that from both the baseline cost and every candidate's displayed savings, so all savings figures end up relative to what the household is actually paying today rather than the published tariff. Captured via an optional current-plan selection (covering all of that supplier's Plan Types) shown only when the Home Profile's current supplier is a real, non-IEC supplier; skipping it, or the supplier being IEC or "don't know", falls back to the IEC Rate baseline — explained to the user via a popover (hover on desktop, tap on mobile). Independent of whether a Bill Import exists: a Bill Import's data only affects usage-estimation Confidence Level, never which baseline is used. A candidate can come out with negative savings under this baseline (switching would cost more than staying) — still shown as the closest/least-bad candidate, clearly labeled as costing more, rather than hidden or excluded. See ADR-0025.
_Avoid_: Current plan comparison, real baseline, actual cost baseline

## Plan Version Attributes

**Savings Cap**:
An optional upper bound on the annual benefit a Plan Version can deliver, expressed in agorot. When present, the engine uses the lesser of the calculated savings and the Savings Cap — additional usage earns no further benefit beyond the cap. Most plans are uncapped.
_Avoid_: Benefit ceiling, discount cap, savings limit

**Benefit Delivery**:
The mechanism by which a plan's discount is delivered. `billDiscount` plans reduce the electricity bill directly (the default). `appCredit` plans deliver value as credits in a partner program (e.g., Yellow app) rather than as a bill reduction. Benefit Delivery is a Plan Version attribute, not a Plan Type.
_Avoid_: Non-cash benefit, indirect savings, loyalty benefit

**Affiliate Reference**:
The supplier-defined parameter(s) appended to a click-through outbound URL identifying this specific Plan Version to the supplier (e.g. Elektra's `refcode`/`refid` pair). A Plan Version Attribute, present only on versions of suppliers that support click-through, since it's specific to that plan/version rather than the supplier as a whole — a supplier's plans can carry different Affiliate References, and a new Plan Version may need a new one even if the discount terms are unchanged.
_Avoid_: Tracking params, refcode, affiliate link

## Eligibility Rules

A Plan Version may carry any combination of these eligibility requirements, evaluated against the Home Profile before cost calculations run:

**Smart Meter Required**: Day and Night plans require an IEC smart meter (hourly/quarter-hourly metering). Households without one are ineligible for time-of-use plans regardless of usage pattern.

**Membership Required**: Some plans are restricted to customers of a bundled service. Two list formats are supported, distinguished by separator: a `+`-separated list means every named membership is required (e.g., a plan requiring "HOT triple + HOT Mobile"); a `, or`-separated list means any one of them suffices (e.g., HOT Fixed Savers requires "HOT triple, or HOT Mobile"). The Home Profile must capture relevant bundle memberships.

**Residential Only**: All plans in scope are residential. Non-residential accounts are out of scope for this product.

**Supplier Coverage**: A plan is only available where the supplier operates and can complete the switch. Coverage is supplier-defined and stored on the Plan Version.

**Off-Bill Benefit Willingness**:
A user's stated preference, captured late in the questionnaire, for whether they are willing to receive plan benefits as credits in a third-party program rather than as a direct bill reduction. When false, all Plan Versions with `appCredit` Benefit Delivery are ineligible — they are excluded before cost calculations run, the same path as any other eligibility check.
_Avoid_: Non-cash preference, app credit preference

**Smart Meter Registry**:
The IEC-sourced dataset of addresses in Israel where a smart meter has been installed. Used to determine smart meter status for households that are uncertain which meter type they have. Refreshed weekly by adding newly-listed addresses; an address already in the Registry is never removed even if a later refresh's source data no longer lists it — see ADR 0021.
_Avoid_: Mobility addresses, IEC address list, meter addresses

**Place of Residence** (Hebrew: יישוב):
The official Israeli term for any populated locality — city, town, village, kibbutz, moshav, or Bedouin settlement — regardless of municipal status. Used throughout the wizard in place of "city", which implies a specific municipal classification that excludes many Israeli localities. Sourced from the Israeli government's locality registry (`data.gov.il`) and stored in the `israelPlaces` table with multilingual names (Hebrew required; English, Arabic, Russian where available). Stored on the Home Profile as a multilingual snapshot at selection time.
_Avoid_: City, town, locality, settlement

**israelPlaces**:
A Convex table that caches Israel's official locality registry, refreshed weekly from `data.gov.il`. Each record stores the place name in up to four languages (Hebrew required; English, Arabic, Russian where available). Used to power the Place of Residence typeahead in the wizard and to resolve multilingual names for Home Profiles captured via the Smart Meter Registry cascade.
_Avoid_: Cities table, places list

## Inputs

**Home Profile**:
A household's self-reported characteristics captured via questionnaire. Fields: smart meter (yes/no — determined at the start of the wizard, never unknown after completion), place of residence (a multilingual snapshot of the selected יישוב), street, house number (street and house number populated only when collected via Smart Meter Registry lookup), bundle memberships (HOT triple, HOT Mobile, Cellcom, Amisragas, etc.), current supplier, current plan (asked only when the current supplier is a real, non-IEC supplier — see Current Plan Baseline), approximate monthly kWh (if no Bill Import), work-from-home pattern, EV charging (yes/no + timing), washer/dryer timing, AC usage level, willingness to shift appliance usage to save more (yes/no), and Off-Bill Benefit Willingness (yes/no — asked late in the questionnaire). When the current supplier is IEC or "don't know", both current supplier and current plan are represented as a null reference, and the Recommendation falls back to the IEC Rate baseline.
_Avoid_: User profile, household, account

**Bill Import**:
A parsed electricity bill or IEC smart-meter CSV upload, including billing period, total kWh, and hourly intervals if present. Schema also reserves a current-supplier/current-plan pair on the Bill Import itself (for a future PDF-extraction flow where the bill document states the supplier), but it's never populated today — the smart-meter CSV parser always writes it as null, and the Current Plan Baseline instead reads current supplier/plan from the Home Profile, independent of any Bill Import. Of the three input modes named in the schema — IEC smart-meter CSV (structured, reliable), LLM-based PDF extraction, and manual entry — only the smart-meter CSV path is actually implemented; PDF extraction and manual entry exist only as schema literals with no parser, mutation, or upload UI behind them yet.
_Avoid_: Upload, file, usage data

**Parsing Confidence**:
The proportion of LLM-based PDF bill extractions where the user confirmed all fields with zero edits. A bill where any single field was corrected counts as a failed extraction. When Parsing Confidence exceeds a configurable threshold (default 98%), the mandatory user-confirmation step for PDF extraction is removed. Raw bill files are deleted after 30 days regardless of input mode.
_Avoid_: Extraction accuracy, OCR confidence
