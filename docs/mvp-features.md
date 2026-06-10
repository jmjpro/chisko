## MVP features
Build the first version around one core promise: “Upload your bills or smart-meter file and get the best electricity plan for your home.” Israel’s market is open, switching is real, and plan fit depends on usage pattern, not just the headline discount.[1][2][3]

Feature set for v1:
- Bill upload: PDF bills and IEC smart-meter CSV upload.[1]
- Household questionnaire: AC season, EV, boiler habits, washer/dryer timing, work-from-home, family size, heating type.
- Recommendation engine: fixed-discount vs night/day plans, expected annual savings, confidence score.
- Supplier comparison page: best plan, runner-up, “why,” and signup CTA.
- Lead capture: name, phone, email, permission to share with supplier.
- Admin panel: plan rules, supplier offers, referral tracking, manual overrides.

## Data model
You don’t need a huge schema at first; you need a clean one.

Core entities:
- **User**: id, contact info, consent flags, locale.
- **Home profile**: city, family size, smart meter yes/no, appliances, work/home pattern.
- **Bill / meter import**: file metadata, billing period, total kWh, supplier, plan, parsed line items, hourly intervals if present.
- **Plan catalog**: supplier, plan name, discount logic, eligible hours, eligibility rules, start/end dates.
- **Recommendation run**: inputs snapshot, computed savings by plan, chosen recommendation, confidence score, notes.
- **Referral / lead**: destination supplier, timestamp, status, commission type, payout state.

The most important design choice is versioning the **plan rules**, because supplier offers change often and you need to reproduce why a recommendation was made on a given date.[4][1]

## Recommendation logic
Start with a rules engine, not ML. The market is structured enough that deterministic logic is easier to explain and audit.[2][4]

A good first-pass engine:
1. Parse annual and seasonal usage.
2. Infer day/night distribution from smart-meter CSV; if unavailable, estimate from questionnaire + bills.
3. Compute projected annual cost under each plan.
4. Penalize recommendations with low confidence or missing assumptions.
5. Return:
   - Best plan by expected savings,
   - “Safer” plan if user does not want behavior changes,
   - Confidence + assumptions.

This matters because users need to trust the explanation, especially if you later monetize through referrals.[5][1]

## Landing page copy
A simple positioning direction:

**Hero**  
Find the cheapest electricity plan in Israel for your actual usage.[2]
Upload your bill or smart-meter file, answer a few questions, and get a personalized recommendation in minutes.

**Subhead**  
Not all electricity discounts are equal. Some plans are best for night-heavy homes, some for steady all-day usage, and some only work if you change habits.[3][1]

**CTA**  
Upload a bill

**How it works**
- Upload your last 12 months of bills or IEC usage export.
- Tell us about AC, laundry, heating, and when your home uses power.
- See which supplier and plan should save you the most.

**Trust section**
- Clear assumptions
- Transparent comparisons
- No need to guess from ads or call centers

**Disclosure**
We may earn a referral fee from some suppliers. Recommendations should remain rules-based and independently ranked, with that disclosure shown clearly near results.[6][1]

## GTM plan
The fastest path is not SEO-first; it is manual-first.

Phase 1:
- Landing page + waitlist
- Manual analysis for first 25–50 users
- WhatsApp / Facebook community outreach
- Track what data people can actually upload and where parsing fails

Phase 2:
- Self-serve recommendation flow
- Referral handoff to 2–3 supplier partners
- Publish educational content: fixed vs night plans, smart-meter guides, “how to read your bill” articles.[7][1]

Phase 3:
- Retention: quarterly “should you switch?” reminders
- Family / landlord / property-manager multi-home tools
- API or white-label comparison widget for relocation / finance sites

## Risks to handle early
You will be handling bills, addresses, contract numbers, and household behavior data, so privacy and consent are not side issues; they are product requirements. You also need clear language that recommendations are informational, offers can change, and final signup terms come from the supplier.[8][6][1]

## My take
This is a solid niche project because it sits at the intersection of real consumer confusion, structured data, and measurable savings. The smartest next move is to validate demand with a landing page and manual concierge workflow before building the full parser and recommendation engine.[9][1]

A crisp MVP stack could be:
- Frontend: Next.js or simple React
- Backend: Supabase / Postgres
- Parsing: Python or Node workers for PDF/CSV normalization
- Rules engine: versioned plan formulas in DB
- CRM: lightweight lead tracking + referral status

Would you like me to turn this into a one-page product spec or a clickable landing page draft?

Sources
[1] Israel's Electricity Reform: What It Means for You https://www.nbn.org.il/life-in-israel/community-and-housing/setting-up-your-home-in-israel-community-and-housing/israels-electricity-reform-what-it-means-for-you/
[2] Electricity supply market to be fully competitive from July https://en.globes.co.il/en/article-electricity-supply-market-to-be-fully-competitive-from-july-1001476292
[3] Understanding The Electricity Reform https://rifkalebowitz.com/understanding-the-electricity-reform/
[4] The Electricity Authority https://www.gov.il/en/departments/the_electricity_authority
[5] How to get a discount on your electricity bill https://bluewhitefinance.com/how-to-get-a-discount-on-your-electricity-bill/
[6] Overview of Amendment No. 13 to the Israeli Privacy Law https://techpolicy.org.il/wp-content/uploads/2024/10/Overview-of-Amendment-no-13-FINAL-FINAL-FOR-UPLOAD-FOR-WEBSITE-COLLATED-1.pdf
[7] Lead Generation Best Practices: 54 Key Tips for Websites ... https://www.orbitmedia.com/blog/lead-generation-website-practices/
[8] GUIDANCE NOTE - Israel - Privacy Overview https://www.apm.law/wp-content/uploads/2025/12/Israel-Privacy-Overview-Guidance-Note.pdf
[9] 300,000 Israeli households switch electricity supplier - גלובס https://en.globes.co.il/en/article-300000-israelis-have-switched-electricity-suppliers-1001500041
[10] Service to the Public at the Israel Electric Company Ltd. https://library.mevaker.gov.il/sites/DigitalLibrary/Documents/2024/2024.01-74A/EN/2024-74A-303-Electric-Taktzir-EN.pdf
[11] How to Lower Your Electricity Bill in Israel https://www.buyitinisrael.com/news/lower-electricity-bill-israel/
[12] Demand Generation vs Lead Generation: Best Practices ... https://www.leadspicker.com/articles/demand-generation-vs-lead-generation-best-practices-and-key-differences
[13] What is Lead Generation? Guide & Best Practices https://www.salesforce.com/marketing/lead-generation-guide/
[14] Electricity, Gas and Water https://www.nbn.org.il/life-in-israel/community-and-housing/setting-up-your-home-in-israel-community-and-housing/electricity-gas-and-water/
[15] What is Lead generation? Types of ... https://www.apptivo.com/blog/what-is-lead-generation-types-of-lead-generationexamples-and-best-practices/
[16] Privacy Policy - Israel Electric Global https://iec-global.com/privacy-policy
