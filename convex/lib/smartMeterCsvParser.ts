// Pure smart-meter CSV parsing — no Convex server/runtime imports, so this
// module can be bundled into the browser as-is for the CHI-47 client-side POC.

export type TaozRateRow = {
  season: "summer" | "winter" | "shoulder";
  periodType: "peak" | "offPeak";
  startMonth: number;
  endMonth: number;
  startHour: number;
  endHour: number;
};

type TaozBucket =
  | "summerPeak"
  | "summerOffPeak"
  | "winterPeak"
  | "winterOffPeak"
  | "shoulderOffPeak";

export type ParsedSmartMeterCsv = {
  billingPeriodStart: number;
  billingPeriodEnd: number;
  totalKwh: number;
  kwhWeekdayDay: number;
  kwhWeekdayNight: number;
  kwhWeekendDay: number;
  kwhWeekendNight: number;
  kwhTaozSummerPeak: number;
  kwhTaozSummerOffPeak: number;
  kwhTaozWinterPeak: number;
  kwhTaozWinterOffPeak: number;
};

function isMonthInRange(
  month: number,
  startMonth: number,
  endMonth: number,
): boolean {
  return endMonth >= startMonth
    ? month >= startMonth && month <= endMonth
    : month >= startMonth || month <= endMonth;
}

function isHourInWindow(
  hour: number,
  startHour: number,
  endHour: number,
): boolean {
  // endHour=24 means all hours (shoulder, full-day window)
  return endHour > startHour
    ? hour >= startHour && hour < endHour
    : hour >= startHour || hour < endHour;
}

function getTaozBucket(
  month: number,
  hour: number,
  rates: TaozRateRow[],
): TaozBucket {
  for (const rate of rates) {
    if (!isMonthInRange(month, rate.startMonth, rate.endMonth)) continue;
    if (!isHourInWindow(hour, rate.startHour, rate.endHour)) continue;
    if (rate.season === "summer" && rate.periodType === "peak")
      return "summerPeak";
    if (rate.season === "summer") return "summerOffPeak";
    if (rate.season === "winter" && rate.periodType === "peak")
      return "winterPeak";
    if (rate.season === "winter") return "winterOffPeak";
    return "shoulderOffPeak";
  }
  return "shoulderOffPeak"; // fallback
}

export function parseSmartMeterCsvText(
  text: string,
  taozRates: TaozRateRow[],
): ParsedSmartMeterCsv {
  // Strip UTF-8 BOM if present
  const cleaned = text.startsWith("﻿") ? text.slice(1) : text;
  const lines = cleaned
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let kwhWeekdayDay = 0;
  let kwhWeekdayNight = 0;
  let kwhWeekendDay = 0;
  let kwhWeekendNight = 0;
  let kwhTaozSummerPeak = 0;
  let kwhTaozSummerOffPeak = 0;
  let kwhTaozWinterPeak = 0;
  let kwhTaozWinterOffPeak = 0;
  let totalKwh = 0;
  let minDate = Infinity;
  let maxDate = -Infinity;

  for (const line of lines) {
    // Format: "meterID","צריכה","DD/MM/YYYY","HH:MM",kWh,flag
    const parts = line.split(",");
    if (parts.length < 5) continue;

    const type = parts[1].replace(/"/g, "").trim();
    if (type !== "צריכה") continue;

    const dateStr = parts[2].replace(/"/g, "").trim();
    const timeStr = parts[3].replace(/"/g, "").trim();
    const kwhStr = parts[4].replace(/"/g, "").trim();

    const dateParts = dateStr.split("/");
    if (dateParts.length !== 3) continue;
    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10);
    const year = parseInt(dateParts[2], 10);
    if (isNaN(day) || isNaN(month) || isNaN(year)) continue;

    const timeParts = timeStr.split(":");
    const hour = parseInt(timeParts[0], 10);
    if (isNaN(hour)) continue;

    const kwh = parseFloat(kwhStr);
    if (isNaN(kwh)) continue;

    const dateTs = new Date(year, month - 1, day).getTime();
    if (dateTs < minDate) minDate = dateTs;
    if (dateTs > maxDate) maxDate = dateTs;

    // 0=Sun…6=Sat; Israeli convention: Fri(5)+Sat(6) = weekend
    const dayOfWeek = new Date(year, month - 1, day).getDay();
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
    const isDayBand = hour >= 7 && hour < 23;

    if (isWeekend) {
      if (isDayBand) kwhWeekendDay += kwh;
      else kwhWeekendNight += kwh;
    } else {
      if (isDayBand) kwhWeekdayDay += kwh;
      else kwhWeekdayNight += kwh;
    }
    totalKwh += kwh;

    const bucket = getTaozBucket(month, hour, taozRates);
    if (bucket === "summerPeak") kwhTaozSummerPeak += kwh;
    else if (bucket === "summerOffPeak") kwhTaozSummerOffPeak += kwh;
    else if (bucket === "winterPeak") kwhTaozWinterPeak += kwh;
    else kwhTaozWinterOffPeak += kwh; // winterOffPeak + shoulderOffPeak
  }

  if (!isFinite(minDate)) throw new Error("No valid rows parsed from CSV");

  return {
    billingPeriodStart: minDate,
    billingPeriodEnd: maxDate + 86_400_000,
    totalKwh,
    kwhWeekdayDay,
    kwhWeekdayNight,
    kwhWeekendDay,
    kwhWeekendNight,
    kwhTaozSummerPeak,
    kwhTaozSummerOffPeak,
    kwhTaozWinterPeak,
    kwhTaozWinterOffPeak,
  };
}
