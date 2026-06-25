// Formatting helpers. Clean currency / percent / date rendering with
// tabular figures handled in CSS. All tolerant of null/undefined.

export function formatCurrency(
  value: number | null | undefined,
  opts: { maximumFractionDigits?: number } = {}
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: opts.maximumFractionDigits ?? 0,
  }).format(value);
}

export function formatCompactCurrency(
  value: number | null | undefined
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatPercent(
  value: number | null | undefined,
  digits = 2
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function formatMultiple(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(2)}x`;
}

export function formatNumber(
  value: number | null | undefined,
  digits = 0
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

// Parse a yyyy-mm-dd date string as a local date (avoid UTC shift).
function parseLocalDate(value: string): Date | null {
  if (!value) return null;
  const datePart = value.slice(0, 10);
  const [y, m, d] = datePart.split("-").map(Number);
  if (!y || !m || !d) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  return new Date(y, m - 1, d);
}

// "Jun 23, 2026"
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = parseLocalDate(value);
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

// Short axis-friendly date, e.g. "Jun 23"
export function formatShortDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = parseLocalDate(value);
  if (!d) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(d);
}

export function formatSignedDelta(
  delta: number | null | undefined,
  suffix = ""
): string {
  if (delta === null || delta === undefined || Number.isNaN(delta)) return "—";
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
  return `${sign}${Math.abs(delta).toFixed(2)}${suffix}`;
}
