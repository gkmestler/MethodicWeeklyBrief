import Link from "next/link";
import StatTiles from "@/components/StatTiles";
import CostOfCapitalCalculator from "@/components/CostOfCapitalCalculator";
import RateTrends from "@/components/RateTrends";
import MultiplesTracker from "@/components/MultiplesTracker";
import WatchlistBoard from "@/components/WatchlistBoard";
import CompetitorRegistry from "@/components/CompetitorRegistry";
import ChangelogFeed from "@/components/ChangelogFeed";
import { SectionHeading } from "@/components/ui";
import {
  getChangelogFeed,
  getComps,
  getCompetitors,
  getLatestBrief,
  getLatestMetrics,
  getMetricSeries,
  getWatchlistBoard,
} from "@/lib/queries";
import { formatDate } from "@/lib/format";

// Cache for 5 minutes; brief updates weekly.
export const revalidate = 300;

export default async function DashboardPage() {
  const [latestBrief, latestMetrics, metricSeries, comps, watchlist, competitors, changelog] =
    await Promise.all([
      getLatestBrief(),
      getLatestMetrics(),
      getMetricSeries(),
      getComps(),
      getWatchlistBoard(),
      getCompetitors(),
      getChangelogFeed(),
    ]);

  const sbaRate = latestMetrics.sba_7a_effective?.value ?? null;
  const conventionalRate = latestMetrics.conventional_acq_rate?.value ?? null;

  return (
    <div className="space-y-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-950">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {latestBrief
              ? `Latest brief — week of ${formatDate(latestBrief.week_of)}`
              : "Awaiting the first brief."}
          </p>
        </div>
        {latestBrief ? (
          <Link
            href={`/brief/${latestBrief.week_of}`}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:border-gray-400"
          >
            Read latest brief →
          </Link>
        ) : null}
      </div>

      <section>
        <StatTiles />
      </section>

      <section>
        <SectionHeading
          title="Cost of Capital"
          subtitle="DSCR and debt service at the latest tracked rates. Adjust the inputs."
        />
        <CostOfCapitalCalculator
          sbaRate={sbaRate}
          conventionalRate={conventionalRate}
        />
      </section>

      <section>
        <SectionHeading
          title="Rate Trends"
          subtitle="The five core rates over time, plus the SBA / conventional spread."
        />
        <RateTrends metrics={metricSeries} />
      </section>

      <section>
        <SectionHeading
          title="Multiples Tracker"
          subtitle="Every comp multiple over time against the 3.0x–4.0x buy box."
        />
        <MultiplesTracker comps={comps} />
      </section>

      <section>
        <SectionHeading
          title="Watchlist"
          subtitle="Open threads grouped by status. Click through for full history."
        />
        <WatchlistBoard items={watchlist} />
      </section>

      <section>
        <SectionHeading
          title="Competitor Registry"
          subtitle="Who is active in the market. Sort columns; click a row for mentions."
        />
        <CompetitorRegistry competitors={competitors} />
      </section>

      <section>
        <SectionHeading
          title="Changelog"
          subtitle="Week over week, what changed — quantitative and qualitative."
          right={
            <Link
              href="/archive"
              className="text-sm text-gray-500 hover:text-gray-950"
            >
              Full archive →
            </Link>
          }
        />
        <ChangelogFeed entries={changelog} limit={60} />
      </section>
    </div>
  );
}
