"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Brief } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { EmptyState } from "./ui";

// Client component. Filters the full brief list by free-text term + date range,
// client-side over the fetched recap/body_markdown/deep_cut_topic.

export default function SearchableArchive({ briefs }: { briefs: Brief[] }) {
  const [term, setTerm] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    return briefs.filter((b) => {
      if (from && b.week_of < from) return false;
      if (to && b.week_of > to) return false;
      if (!q) return true;
      const haystack = [
        b.recap ?? "",
        b.body_markdown ?? "",
        b.deep_cut_topic ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [briefs, term, from, to]);

  return (
    <div className="space-y-5">
      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="mb-1 block text-xs font-medium text-gray-500">
            Search
          </span>
          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search recaps and full briefs…"
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-950 outline-none focus:border-gray-950"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-gray-500">
            From
          </span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-950 outline-none focus:border-gray-950 tnum"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-gray-500">
            To
          </span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-950 outline-none focus:border-gray-950 tnum"
          />
        </label>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-400">
        <span className="tnum">
          {filtered.length} of {briefs.length} briefs
        </span>
        {(term || from || to) && (
          <button
            type="button"
            onClick={() => {
              setTerm("");
              setFrom("");
              setTo("");
            }}
            className="text-gray-500 underline-offset-2 hover:text-gray-950 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {briefs.length === 0 ? (
        <EmptyState message="No briefs published yet." />
      ) : filtered.length === 0 ? (
        <EmptyState message="No briefs match your filters." />
      ) : (
        <ul className="space-y-3">
          {filtered.map((b) => (
            <li key={b.id}>
              <Link
                href={`/brief/${b.week_of}`}
                className="block rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-gray-400"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold text-gray-950 tnum">
                    {formatDate(b.week_of)}
                  </span>
                  {b.deep_cut_topic ? (
                    <span className="text-[11px] uppercase tracking-wide text-gray-400">
                      {b.deep_cut_topic}
                    </span>
                  ) : null}
                </div>
                {b.recap ? (
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-gray-500">
                    {b.recap}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
