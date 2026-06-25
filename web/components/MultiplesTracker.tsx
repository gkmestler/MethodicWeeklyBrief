"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Cell,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { Comp } from "@/lib/types";
import { colors } from "@/lib/colors";
import { formatDate, formatMultiple, formatShortDate } from "@/lib/format";
import { EmptyState } from "./ui";

// Client component. Scatter of every comp's multiple over time with the
// 3.0x–4.0x buy-box drawn as a shaded reference band. Filter by trade.

const BUY_BOX_LOW = 3.0;
const BUY_BOX_HIGH = 4.0;

interface CompPoint {
  t: number; // epoch ms for the x axis
  multiple: number;
  company_name: string | null;
  trade: string | null;
  week_of: string;
}

export default function MultiplesTracker({ comps }: { comps: Comp[] }) {
  const [trade, setTrade] = useState<string>("all");

  const trades = useMemo(() => {
    const set = new Set<string>();
    for (const c of comps) if (c.trade) set.add(c.trade);
    return Array.from(set).sort();
  }, [comps]);

  const points = useMemo<CompPoint[]>(() => {
    return comps
      .filter((c) => c.multiple != null && c.week_of)
      .filter((c) => trade === "all" || c.trade === trade)
      .map((c) => {
        const [y, m, d] = c.week_of.slice(0, 10).split("-").map(Number);
        return {
          t: new Date(y, (m || 1) - 1, d || 1).getTime(),
          multiple: c.multiple as number,
          company_name: c.company_name,
          trade: c.trade,
          week_of: c.week_of,
        };
      })
      .sort((a, b) => a.t - b.t);
  }, [comps, trade]);

  const yMax = useMemo(() => {
    const max = points.reduce((acc, p) => Math.max(acc, p.multiple), BUY_BOX_HIGH);
    return Math.ceil((max + 0.5) * 2) / 2;
  }, [points]);

  if (comps.length === 0) {
    return <EmptyState message="No comps tracked yet." />;
  }

  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: colors.accent }}
            />
            comp multiple
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-4 rounded-sm"
              style={{ backgroundColor: colors.up, opacity: 0.18 }}
            />
            buy box {BUY_BOX_LOW.toFixed(1)}x–{BUY_BOX_HIGH.toFixed(1)}x
          </span>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-gray-400">Trade</span>
          <select
            value={trade}
            onChange={(e) => setTrade(e.target.value)}
            className="rounded-md border border-gray-200 bg-white px-2 py-1 text-sm text-gray-950 outline-none focus:border-gray-950"
          >
            <option value="all">All trades</option>
            {trades.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="h-72">
        {points.length >= 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke={colors.gray100} />
              <ReferenceArea
                y1={BUY_BOX_LOW}
                y2={BUY_BOX_HIGH}
                fill={colors.up}
                fillOpacity={0.12}
                stroke={colors.up}
                strokeOpacity={0.3}
              />
              <XAxis
                type="number"
                dataKey="t"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(v) =>
                  formatShortDate(new Date(v).toISOString())
                }
                tick={{ fill: colors.gray500, fontSize: 11 }}
                stroke={colors.gray200}
                name="Week"
              />
              <YAxis
                type="number"
                dataKey="multiple"
                domain={[0, yMax]}
                tickFormatter={(v) => `${v}x`}
                tick={{ fill: colors.gray500, fontSize: 11 }}
                stroke={colors.gray200}
                width={40}
                name="Multiple"
              />
              <ZAxis range={[60, 60]} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3", stroke: colors.gray300 }}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const p = payload[0].payload as CompPoint;
                  return (
                    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
                      <div className="font-medium text-gray-950">
                        {p.company_name ?? "Comp"}
                      </div>
                      {p.trade ? (
                        <div className="text-gray-500">{p.trade}</div>
                      ) : null}
                      <div className="mt-1 tnum text-gray-950">
                        {formatMultiple(p.multiple)}
                      </div>
                      <div className="text-gray-400">
                        {formatDate(p.week_of)}
                      </div>
                    </div>
                  );
                }}
              />
              <Scatter data={points} fill={colors.accent}>
                {points.map((p, i) => {
                  const inBox =
                    p.multiple >= BUY_BOX_LOW && p.multiple <= BUY_BOX_HIGH;
                  return (
                    <Cell
                      key={i}
                      fill={inBox ? colors.up : colors.accent}
                    />
                  );
                })}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            No comps for this trade.
          </div>
        )}
      </div>
    </div>
  );
}
