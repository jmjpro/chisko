import { internalMutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

const JAN_2024 = Date.UTC(2024, 0, 1);
const JAN_2026 = Date.UTC(2026, 0, 1);

const PAYOUT_STATES = [
  { key: "pending", label: "Pending Approval" },
  { key: "qualified", label: "Qualified Lead" },
  { key: "contracted", label: "Contracted" },
  { key: "paid", label: "Paid" },
];

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("suppliers").first();
    if (existing) return "already seeded — skipping";

    // ── 1. IEC flat rate ───────────────────────────────────────────────────────
    await ctx.db.insert("iecRates", {
      rateAgorotPerKwh: 64.32,
      effectiveFrom: JAN_2026,
      effectiveTo: null,
      notes:
        "IEC residential flat tariff — post-VAT (17%), effective Jan 2026 (1.5% increase from 2025)",
    });

    // ── 2. IEC TAOZ rates (6 rows) ─────────────────────────────────────────────
    const taozRows: Array<{
      season: "summer" | "winter" | "shoulder";
      periodType: "peak" | "offPeak";
      startMonth: number;
      endMonth: number;
      startHour: number;
      endHour: number;
      rateAgorotPerKwh: number;
      effectiveFrom: number;
      effectiveTo: number | null;
      notes?: string;
    }> = [
      {
        season: "summer",
        periodType: "peak",
        startMonth: 6,
        endMonth: 9,
        startHour: 17,
        endHour: 23,
        rateAgorotPerKwh: 168.95,
        effectiveFrom: JAN_2026,
        effectiveTo: null,
        notes: "IEC TAOZ summer peak — post-VAT, effective Jan 2026",
      },
      {
        season: "summer",
        periodType: "offPeak",
        startMonth: 6,
        endMonth: 9,
        startHour: 23,
        endHour: 17,
        rateAgorotPerKwh: 52.83,
        effectiveFrom: JAN_2026,
        effectiveTo: null,
        notes: "IEC TAOZ summer off-peak — post-VAT, effective Jan 2026",
      },
      {
        season: "winter",
        periodType: "peak",
        startMonth: 12,
        endMonth: 2,
        startHour: 17,
        endHour: 22,
        rateAgorotPerKwh: 120.71,
        effectiveFrom: JAN_2026,
        effectiveTo: null,
        notes: "IEC TAOZ winter peak — post-VAT, effective Jan 2026",
      },
      {
        season: "winter",
        periodType: "offPeak",
        startMonth: 12,
        endMonth: 2,
        startHour: 22,
        endHour: 17,
        rateAgorotPerKwh: 45.57,
        effectiveFrom: JAN_2026,
        effectiveTo: null,
        notes: "IEC TAOZ winter off-peak — post-VAT, effective Jan 2026",
      },
      {
        season: "shoulder",
        periodType: "offPeak",
        startMonth: 3,
        endMonth: 5,
        startHour: 0,
        endHour: 24,
        rateAgorotPerKwh: 45.57,
        effectiveFrom: JAN_2026,
        effectiveTo: null,
        notes:
          "IEC TAOZ spring shoulder off-peak (Mar–May, all hours) — post-VAT, effective Jan 2026",
      },
      {
        season: "shoulder",
        periodType: "offPeak",
        startMonth: 10,
        endMonth: 11,
        startHour: 0,
        endHour: 24,
        rateAgorotPerKwh: 45.57,
        effectiveFrom: JAN_2026,
        effectiveTo: null,
        notes:
          "IEC TAOZ autumn shoulder off-peak (Oct–Nov, all hours) — post-VAT, effective Jan 2026",
      },
    ];
    for (const r of taozRows) await ctx.db.insert("iecTaozRates", r);

    // ── 3. Suppliers (7) ──────────────────────────────────────────────────────
    const sup: Record<string, Id<"suppliers">> = {};

    for (const [seedId, name, logoFileName] of [
      ["bezek_energy", "Bezek Electricity", "bezekElectricity.webp"],
      ["superpower_electra", "Electra Power", "electraPower.webp"],
      ["hot_energy", "HOT Energy", "hotEnergy.webp"],
      ["partner_power", "Partner Electricity", "partnerElectricity.webp"],
      ["cellcom_energy", "Cellcom Energy", "cellcomEnergy.webp"],
      ["amisragas", "Amisragas Electricity", "amisragasElectricity.webp"],
      ["pazgaz", "Pazgaz Electricity", "pazgazElectricity.webp"],
    ] as const) {
      sup[seedId] = await ctx.db.insert("suppliers", {
        name,
        logoFileName,
        isActive: true,
        supportedHandoffTypes:
          seedId === "superpower_electra"
            ? ["clickThrough", "formHandoff"]
            : ["formHandoff"],
        payoutTrigger: "perSignedContract",
        payoutStates: PAYOUT_STATES,
        initialPayoutState: "pending",
      });
    }

    // ── 4. Plans (19) ─────────────────────────────────────────────────────────
    const plan: Record<string, Id<"plans">> = {};

    for (const [seedId, supplierId, name, planType] of [
      ["electra_day_21", "superpower_electra", "Electra Day", "day"],
      ["electra_night_21", "superpower_electra", "Electra Night Plus", "night"],
      ["electra_day_12_12x12", "superpower_electra", "Electra 12x12", "day"],
      ["electra_fixed_6_5", "superpower_electra", "Electra Power", "fixed"],
      ["cellcom_day_20", "cellcom_energy", "Cellcom Worthwhile Savings", "day"],
      ["cellcom_night_18", "cellcom_energy", "Cellcom Family Savers", "night"],
      ["cellcom_night_15", "cellcom_energy", "Cellcom Night", "night"],
      ["cellcom_fixed_6", "cellcom_energy", "Cellcom Savings Plus", "fixed"],
      ["bezek_night_20", "bezek_energy", "Bezek Night", "night"],
      ["bezek_day_15", "bezek_energy", "Bezek Day", "day"],
      ["bezek_fixed_6", "bezek_energy", "Bezek Fixed", "fixed"],
      ["hot_night_20", "hot_energy", "HOT Night", "night"],
      ["hot_day_15", "hot_energy", "HOT Day", "day"],
      ["hot_fixed_5", "hot_energy", "HOT Fixed", "fixed"],
      ["partner_night_20", "partner_power", "Partner Night Owls", "night"],
      ["partner_day_15", "partner_power", "Partner Work From Home", "day"],
      ["partner_fixed_tiered", "partner_power", "Partner Fixed", "fixed"],
      [
        "pazgaz_fixed_10_yellow",
        "pazgaz",
        "Pazgaz Yellow Accumulation",
        "fixed",
      ],
      ["pazgaz_fixed_6", "pazgaz", "Pazgaz Fixed", "fixed"],
      ["hot_fixed_6_savers", "hot_energy", "HOT Fixed Savers", "fixed"],
      ["amisragas_fixed_7", "amisragas", "Amisragas Fixed", "fixed"],
    ] as const) {
      plan[seedId] = await ctx.db.insert("plans", {
        supplierId: sup[supplierId],
        name,
        planType,
      });
    }

    // ── 5. Plan versions (19) ─────────────────────────────────────────────────
    type PVSeed = {
      planSeedId: string;
      discountPercent: number;
      annualSavingsCapAgorot?: number;
      benefitDelivery: "billDiscount" | "appCredit";
      discountWindowStartHour?: number;
      discountWindowEndHour?: number;
      weekdayWindowOnly: boolean;
      eligibility: {
        requiresSmartMeter: boolean;
        membershipRequired: string | null;
        residentialOnly: boolean;
        coverageAreas: string[];
      };
    };

    const pvSeeds: PVSeed[] = [
      {
        planSeedId: "electra_day_21",
        discountPercent: 21,
        benefitDelivery: "billDiscount",
        discountWindowStartHour: 7,
        discountWindowEndHour: 17,
        weekdayWindowOnly: true,
        eligibility: {
          requiresSmartMeter: true,
          membershipRequired: null,
          residentialOnly: true,
          coverageAreas: [],
        },
      },
      {
        planSeedId: "electra_night_21",
        discountPercent: 21,
        benefitDelivery: "billDiscount",
        discountWindowStartHour: 23,
        discountWindowEndHour: 7,
        weekdayWindowOnly: true,
        eligibility: {
          requiresSmartMeter: true,
          membershipRequired: null,
          residentialOnly: true,
          coverageAreas: [],
        },
      },
      {
        planSeedId: "electra_day_12_12x12",
        discountPercent: 12,
        benefitDelivery: "billDiscount",
        discountWindowStartHour: 5,
        discountWindowEndHour: 17,
        weekdayWindowOnly: false,
        eligibility: {
          requiresSmartMeter: true,
          membershipRequired: null,
          residentialOnly: true,
          coverageAreas: [],
        },
      },
      {
        planSeedId: "electra_fixed_6_5",
        discountPercent: 6.5,
        benefitDelivery: "billDiscount",
        weekdayWindowOnly: false,
        eligibility: {
          requiresSmartMeter: false,
          membershipRequired: null,
          residentialOnly: true,
          coverageAreas: [],
        },
      },
      {
        planSeedId: "cellcom_day_20",
        discountPercent: 20,
        benefitDelivery: "billDiscount",
        discountWindowStartHour: 7,
        discountWindowEndHour: 17,
        weekdayWindowOnly: true,
        eligibility: {
          requiresSmartMeter: true,
          membershipRequired: null,
          residentialOnly: true,
          coverageAreas: [],
        },
      },
      {
        planSeedId: "cellcom_night_18",
        discountPercent: 18,
        benefitDelivery: "billDiscount",
        discountWindowStartHour: 20,
        discountWindowEndHour: 2,
        weekdayWindowOnly: true,
        eligibility: {
          requiresSmartMeter: true,
          membershipRequired: null,
          residentialOnly: true,
          coverageAreas: [],
        },
      },
      {
        planSeedId: "cellcom_night_15",
        discountPercent: 15,
        benefitDelivery: "billDiscount",
        discountWindowStartHour: 23,
        discountWindowEndHour: 7,
        weekdayWindowOnly: false,
        eligibility: {
          requiresSmartMeter: true,
          membershipRequired: null,
          residentialOnly: true,
          coverageAreas: [],
        },
      },
      {
        planSeedId: "cellcom_fixed_6",
        discountPercent: 6,
        benefitDelivery: "billDiscount",
        weekdayWindowOnly: false,
        eligibility: {
          requiresSmartMeter: false,
          membershipRequired: null,
          residentialOnly: true,
          coverageAreas: [],
        },
      },
      {
        planSeedId: "bezek_night_20",
        discountPercent: 20,
        benefitDelivery: "billDiscount",
        discountWindowStartHour: 23,
        discountWindowEndHour: 7,
        weekdayWindowOnly: true,
        eligibility: {
          requiresSmartMeter: true,
          membershipRequired: null,
          residentialOnly: true,
          coverageAreas: [],
        },
      },
      {
        planSeedId: "bezek_day_15",
        discountPercent: 15,
        benefitDelivery: "billDiscount",
        discountWindowStartHour: 7,
        discountWindowEndHour: 17,
        weekdayWindowOnly: true,
        eligibility: {
          requiresSmartMeter: true,
          membershipRequired: null,
          residentialOnly: true,
          coverageAreas: [],
        },
      },
      {
        planSeedId: "bezek_fixed_6",
        discountPercent: 6,
        benefitDelivery: "billDiscount",
        weekdayWindowOnly: false,
        eligibility: {
          requiresSmartMeter: false,
          membershipRequired: null,
          residentialOnly: true,
          coverageAreas: [],
        },
      },
      {
        planSeedId: "hot_night_20",
        discountPercent: 20,
        benefitDelivery: "billDiscount",
        discountWindowStartHour: 23,
        discountWindowEndHour: 7,
        weekdayWindowOnly: true,
        eligibility: {
          requiresSmartMeter: true,
          membershipRequired: null,
          residentialOnly: true,
          coverageAreas: [],
        },
      },
      {
        planSeedId: "hot_day_15",
        discountPercent: 15,
        benefitDelivery: "billDiscount",
        discountWindowStartHour: 7,
        discountWindowEndHour: 17,
        weekdayWindowOnly: true,
        eligibility: {
          requiresSmartMeter: true,
          membershipRequired: null,
          residentialOnly: true,
          coverageAreas: [],
        },
      },
      {
        planSeedId: "hot_fixed_5",
        discountPercent: 5,
        benefitDelivery: "billDiscount",
        weekdayWindowOnly: false,
        eligibility: {
          requiresSmartMeter: false,
          membershipRequired: null,
          residentialOnly: true,
          coverageAreas: [],
        },
      },
      {
        planSeedId: "partner_night_20",
        discountPercent: 20,
        benefitDelivery: "billDiscount",
        discountWindowStartHour: 23,
        discountWindowEndHour: 7,
        weekdayWindowOnly: true,
        eligibility: {
          requiresSmartMeter: true,
          membershipRequired: null,
          residentialOnly: true,
          coverageAreas: [],
        },
      },
      {
        planSeedId: "partner_day_15",
        discountPercent: 15,
        benefitDelivery: "billDiscount",
        discountWindowStartHour: 7,
        discountWindowEndHour: 17,
        weekdayWindowOnly: true,
        eligibility: {
          requiresSmartMeter: true,
          membershipRequired: null,
          residentialOnly: true,
          coverageAreas: [],
        },
      },
      {
        planSeedId: "partner_fixed_tiered",
        discountPercent: 6,
        benefitDelivery: "billDiscount",
        weekdayWindowOnly: false,
        eligibility: {
          requiresSmartMeter: false,
          membershipRequired: null,
          residentialOnly: true,
          coverageAreas: [],
        },
      },
      {
        planSeedId: "pazgaz_fixed_10_yellow",
        discountPercent: 10,
        annualSavingsCapAgorot: 60000,
        benefitDelivery: "appCredit",
        weekdayWindowOnly: false,
        eligibility: {
          requiresSmartMeter: false,
          membershipRequired: null,
          residentialOnly: true,
          coverageAreas: [],
        },
      },
      {
        planSeedId: "pazgaz_fixed_6",
        discountPercent: 6,
        benefitDelivery: "billDiscount",
        weekdayWindowOnly: false,
        eligibility: {
          requiresSmartMeter: false,
          membershipRequired: null,
          residentialOnly: true,
          coverageAreas: [],
        },
      },
      {
        planSeedId: "hot_fixed_6_savers",
        discountPercent: 6,
        benefitDelivery: "billDiscount",
        weekdayWindowOnly: false,
        eligibility: {
          requiresSmartMeter: false,
          membershipRequired: "HOT, Next, or HOT Mobile",
          residentialOnly: true,
          coverageAreas: [],
        },
      },
      {
        planSeedId: "amisragas_fixed_7",
        discountPercent: 7,
        benefitDelivery: "billDiscount",
        weekdayWindowOnly: false,
        eligibility: {
          requiresSmartMeter: false,
          membershipRequired: "Amisragas",
          residentialOnly: true,
          coverageAreas: [],
        },
      },
    ];

    for (const pv of pvSeeds) {
      await ctx.db.insert("planVersions", {
        planId: plan[pv.planSeedId],
        effectiveFrom: JAN_2024,
        effectiveTo: null,
        discountPercent: pv.discountPercent,
        ...(pv.annualSavingsCapAgorot !== undefined && {
          annualSavingsCapAgorot: pv.annualSavingsCapAgorot,
        }),
        benefitDelivery: pv.benefitDelivery,
        ...(pv.discountWindowStartHour !== undefined && {
          discountWindowStartHour: pv.discountWindowStartHour,
        }),
        ...(pv.discountWindowEndHour !== undefined && {
          discountWindowEndHour: pv.discountWindowEndHour,
        }),
        weekdayWindowOnly: pv.weekdayWindowOnly,
        eligibility: pv.eligibility,
      });
    }

    return `seeded: 1 iecRate, 6 iecTaozRates, 7 suppliers, 21 plans, 21 planVersions`;
  },
});

export const clear = internalMutation({
  args: {},
  handler: async (ctx) => {
    const tables = [
      "evaluatedPlanVersions",
      "recommendations",
      "billImports",
      "homeProfiles",
      "sessions",
      "parsingConfidenceStats",
      "referrals",
      "leads",
      "planVersions",
      "plans",
      "suppliers",
      "iecTaozRates",
      "iecRates",
    ] as const;
    const counts: Record<string, number> = {};
    for (const table of tables) {
      const rows = await ctx.db.query(table).take(500);
      for (const row of rows) await ctx.db.delete(table as any, row._id);
      counts[table] = rows.length;
    }
    return counts;
  },
});
