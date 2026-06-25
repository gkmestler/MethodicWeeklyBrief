import { getStatTileData } from "@/lib/queries";
import { CORE_METRIC_ORDER, METRIC_LABELS } from "@/lib/metrics";
import { formatMultiple, formatPercent } from "@/lib/format";

// Server component. Top row of hero stat tiles.

function DeltaTag({ delta }: { delta: number | null }) {
  if (delta === null || delta === undefined || Number.isNaN(delta)) {
    return <span className="text-xs text-gray-400">—</span>;
  }
  if (Math.abs(delta) < 0.005) {
    return <span className="text-xs text-gray-400">flat</span>;
  }
  const up = delta > 0;
  const arrow = up ? "▲" : "▼";
  return (
    <span
      className="text-xs font-medium tnum"
      style={{ color: up ? "var(--up)" : "var(--down)" }}
    >
      {arrow} {Math.abs(delta).toFixed(2)} pts
    </span>
  );
}

function Tile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col justify-between px-5 py-4">
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-gray-400">
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-gray-950 tnum">
        {value}
      </div>
      <div className="mt-1 min-h-[18px] text-xs text-gray-500">{sub}</div>
    </div>
  );
}

export default async function StatTiles() {
  const data = await getStatTileData();

  const rateTiles = CORE_METRIC_ORDER.slice(0, 3).map((key) => {
    const latest = data.latestMetrics[key];
    const first = data.firstMetrics[key];
    const delta =
      latest?.value != null && first?.value != null
        ? latest.value - first.value
        : null;
    return { key, latest, delta };
  });

  return (
    <section>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile
          label="Weeks Tracked"
          value={String(data.weeksTracked)}
          sub={data.weeksTracked === 0 ? "No briefs yet" : "current streak"}
        />
        {rateTiles.map(({ key, latest, delta }) => (
          <Tile
            key={key}
            label={METRIC_LABELS[key]}
            value={latest?.value != null ? formatPercent(latest.value) : "—"}
            sub={<DeltaTag delta={delta} />}
          />
        ))}
        <Tile
          label="Lowest Multiple"
          value={
            data.lowestMultiple != null
              ? formatMultiple(data.lowestMultiple)
              : "—"
          }
          sub={data.lowestMultiple != null ? "best comp seen" : "No comps yet"}
        />
        <Tile
          label="Active Watchlist"
          value={String(data.activeWatchlistCount)}
          sub="open or updated"
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile
          label="New Competitors"
          value={String(data.newCompetitorsThisMonth)}
          sub="first seen this month"
        />
      </div>
    </section>
  );
}
