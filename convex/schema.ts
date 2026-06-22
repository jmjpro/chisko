import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Licensed electricity providers in Israel's open market
  suppliers: defineTable({
    name: v.string(), // English canonical name; translations in public/locales/{lang}/suppliers.json
    isActive: v.boolean(),
    supportedHandoffTypes: v.array(
      v.union(
        v.literal("clickThrough"),
        v.literal("formHandoff"),
        v.literal("phoneBased"),
      ),
    ),
    // Supplier-configurable payout lifecycle
    payoutTrigger: v.string(), // e.g. "perAcceptedLead" | "perSignedContract" | "perFirstBill"
    payoutStates: v.array(
      v.object({
        key: v.string(), // used as i18n key: t(key, { ns: 'payoutStates' })
        label: v.string(), // English fallback label
      }),
    ),
    initialPayoutState: v.string(),
    // Handoff config
    trackingUrlTemplate: v.optional(v.string()), // click-through
    formHandoffWebhookUrl: v.optional(v.string()), // form handoff
  }),

  // IEC reference tariff — versioned so rate changes are tracked and
  // each Recommendation can reference the exact rate used (reproducibility).
  iecRates: defineTable({
    rateAgorotPerKwh: v.number(), // e.g. 64.32 for 64.32 agorot/kWh (post-VAT)
    effectiveFrom: v.number(), // ms timestamp
    effectiveTo: v.union(v.number(), v.null()), // null = currently active
    notes: v.optional(v.string()), // e.g. "IEC tariff update Q1 2026"
  })
    .index("by_effective_to", ["effectiveTo"])
    .index("by_effective_from", ["effectiveFrom"]),

  // IEC TAOZ (time-of-use) tariff — versioned by season and period type.
  // Season buckets: summer = Jun–Sep, winter = Dec–Feb, shoulder = Mar–May + Oct–Nov.
  // Peak window: summer 17:00–23:00, winter 17:00–22:00 (no peak in shoulder).
  iecTaozRates: defineTable({
    season: v.union(
      v.literal("summer"),
      v.literal("winter"),
      v.literal("shoulder"),
    ),
    periodType: v.union(v.literal("peak"), v.literal("offPeak")),
    // Month range (1–12, inclusive). endMonth < startMonth wraps the calendar year
    // (e.g. winter: 12→2 = Dec through Feb).
    startMonth: v.number(),
    endMonth: v.number(),
    // Hour window. endHour < startHour wraps midnight (e.g. summer off-peak: 23→17).
    // Full-day: startHour: 0, endHour: 24. Peak windows use 0–23.
    startHour: v.number(),
    endHour: v.number(),
    rateAgorotPerKwh: v.number(),
    effectiveFrom: v.number(),
    effectiveTo: v.union(v.number(), v.null()),
    notes: v.optional(v.string()),
  })
    .index("by_effective_to", ["effectiveTo"])
    .index("by_effective_from", ["effectiveFrom"])
    .index("by_season_and_period_and_effective_to", [
      "season",
      "periodType",
      "effectiveTo",
    ]),

  // A supplier's pricing structure — parent of versioned records
  plans: defineTable({
    supplierId: v.id("suppliers"),
    name: v.string(), // English canonical name; translations in public/locales/{lang}/plans.json
    planType: v.union(v.literal("fixed"), v.literal("day"), v.literal("night")),
  })
    .index("by_supplier", ["supplierId"])
    .index("by_supplier_and_type", ["supplierId", "planType"]),

  // A specific revision of a plan with an effective date range.
  // Recommendations reference plan version IDs for reproducibility.
  planVersions: defineTable({
    planId: v.id("plans"),
    effectiveFrom: v.number(), // ms timestamp
    effectiveTo: v.union(v.number(), v.null()), // null = currently active
    discountPercent: v.number(), // e.g. 7.0 = 7% off IEC rate
    annualSavingsCapAgorot: v.optional(v.number()), // null = uncapped; e.g. 60000 = ₪600/year
    benefitDelivery: v.union(v.literal("billDiscount"), v.literal("appCredit")),
    // Discount window (day/night plans only)
    discountWindowStartHour: v.optional(v.number()), // 0–23
    discountWindowEndHour: v.optional(v.number()), // 0–23
    weekdayWindowOnly: v.boolean(), // true = window applies Sun–Thu only; false = all 7 days
    eligibility: v.object({
      requiresSmartMeter: v.boolean(),
      membershipRequired: v.union(v.string(), v.null()), // e.g. "HOT triple + HOT Mobile"
      residentialOnly: v.boolean(),
      coverageAreas: v.array(v.string()),
    }),
  })
    .index("by_plan", ["planId"])
    .index("by_plan_and_effective_from", ["planId", "effectiveFrom"])
    .index("by_effective_to", ["effectiveTo"]),

  // Anonymous session linking a Home Profile, Bill Imports, and Recommendation
  // before the user converts to a Lead.
  sessions: defineTable({
    sessionToken: v.string(),
    expiresAt: v.number(),
    convertedToLeadId: v.union(v.id("leads"), v.null()),
  }).index("by_session_token", ["sessionToken"]),

  // Israeli government locality registry — refreshed weekly from data.gov.il
  israelPlaces: defineTable({
    he: v.string(), // Hebrew name (required)
    en: v.optional(v.string()),
    ar: v.optional(v.string()),
    ru: v.optional(v.string()),
  }).index("by_he", ["he"]),

  // Household characteristics captured via questionnaire
  homeProfiles: defineTable({
    sessionId: v.id("sessions"),
    hasSmartMeter: v.union(
      v.literal("yes"),
      v.literal("no"),
      v.literal("unknown"),
    ),
    bundleMemberships: v.array(v.string()), // e.g. ["HOT triple", "HOT Mobile"]
    placeOfResidence: v.object({
      he: v.string(),
      en: v.optional(v.string()),
      ar: v.optional(v.string()),
      ru: v.optional(v.string()),
    }),
    // Populated only when address was collected via Smart Meter Registry lookup
    street: v.optional(v.string()),
    houseNumber: v.optional(v.string()),
    currentSupplierId: v.union(v.id("suppliers"), v.null()),
    currentPlanId: v.union(v.id("plans"), v.null()),
    approximateMonthlyKwh: v.union(v.number(), v.null()),
    workFromHome: v.union(
      v.literal("always"),
      v.literal("sometimes"),
      v.literal("never"),
    ),
    hasEv: v.boolean(),
    evChargingTime: v.union(
      v.literal("day"),
      v.literal("night"),
      v.literal("mixed"),
      v.null(),
    ),
    washerDryerTime: v.union(
      v.literal("day"),
      v.literal("night"),
      v.literal("flexible"),
      v.null(),
    ),
    acUsageLevel: v.union(
      v.literal("heavy"),
      v.literal("moderate"),
      v.literal("light"),
      v.literal("none"),
    ),
    willingToShiftUsage: v.boolean(),
    willingToAcceptOffBillBenefits: v.boolean(),
  }).index("by_session", ["sessionId"]),

  // Parsed electricity bill or IEC smart-meter CSV.
  // The current supplier and plan from a Bill Import are the savings baseline.
  billImports: defineTable({
    sessionId: v.id("sessions"),
    inputMode: v.union(
      v.literal("smartmeterCsv"),
      v.literal("pdfExtraction"),
      v.literal("manualEntry"),
    ),
    billingPeriodStart: v.number(), // ms timestamp
    billingPeriodEnd: v.number(),
    totalKwh: v.number(),
    currentSupplierId: v.union(v.id("suppliers"), v.null()),
    currentPlanVersionId: v.union(v.id("planVersions"), v.null()),
    // Usage breakdown by day-of-week and hour band (all four sum to totalKwh).
    // Day = 07:00–23:00, Night = 23:00–07:00. Weekday = Sun–Thu, Weekend = Fri–Sat.
    // Populated from smart-meter CSV; used to compute savings for any plan window.
    kwhWeekdayDay: v.optional(v.number()),
    kwhWeekdayNight: v.optional(v.number()),
    kwhWeekendDay: v.optional(v.number()),
    kwhWeekendNight: v.optional(v.number()),
    // TAOZ buckets — all four populated together when CSV is a TAOZ smart-meter export.
    // iecTaozRatesEffectiveFrom records which rate version's windows were used for bucketing;
    // the engine loads that snapshot to ensure rates and buckets always stay aligned.
    kwhTaozSummerPeak: v.optional(v.number()), // Jun–Sep, 17:00–23:00
    kwhTaozSummerOffPeak: v.optional(v.number()), // Jun–Sep, other hours
    kwhTaozWinterPeak: v.optional(v.number()), // Dec–Feb, 17:00–22:00
    kwhTaozWinterOffPeak: v.optional(v.number()), // Mar–May, Oct–Nov + Dec–Feb other hours
    iecTaozRatesEffectiveFrom: v.optional(v.number()), // effectiveFrom of active iecTaozRates at parse time
    // File storage — raw file deleted after 30 days; parsed hourly JSON kept indefinitely
    rawFileStorageId: v.union(v.id("_storage"), v.null()),
    rawFileDeletedAt: v.union(v.number(), v.null()),
    parsedDataStorageId: v.union(v.id("_storage"), v.null()), // hourly JSON blob
    // PDF extraction confirmation gate
    userConfirmed: v.union(v.boolean(), v.null()),
    editedFieldCount: v.union(v.number(), v.null()), // 0 = zero-edit (clean extraction)
    confirmedAt: v.union(v.number(), v.null()),
  }).index("by_session", ["sessionId"]),

  // The recommendation engine's output for a given home profile.
  // Stores plan version IDs (not inline plan data) for reproducibility.
  recommendations: defineTable({
    sessionId: v.id("sessions"),
    homeProfileId: v.id("homeProfiles"),
    billImportId: v.union(v.id("billImports"), v.null()),
    confidenceLevel: v.union(
      v.literal("high"),
      v.literal("medium"),
      v.literal("low"),
    ),
    iecRateId: v.id("iecRates"), // rate used for all savings calculations
    baselineAnnualCostAgorot: v.number(),
    taozBaselineAnnualCostAgorot: v.union(v.number(), v.null()), // null when no TAOZ CSV data
    // Primary Recommendation: highest expected annual savings
    primaryPlanVersionId: v.id("planVersions"),
    primaryAnnualSavingsAgorot: v.number(),
    // No-Change Recommendation: best Fixed Plan (always shown)
    noChangePlanVersionId: v.id("planVersions"),
    noChangePlanAnnualSavingsAgorot: v.number(),
    // True when savings gap > ₪200/yr — render both side-by-side
    showNoChangeSeparately: v.boolean(),
    assumptions: v.string(),
    // Shareable link code (6-char, curated 32-char alphabet) — set when user shares
    shareCode: v.union(v.string(), v.null()),
  })
    .index("by_session", ["sessionId"])
    .index("by_share_code", ["shareCode"]),

  // All plan versions evaluated for a recommendation, with per-version results.
  // Kept separate to avoid bloating the recommendation document.
  evaluatedPlanVersions: defineTable({
    recommendationId: v.id("recommendations"),
    planVersionId: v.id("planVersions"),
    annualSavingsAgorot: v.number(),
    isEligible: v.boolean(),
    ineligibilityReason: v.union(v.string(), v.null()),
  })
    .index("by_recommendation", ["recommendationId"])
    .index("by_plan_version", ["planVersionId"]),

  // A user who provided contact info via the lead-capture form, either after
  // the recommendation flow (recommendationId set) or from the standalone
  // plans page (recommendationId absent — see ADR-0021)
  leads: defineTable({
    sessionId: v.id("sessions"),
    recommendationId: v.optional(v.id("recommendations")),
    name: v.string(),
    phone: v.string(),
    email: v.union(v.string(), v.null()),
  })
    .index("by_session", ["sessionId"])
    .index("by_recommendation", ["recommendationId"]),

  // A handoff event when a lead is sent to a specific supplier.
  // Per-supplier consent is captured at this moment (not upfront in ToS).
  referrals: defineTable({
    leadId: v.id("leads"),
    supplierId: v.id("suppliers"),
    planVersionId: v.id("planVersions"),
    handoffType: v.union(
      v.literal("clickThrough"),
      v.literal("formHandoff"),
      v.literal("phoneBased"),
    ),
    consentGivenAt: v.number(),
    payoutState: v.string(), // key from supplier's payoutStates array
    payoutStateUpdatedAt: v.number(),
  })
    .index("by_lead", ["leadId"])
    .index("by_supplier", ["supplierId"])
    .index("by_lead_and_supplier", ["leadId", "supplierId"]),

  // Tracks relaying a form-handoff Referral's details onward to the supplier
  // (today: a notification email; see ADR-0022). One row per form-handoff
  // Referral. Click-through and phone-based Referrals never get one.
  formSubmissionDeliveries: defineTable({
    referralId: v.id("referrals"),
    state: v.union(
      v.literal("open"),
      v.literal("processing"),
      v.literal("closed"),
    ),
    attempts: v.number(),
    processingStartedAt: v.union(v.number(), v.null()),
  })
    .index("by_referral", ["referralId"])
    .index("by_state", ["state"]),

  // Smart Meter Registry — deduped city list (from IEC mobility program CSV)
  smartMeterCities: defineTable({
    cityCode: v.number(),
    cityName: v.string(),
  }).index("by_city_code", ["cityCode"]),

  // Smart Meter Registry — deduped street list per city
  smartMeterStreets: defineTable({
    cityCode: v.number(),
    streetCode: v.number(),
    streetName: v.string(),
  })
    .index("by_city_code", ["cityCode"])
    .index("by_city_and_street_code", ["cityCode", "streetCode"]),

  // Smart Meter Registry — one row per address known to have a smart meter
  smartMeterAddresses: defineTable({
    cityCode: v.number(),
    streetCode: v.number(),
    houseNumber: v.string(),
  })
    .index("by_city_and_street", ["cityCode", "streetCode"])
    .index("by_city_street_and_house", [
      "cityCode",
      "streetCode",
      "houseNumber",
    ]),

  // Singleton tracking the last successful Smart Meter Registry refresh
  smartMeterRegistryMeta: defineTable({
    lastRefreshedAt: v.number(),
  }),

  // Singleton counter for PDF extraction confidence.
  // The mandatory confirmation gate is removed once zeroEditExtractions / totalPdfExtractions
  // exceeds thresholdPercent (default 98).
  parsingConfidenceStats: defineTable({
    totalPdfExtractions: v.number(),
    zeroEditExtractions: v.number(),
    thresholdPercent: v.number(), // default 98
  }),
});
