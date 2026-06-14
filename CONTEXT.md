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
A user who completed the recommendation flow and provided contact information. Explicit consent to share data with a specific supplier is obtained at the moment of Referral, not upfront in ToS.
_Avoid_: User, prospect, signup

**Consent**:
Explicit per-supplier permission granted by the user at the moment of Referral, authorizing their personal data to be shared with that specific supplier. Not a blanket upfront agreement.
_Avoid_: Terms of service agreement, opt-in

**Data Retention**:
Parsed bill and usage data is retained indefinitely. Raw uploaded bill files are deleted after 30 days. Full user data deletion (contact info, Recommendations, parsed data) is available on request.
_Avoid_: Privacy policy, data policy

**Qualified Lead**:
A lead that a supplier has accepted as actionable — the user is eligible to switch to that supplier's plan.
_Avoid_: Converted lead, approved lead

**Payout State**:
The current status of a Referral's commission lifecycle. States are supplier-configurable at onboarding, since each supplier specifies their own payout trigger (e.g., per accepted lead, per signed contract, per first bill). Not hardcoded per handoff type.
_Avoid_: Commission status, referral status

**Referral**:
The handoff event when a lead is sent to a specific supplier, including timestamp, destination supplier, handoff type, and payout state. Three handoff types are supported: click-through (tracking link to supplier site), form handoff (lead details submitted on behalf of user to supplier), and phone-based (user's phone number passed to a supplier rep for outbound call).
_Avoid_: Conversion, signup, click-through

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
The Israel Electric Corporation's published reference tariff. All supplier discounts are expressed as a percentage reduction from this rate. It is the cost baseline for every Recommendation calculation.

## Plan Version Attributes

**Savings Cap**:
An optional upper bound on the annual benefit a Plan Version can deliver, expressed in agorot. When present, the engine uses the lesser of the calculated savings and the Savings Cap — additional usage earns no further benefit beyond the cap. Most plans are uncapped.
_Avoid_: Benefit ceiling, discount cap, savings limit

**Benefit Delivery**:
The mechanism by which a plan's discount is delivered. `billDiscount` plans reduce the electricity bill directly (the default). `appCredit` plans deliver value as credits in a partner program (e.g., Yellow app) rather than as a bill reduction. Benefit Delivery is a Plan Version attribute, not a Plan Type.
_Avoid_: Non-cash benefit, indirect savings, loyalty benefit

## Eligibility Rules

A Plan Version may carry any combination of these eligibility requirements, evaluated against the Home Profile before cost calculations run:

**Smart Meter Required**: Day and Night plans require an IEC smart meter (hourly/quarter-hourly metering). Households without one are ineligible for time-of-use plans regardless of usage pattern.

**Membership Required**: Some plans are restricted to customers of a bundled service (e.g., HOT e-Triple requires HOT triple + HOT Mobile subscription). The Home Profile must capture relevant bundle memberships.

**Residential Only**: All plans in scope are residential. Non-residential accounts are out of scope for this product.

**Supplier Coverage**: A plan is only available where the supplier operates and can complete the switch. Coverage is supplier-defined and stored on the Plan Version.

**Off-Bill Benefit Willingness**:
A user's stated preference, captured late in the questionnaire, for whether they are willing to receive plan benefits as credits in a third-party program rather than as a direct bill reduction. When false, all Plan Versions with `appCredit` Benefit Delivery are ineligible — they are excluded before cost calculations run, the same path as any other eligibility check.
_Avoid_: Non-cash preference, app credit preference

**Smart Meter Registry**:
The IEC-sourced dataset of addresses in Israel where a smart meter has been installed. Used to determine smart meter status for households that are uncertain which meter type they have.
_Avoid_: Mobility addresses, IEC address list, meter addresses

**Place of Residence** (Hebrew: יישוב):
The official Israeli term for any populated locality — city, town, village, kibbutz, moshav, or Bedouin settlement — regardless of municipal status. Used throughout the wizard in place of "city", which implies a specific municipal classification that excludes many Israeli localities. Sourced from the Israeli government's locality registry (`data.gov.il`) and stored in the `israelPlaces` table with multilingual names (Hebrew required; English, Arabic, Russian where available). Stored on the Home Profile as a multilingual snapshot at selection time.
_Avoid_: City, town, locality, settlement

**israelPlaces**:
A Convex table that caches Israel's official locality registry, refreshed weekly from `data.gov.il`. Each record stores the place name in up to four languages (Hebrew required; English, Arabic, Russian where available). Used to power the Place of Residence typeahead in the wizard and to resolve multilingual names for Home Profiles captured via the Smart Meter Registry cascade.
_Avoid_: Cities table, places list

## Inputs

**Home Profile**:
A household's self-reported characteristics captured via questionnaire. Fields: smart meter (yes/no — determined at the start of the wizard, never unknown after completion), place of residence (a multilingual snapshot of the selected יישוב), street, house number (street and house number populated only when collected via Smart Meter Registry lookup), bundle memberships (HOT triple, Cellcom, etc.), current supplier + plan (if no bill uploaded), approximate monthly kWh (if no bill uploaded), work-from-home pattern, EV charging (yes/no + timing), washer/dryer timing, AC usage level, willingness to shift appliance usage to save more (yes/no), and Off-Bill Benefit Willingness (yes/no — asked late in the questionnaire). When the current supplier is IEC (or unknown), both are represented as a null supplier reference — the Recommendation engine uses the full IEC Rate as the cost baseline in either case.
_Avoid_: User profile, household, account

**Bill Import**:
A parsed electricity bill or IEC smart-meter CSV upload, including billing period, total kWh, current supplier, current plan, and hourly intervals if present. The current supplier and plan from a Bill Import are the baseline for Recommendation savings calculations. Three input modes are supported: IEC smart-meter CSV (structured, reliable), LLM-based PDF extraction (with mandatory user confirmation until parsing confidence exceeds threshold), and manual entry.
_Avoid_: Upload, file, usage data

**Parsing Confidence**:
The proportion of LLM-based PDF bill extractions where the user confirmed all fields with zero edits. A bill where any single field was corrected counts as a failed extraction. When Parsing Confidence exceeds a configurable threshold (default 98%), the mandatory user-confirmation step for PDF extraction is removed. Raw bill files are deleted after 30 days regardless of input mode.
_Avoid_: Extraction accuracy, OCR confidence
