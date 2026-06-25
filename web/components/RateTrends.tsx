"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Metric, MetricKey } from "@/lib/types";
import { METRIC_KEYS, METRIC_LABELS } from "@/lib/metrics";
import { colors } from "@/lib/colors";
import { formatPercent, formatShortDate } from "@/lib/format";
import { EmptyState } from "./ui";

// Client component. Small-multiple sparkline-style line per metric, plus an
// overlay chart comparing SBA vs Conventional so the spread reads at a glance.

interface RatePoint {
  week_of: string;
  value: number;
}

interface OverlayPoint {
  week_of: string;
  sba_7a_effective: number | null;
  conventional_acq_rate: number | null;
}

function buildSeries(metrics: Metric[]): Record<MetricKey, RatePoint[]> {
  const out: Record<string, RatePoint[]> = {};
  for (const key of METRIC_KEYS) out[key] = [];
  for (const m of metrics) {
    if (m.value != null && METRIC_KEYS.includes(m.metric_key)) {
      out[m.metric_key].push({ week_of: m.week_of, value: m.value });
    }
  }
  return out as Record<MetricKey, RatePoint[]>;
}

function MiniChart({
  data,
  label,
}: {
  data: RatePoint[];
  label: string;
}) {
  const latest = data.length ? data[data.length - 1].value : null;
  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-[0.1em] text-gray-400">
          {label}
        </span>
        <span className="text-lg font-semibold text-gray-950 tnum">
          {formatPercent(latest)}
        </span>
      </div>
      <div className="mt-3 h-16">
        {data.length >= 2 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
            >
              <Line
                type="monotone"
                dataKey="value"
                stroke={colors.accent}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
              <Tooltip
                cursor={{ stroke: colors.gray300 }}
                contentStyle={{
                  border: `1px solid ${colors.gray200}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(v) => formatShortDate(String(v))}
                formatter={(v: number) => [formatPercent(v), label]}
              />
              <XAxis dataKey="week_of" hide />
              <YAxis hide domain={["dataMin", "dataMax"]} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center text-xs text-gray-400">
            {data.length === 1 ? "Single reading" : "No data yet"}
          </div>
        )}
      </div>
    </div>
  );
}

export default function RateTrends({ metrics }: { metrics: Metric[] }) {
  const series = useMemo(() => buildSeries(metrics), [metrics]);

  const overlay = useMemo<OverlayPoint[]>(() => {
    const byWeek = new Map<string, OverlayPoint>();
    for (const m of metrics) {
      if (
        m.metric_key !== "sba_7a_effective" &&
        m.metric_key !== "conventional_acq_rate"
      ) {
        continue;
      }
      let row = byWeek.get(m.week_of);
      if (!row) {
        row = {
          week_of: m.week_of,
          sba_7a_effective: null,
          conventional_acq_rate: null,
        };
        byWeek.set(m.week_of, row);
      }
      if (m.metric_key === "sba_7a_effective") row.sba_7a_effective = m.value;
      else row.conventional_acq_rate = m.value;
    }
    return Array.from(byWeek.values()).sort((a, b) =>
      a.week_of < b.week_of ? -1 : 1
    );
  }, [metrics]);

  if (metrics.length === 0) {
    return <EmptyState message="No rate data yet." />;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {METRIC_KEYS.map((key) => (
          <MiniChart key={key} data={series[key]} label={METRIC_LABELS[key]} />
        ))}
      </div>

      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-950">
            SBA 7(a) vs Conventional — financing spread
          </span>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-0.5 w-4"
                style={{ backgroundColor: colors.accent }}
              />
              SBA 7(a)
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-0.5 w-4"
                style={{ backgroundColor: colors.gray400 }}
              />
              Conventional
            </span>
          </div>
        </div>
        <div className="h-64">
          {overlay.length >= 2 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={overlay}
                margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
              >
                <CartesianGrid stroke={colors.gray100} vertical={false} />
                <XAxis
                  dataKey="week_of"
                  tickFormatter={(v) => formatShortDate(String(v))}
                  tick={{ fill: colors.gray500, fontSize: 11 }}
                  stroke={colors.gray200}
                />
                <YAxis
                  tick={{ fill: colors.gray500, fontSize: 11 }}
                  stroke={colors.gray200}
                  tickFormatter={(v) => `${v}%`}
                  width={44}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  contentStyle={{
                    border: `1px solid ${colors.gray200}`,
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelFormatter={(v) => formatShortDate(String(v))}
                  formatter={(v: number, name: string) => [
                    formatPercent(v),
                    name === "sba_7a_effective" ? "SBA 7(a)" : "Conventional",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="sba_7a_effective"
                  stroke={colors.accent}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="conventional_acq_rate"
                  stroke={colors.gray400}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-400">
              Not enough data to chart the spread yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
