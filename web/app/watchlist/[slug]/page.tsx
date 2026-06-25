import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getWatchlistHistory,
  getWatchlistItem,
} from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { EmptyState, StatusBadge } from "@/components/ui";

export const revalidate = 300;

export default async function WatchlistThreadPage({
  params,
}: {
  params: { slug: string };
}) {
  const slug = decodeURIComponent(params.slug);
  const [item, history] = await Promise.all([
    getWatchlistItem(slug),
    getWatchlistHistory(slug),
  ]);

  if (!item) {
    notFound();
  }

  // Chronological (oldest first), reads as a story.
  const ordered = [...history].sort((a, b) =>
    a.week_of < b.week_of ? -1 : a.week_of > b.week_of ? 1 : a.id - b.id
  );

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-950">
          ← Back to dashboard
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-950">
            {item.title ?? item.id}
          </h1>
          <StatusBadge status={item.status} />
        </div>
        {item.category ? (
          <p className="mt-1 text-sm text-gray-500">{item.category}</p>
        ) : null}
        {item.current_summary ? (
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-gray-700">
            {item.current_summary}
          </p>
        ) : null}
        <div className="mt-3 flex gap-6 text-xs text-gray-400 tnum">
          <span>Opened {formatDate(item.created_week)}</span>
          <span>Last update {formatDate(item.last_updated_week)}</span>
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-sm font-semibold text-gray-950">
          Full history
        </h2>
        {ordered.length ? (
          <ol className="relative ml-3 space-y-5 border-l border-gray-200">
            {ordered.map((u) => (
              <li key={u.id} className="relative pl-6">
                <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border border-gray-300 bg-white" />
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-500 tnum">
                    {formatDate(u.week_of)}
                  </span>
                  <StatusBadge status={u.change_type} />
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-700">
                  {u.update_text}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState message="No history recorded for this thread yet." />
        )}
      </div>
    </div>
  );
}
