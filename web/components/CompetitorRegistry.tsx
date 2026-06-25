"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Competitor } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { EmptyState } from "./ui";

// Client component. Sortable table of competitors. Rows link to mention history.

type SortKey = "name" | "type" | "location" | "last_seen_week";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "type", label: "Type" },
  { key: "location", label: "Location" },
  { key: "last_seen_week", label: "Last Seen" },
];

export default function CompetitorRegistry({
  competitors,
}: {
  competitors: Competitor[];
}) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("last_seen_week");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const copy = [...competitors];
    copy.sort((a, b) => {
      const av = (a[sortKey] ?? "") as string;
      const bv = (b[sortKey] ?? "") as string;
      const cmp = av.localeCompare(bv);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [competitors, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "last_seen_week" ? "desc" : "asc");
    }
  }

  if (competitors.length === 0) {
    return <EmptyState message="No competitors registered yet." />;
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left">
              {COLUMNS.map((col) => {
                const active = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.1em] text-gray-400"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="inline-flex items-center gap-1 hover:text-gray-950"
                    >
                      {col.label}
                      <span className="text-[10px]">
                        {active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </button>
                  </th>
                );
              })}
              <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.1em] text-gray-400">
                Last Action
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => (
              <tr
                key={c.id}
                onClick={() => router.push(`/competitor/${c.id}`)}
                className="cursor-pointer border-b border-gray-100 transition-colors last:border-0 hover:bg-gray-100"
              >
                <td className="px-4 py-3 font-medium text-gray-950">
                  {c.name}
                </td>
                <td className="px-4 py-3 text-gray-500">{c.type ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500">
                  {c.location ?? "—"}
                </td>
                <td className="px-4 py-3 text-gray-500 tnum">
                  {formatDate(c.last_seen_week)}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {c.last_action ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
