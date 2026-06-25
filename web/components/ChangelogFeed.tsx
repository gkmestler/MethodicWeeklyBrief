import Link from "next/link";
import type { ChangelogEntry } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { EmptyState, StatusBadge } from "./ui";

// Server component. Chronological changelog (newest first), grouped by week.

export default function ChangelogFeed({
  entries,
  limit,
}: {
  entries: ChangelogEntry[];
  limit?: number;
}) {
  if (entries.length === 0) {
    return <EmptyState message="No changelog entries yet." />;
  }

  const shown = limit ? entries.slice(0, limit) : entries;

  // Group by week_of preserving newest-first order.
  const groups: { week: string; rows: ChangelogEntry[] }[] = [];
  for (const entry of shown) {
    const last = groups[groups.length - 1];
    if (last && last.week === entry.week_of) {
      last.rows.push(entry);
    } else {
      groups.push({ week: entry.week_of, rows: [entry] });
    }
  }

  return (
    <div className="card max-h-[560px] overflow-y-auto p-2">
      <ol className="relative ml-3 border-l border-gray-200">
        {groups.map((group) => (
          <li key={group.week} className="mb-2">
            <div className="sticky top-0 z-[1] bg-white/95 px-4 py-2 backdrop-blur">
              <Link
                href={`/brief/${group.week}`}
                className="text-xs font-semibold uppercase tracking-[0.1em] text-gray-500 hover:text-gray-950 tnum"
              >
                {formatDate(group.week)}
              </Link>
            </div>
            <ul className="space-y-2 px-4 pb-3">
              {group.rows.map((row) => (
                <li key={row.id} className="relative">
                  <span className="absolute -left-[22px] top-1.5 h-2 w-2 -translate-x-1/2 rounded-full border border-gray-300 bg-white" />
                  <div className="flex items-start gap-2">
                    <StatusBadge status={row.change_type} />
                    <p className="text-sm leading-relaxed text-gray-700">
                      {row.text}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
