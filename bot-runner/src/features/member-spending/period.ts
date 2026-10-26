import type { MemberSpendingMonthlySettings } from "../../types.js";

export function monthlySettings(config: Readonly<Record<string, unknown>>): MemberSpendingMonthlySettings {
  const day = config.SPENDING_MONTHLY_START_DAY;
  return { enabled: config.SPENDING_MONTHLY_ENABLED === true,
    startDay: typeof day === "number" && Number.isInteger(day) && day >= 1 && day <= 31 ? day : 1 };
}

/** YYYY-MM labels the month in which the spending cycle starts, in Thailand time. */
export function spendingMonth(date = new Date(), startDay = 1): string {
  if (!Number.isInteger(startDay) || startDay < 1 || startDay > 31) throw new Error("วันเริ่มรอบต้องเป็นวันที่ 1–31");
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  let year = Number(parts.find(p => p.type === "year")!.value), month = Number(parts.find(p => p.type === "month")!.value);
  const day = Number(parts.find(p => p.type === "day")!.value);
  const boundary = Math.min(startDay, new Date(Date.UTC(year, month, 0)).getUTCDate());
  if (day < boundary && --month === 0) { month = 12; year--; }
  return `${year}-${String(month).padStart(2, "0")}`;
}
