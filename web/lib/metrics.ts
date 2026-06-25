import type { MetricKey } from "./types";

export const METRIC_KEYS: MetricKey[] = [
  "fed_funds",
  "sba_7a_effective",
  "prime",
  "conventional_acq_rate",
  "ten_year_treasury",
];

export const METRIC_LABELS: Record<MetricKey, string> = {
  fed_funds: "Fed Funds",
  sba_7a_effective: "SBA 7(a) Effective",
  prime: "Prime Rate",
  conventional_acq_rate: "Conventional Acq.",
  ten_year_treasury: "10-Year Treasury",
};

// The four "core" rates surfaced as stat tiles (everything except the overlap
// pair gets shown; here we show all five but order them deliberately).
export const CORE_METRIC_ORDER: MetricKey[] = [
  "sba_7a_effective",
  "conventional_acq_rate",
  "prime",
  "fed_funds",
  "ten_year_treasury",
];
