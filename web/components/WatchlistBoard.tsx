import Link from "next/link";
import type { WatchlistItem, WatchlistStatus } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { EmptyState, StatusBadge } from "./ui";

// Server component. Status board grouped into open / updated / closed columns.

const COLUMNS: { status: WatchlistStatus; label: string }[] = [
  { status: "open", label: "Open" },
  { status: "updated", label: "Updated" },
  { status: "closed", label: "Closed" },
];

function ItemCard({ item }: { item: WatchlistItem }) {
  return (
    <Link
      href={`/watchlist/${item.id}`}
      className="block rounded-lg border border-gray-200 bg-white p-3 transition-colors hover:border-gray-400"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium leading-snug text-gray-950">
          {item.title ?? item.id}
        </span>
      </div>
      {item.category ? (
        <span className="mt-1 block text-[11px] uppercase tracking-wide text-gray-400">
          {item.category}
        </span>
      ) : null}
      {item.current_summary ? (
        <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-gray-500">
          {item.current_summary}
        </p>
      ) : null}
      <div className="mt-2 text-[11px] text-gray-400 tnum">
        Updated {formatDate(item.last_updated_week)}
      </div>
    </Link>
  );
}

export default function WatchlistBoard({ items }: { items: WatchlistItem[] }) {
  if (items.length === 0) {
    return <EmptyState message="No watchlist items yet." />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {COLUMNS.map((col) => {
        const colItems = items.filter((i) => i.status === col.status);
        return (
          <div key={col.status} className="card flex flex-col p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StatusBadge status={col.status} />
                <span className="text-sm font-medium text-gray-950">
                  {col.label}
                </span>
              </div>
              <span className="text-xs text-gray-400 tnum">
                {colItems.length}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {colItems.length ? (
                colItems.map((item) => <ItemCard key={item.id} item={item} />)
              ) : (
                <div className="rounded-md border border-dashed border-gray-200 px-3 py-6 text-center text-xs text-gray-400">
                  None
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
