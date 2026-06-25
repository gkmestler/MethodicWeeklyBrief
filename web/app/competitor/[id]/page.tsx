import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCompetitor,
  getCompetitorMentions,
} from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { EmptyState } from "@/components/ui";

export const revalidate = 300;

export default async function CompetitorDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    notFound();
  }

  const [competitor, mentions] = await Promise.all([
    getCompetitor(id),
    getCompetitorMentions(id),
  ]);

  if (!competitor) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-950">
          ← Back to dashboard
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-gray-950">
          {competitor.name}
        </h1>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-500">
          {competitor.type ? <span>{competitor.type}</span> : null}
          {competitor.location ? <span>{competitor.location}</span> : null}
          <span className="tnum">
            First seen {formatDate(competitor.first_seen_week)}
          </span>
          <span className="tnum">
            Last seen {formatDate(competitor.last_seen_week)}
          </span>
        </div>
        {competitor.last_action ? (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-700">
            <span className="font-medium text-gray-950">Last action:</span>{" "}
            {competitor.last_action}
          </p>
        ) : null}
        {competitor.notes ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500">
            {competitor.notes}
          </p>
        ) : null}
      </div>

      <div>
        <h2 className="mb-4 text-sm font-semibold text-gray-950">
          Mention history
        </h2>
        {mentions.length ? (
          <ul className="space-y-3">
            {mentions.map((m) => (
              <li key={m.id} className="card p-4">
                <Link
                  href={`/brief/${m.week_of}`}
                  className="text-xs font-medium text-gray-400 hover:text-gray-950 tnum"
                >
                  {formatDate(m.week_of)}
                </Link>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-700">
                  {m.mention_text}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState message="No mentions recorded for this competitor yet." />
        )}
      </div>
    </div>
  );
}
