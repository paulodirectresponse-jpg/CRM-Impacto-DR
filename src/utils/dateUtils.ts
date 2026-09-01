/**
 * Date and Timezone Utilities for America/Sao_Paulo
 */

export const SAO_PAULO_TZ = "America/Sao_Paulo";

/**
 * Returns current ISO timestamp
 */
export function getCurrentIso(): string {
  return new Date().toISOString();
}

/**
 * Formats an ISO string or Date to Brazilian display date "dd/mm/aaaa"
 */
export function formatBrDate(isoString?: string | null): string {
  if (!isoString) return "-";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "-";
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: SAO_PAULO_TZ,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  } catch {
    return "-";
  }
}

/**
 * Formats an ISO string or Date to Brazilian display date + 24h time "dd/mm/aaaa HH:mm"
 */
export function formatBrDateTime(isoString?: string | null): string {
  if (!isoString) return "-";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "-";
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: SAO_PAULO_TZ,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  } catch {
    return "-";
  }
}

export const formatSaoPauloDateTime = formatBrDateTime;

/**
 * Gets YYYY-MM-DD in America/Sao_Paulo for any given Date or ISO string
 */
export function getSaoPauloDateString(isoStringOrDate: string | Date = new Date()): string {
  const d = typeof isoStringOrDate === "string" ? new Date(isoStringOrDate) : isoStringOrDate;
  if (isNaN(d.getTime())) return "";
  
  // Format to parts in Sao Paulo timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: SAO_PAULO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(d);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

/**
 * Checks if a given timestamp falls on today in America/Sao_Paulo
 */
export function isTodayInSaoPaulo(isoString?: string | null): boolean {
  if (!isoString) return false;
  return getSaoPauloDateString(isoString) === getSaoPauloDateString(new Date());
}

/**
 * Checks if a given timestamp falls within an ISO interval (inclusive start, inclusive end)
 */
export function isWithinInterval(
  isoString: string | undefined | null,
  startIso: string,
  endIso: string
): boolean {
  if (!isoString) return false;
  const t = new Date(isoString).getTime();
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return t >= start && t <= end;
}

/**
 * Returns start and end timestamps (ISO) for named periods in America/Sao_Paulo
 */
export function getPeriodInterval(
  type: "today" | "yesterday" | "thisWeek" | "last7days" | "thisMonth" | "lastMonth" | "all" | "custom" | string,
  customStart?: string,
  customEnd?: string
): { startIso: string; endIso: string } {
  const now = new Date();
  const todayStr = getSaoPauloDateString(now); // "YYYY-MM-DD"
  const [year, month, day] = todayStr.split("-").map(Number);

  if (type === "today") {
    const startIso = new Date(`${todayStr}T00:00:00.000-03:00`).toISOString();
    const endIso = new Date(`${todayStr}T23:59:59.999-03:00`).toISOString();
    return { startIso, endIso };
  }

  if (type === "yesterday") {
    const yestDate = new Date(`${todayStr}T00:00:00.000-03:00`);
    yestDate.setDate(yestDate.getDate() - 1);
    const yestStr = getSaoPauloDateString(yestDate);
    const startIso = new Date(`${yestStr}T00:00:00.000-03:00`).toISOString();
    const endIso = new Date(`${yestStr}T23:59:59.999-03:00`).toISOString();
    return { startIso, endIso };
  }

  if (type === "thisWeek" || type === "last7days") {
    const endIso = new Date(`${todayStr}T23:59:59.999-03:00`).toISOString();
    const pastDate = new Date(`${todayStr}T00:00:00.000-03:00`);
    pastDate.setDate(pastDate.getDate() - 6);
    const pastDateStr = getSaoPauloDateString(pastDate);
    const startIso = new Date(`${pastDateStr}T00:00:00.000-03:00`).toISOString();
    return { startIso, endIso };
  }

  if (type === "thisMonth") {
    const startMonthStr = `${year}-${String(month).padStart(2, "0")}-01`;
    const startIso = new Date(`${startMonthStr}T00:00:00.000-03:00`).toISOString();
    const endIso = new Date(`${todayStr}T23:59:59.999-03:00`).toISOString();
    return { startIso, endIso };
  }

  if (type === "lastMonth") {
    const lastMonthDate = new Date(year, month - 2, 1);
    const lastMonthYear = lastMonthDate.getFullYear();
    const lastMonthNum = lastMonthDate.getMonth() + 1;
    const lastDayOfLastMonth = new Date(year, month - 1, 0).getDate();
    
    const startIso = new Date(
      `${lastMonthYear}-${String(lastMonthNum).padStart(2, "0")}-01T00:00:00.000-03:00`
    ).toISOString();
    const endIso = new Date(
      `${lastMonthYear}-${String(lastMonthNum).padStart(2, "0")}-${String(lastDayOfLastMonth).padStart(2, "0")}T23:59:59.999-03:00`
    ).toISOString();
    return { startIso, endIso };
  }

  if (type === "all") {
    const startIso = new Date("2020-01-01T00:00:00.000-03:00").toISOString();
    const endIso = new Date("2099-12-31T23:59:59.999-03:00").toISOString();
    return { startIso, endIso };
  }

  // Custom
  const s = customStart || todayStr;
  const e = customEnd || todayStr;
  const startIso = new Date(`${s}T00:00:00.000-03:00`).toISOString();
  const endIso = new Date(`${e}T23:59:59.999-03:00`).toISOString();
  return { startIso, endIso };
}
