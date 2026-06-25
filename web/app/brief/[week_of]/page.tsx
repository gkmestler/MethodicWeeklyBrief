import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  getBriefByWeek,
  getChangelogForWeek,
  getMetricsForWeek,
} from "@/lib/queries";
import { METRIC_LABELS } from "@/lib/metrics";
import type { MetricKey } from "@/lib/types";
import { formatDate, formatPercent } from "@/lib/format";
import { EmptyState, StatusBadge } from "@/components/ui";

export const revalidate = 300;

export default async function BriefDetailPage({
  params,
}: {
  params: { week_of: string };
}) {
  const weekOf = decodeURIComponent(params.week_of);
  const [brief, metrics, changelog] = await Promise.all([
    getBriefByWeek(weekOf),
    getMetricsForWeek(weekOf),
    getChangelogForWeek(weekOf),
  ]);

  if (!brief) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/archive"
          className="text-sm text-gray-500 hover:text-gray-950"
        >
          ← Back to archive
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-gray-950 tnum">
          Week of {formatDate(brief.week_of)}
        </h1>
        {brief.deep_cut_topic ? (
          <p className="mt-1 text-sm text-gray-500">
            Deep cut: {brief.deep_cut_topic}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <article className="card p-6 lg:col-span-2">
          {brief.recap ? (
            <p className="mb-6 border-l-2 border-gray-200 pl-4 text-sm italic leading-relaxed text-gray-500">
              {brief.recap}
            </p>
          ) : null}
          {brief.body_markdown ? (
            <div className="prose-brief max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {brief.body_markdown}
              </ReactMarkdown>
            </div>
          ) : (
            <EmptyState message="This brief has no body content." />
          )}
        </article>

        <aside className="space-y-6">
          <div className="card p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-950">
              Metrics this week
            </h2>
            {metrics.length ? (
              <dl className="space-y-2">
                {metrics.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-baseline justify-between border-b border-gray-100 pb-2 last:border-0"
                  >
                    <dt className="text-xs text-gray-500">
                      {METRIC_LABELS[m.metric_key as MetricKey] ?? m.metric_key}
                    </dt>
                    <dd className="text-sm font-medium text-gray-950 tnum">
                      {formatPercent(m.value)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-xs text-gray-400">No metrics recorded.</p>
            )}
          </div>

          <div className="card p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-950">
              Changes this week
            </h2>
            {changelog.length ? (
              <ul className="space-y-3">
                {changelog.map((c) => (
                  <li key={c.id} className="flex items-start gap-2">
                    <StatusBadge status={c.change_type} />
                    <p className="text-xs leading-relaxed text-gray-700">
                      {c.text}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-400">No logged changes.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
