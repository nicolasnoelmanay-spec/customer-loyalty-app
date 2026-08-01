export type CompletedOrderPeriod = "daily" | "weekly" | "monthly" | "yearly";

export const COMPLETED_ORDER_PERIODS: {
  value: CompletedOrderPeriod;
  label: string;
}[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const MANILA_TZ = "Asia/Manila";

export interface ManilaYmd {
  year: number;
  month: number;
  day: number;
}

export function toManilaYmd(iso: string): ManilaYmd {
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));

  const [year, month, day] = formatted.split("-").map(Number);
  return { year, month, day };
}

export function getManilaTodayYmd(now: Date = new Date()): ManilaYmd {
  return toManilaYmd(now.toISOString());
}

export function ymdToReferenceDate({ year, month, day }: ManilaYmd): Date {
  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function formatYmdForDateInput({ year, month, day }: ManilaYmd): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatYmdForMonthInput({ year, month }: ManilaYmd): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function getManilaWeekStartKey(iso: string): string {
  const { year, month, day } = toManilaYmd(iso);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = date.getUTCDay();
  const daysFromMonday = (dayOfWeek + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysFromMonday);

  return [
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  ].join("-");
}

export function isCompletedOrderInPeriod(
  completedAt: string,
  period: CompletedOrderPeriod,
  reference: Date
): boolean {
  const order = toManilaYmd(completedAt);
  const current = toManilaYmd(reference.toISOString());

  switch (period) {
    case "daily":
      return (
        order.year === current.year &&
        order.month === current.month &&
        order.day === current.day
      );
    case "weekly":
      return (
        getManilaWeekStartKey(completedAt) ===
        getManilaWeekStartKey(reference.toISOString())
      );
    case "monthly":
      return order.year === current.year && order.month === current.month;
    case "yearly":
      return order.year === current.year;
  }
}

function isSameManilaYmd(a: ManilaYmd, b: ManilaYmd): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

export function isCurrentPeriodSelection(
  period: CompletedOrderPeriod,
  referenceYmd: ManilaYmd,
  now: Date = new Date()
): boolean {
  const today = getManilaTodayYmd(now);
  const reference = ymdToReferenceDate(referenceYmd);

  switch (period) {
    case "daily":
      return isSameManilaYmd(referenceYmd, today);
    case "weekly":
      return (
        getManilaWeekStartKey(reference.toISOString()) ===
        getManilaWeekStartKey(now.toISOString())
      );
    case "monthly":
      return referenceYmd.year === today.year && referenceYmd.month === today.month;
    case "yearly":
      return referenceYmd.year === today.year;
  }
}

export function getCompletedOrderPeriodLabel(
  period: CompletedOrderPeriod,
  referenceYmd: ManilaYmd,
  now: Date = new Date()
): string {
  if (isCurrentPeriodSelection(period, referenceYmd, now)) {
    switch (period) {
      case "daily":
        return "today";
      case "weekly":
        return "this week";
      case "monthly":
        return "this month";
      case "yearly":
        return "this year";
    }
  }

  switch (period) {
    case "daily":
      return "on selected day";
    case "weekly":
      return "for selected week";
    case "monthly":
      return "for selected month";
    case "yearly":
      return "for selected year";
  }
}

export function getCompletedOrderPeriodRangeLabel(
  period: CompletedOrderPeriod,
  reference: Date
): string {
  const current = toManilaYmd(reference.toISOString());

  switch (period) {
    case "daily":
      return new Intl.DateTimeFormat("en-PH", {
        timeZone: MANILA_TZ,
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(reference);
    case "weekly": {
      const [year, month, day] = getManilaWeekStartKey(reference.toISOString())
        .split("-")
        .map(Number);
      const weekStart = new Date(Date.UTC(year, month - 1, day, 12));
      const weekEnd = new Date(Date.UTC(year, month - 1, day + 6, 12));
      const fmt = new Intl.DateTimeFormat("en-PH", {
        timeZone: MANILA_TZ,
        month: "short",
        day: "numeric",
      });
      const yearFmt = new Intl.DateTimeFormat("en-PH", {
        timeZone: MANILA_TZ,
        year: "numeric",
      });
      return `${fmt.format(weekStart)} – ${fmt.format(weekEnd)}, ${yearFmt.format(weekEnd)}`;
    }
    case "monthly":
      return new Intl.DateTimeFormat("en-PH", {
        timeZone: MANILA_TZ,
        month: "long",
        year: "numeric",
      }).format(reference);
    case "yearly":
      return String(current.year);
  }
}
