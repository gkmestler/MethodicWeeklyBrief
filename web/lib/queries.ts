import { getSupabaseClient } from "./supabase";
import { METRIC_KEYS } from "./metrics";
import type {
  Brief,
  ChangelogEntry,
  Comp,
  Competitor,
  CompetitorMention,
  Metric,
  MetricKey,
  WatchlistItem,
  WatchlistUpdate,
} from "./types";

// Every query is defensive: if Supabase is unconfigured or a request errors,
// we return an empty result so pages render an empty state instead of crashing.

async function safeSelect<T>(
  run: (
    client: NonNullable<ReturnType<typeof getSupabaseClient>>
  ) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  try {
    const { data, error } = await run(client);
    if (error) {
      console.error("[queries] Supabase error:", error);
      return [];
    }
    return data ?? [];
  } catch (err) {
    console.error("[queries] Supabase request failed:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Briefs
// ---------------------------------------------------------------------------

export async function getAllBriefs(): Promise<Brief[]> {
  return safeSelect<Brief>((c) =>
    c.from("briefs").select("*").order("week_of", { ascending: false })
  );
}

export async function getLatestBrief(): Promise<Brief | null> {
  const rows = await safeSelect<Brief>((c) =>
    c
      .from("briefs")
      .select("*")
      .order("week_of", { ascending: false })
      .limit(1)
  );
  return rows[0] ?? null;
}

export async function getBriefByWeek(weekOf: string): Promise<Brief | null> {
  const rows = await safeSelect<Brief>((c) =>
    c.from("briefs").select("*").eq("week_of", weekOf).limit(1)
  );
  return rows[0] ?? null;
}

export async function getBriefCount(): Promise<number> {
  const client = getSupabaseClient();
  if (!client) return 0;
  try {
    const { count, error } = await client
      .from("briefs")
      .select("id", { count: "exact", head: true });
    if (error) {
      console.error("[queries] count error:", error);
      return 0;
    }
    return count ?? 0;
  } catch (err) {
    console.error("[queries] count failed:", err);
    return 0;
  }
}

export async function searchBriefs(term: string): Promise<Brief[]> {
  const trimmed = term.trim();
  if (!trimmed) return getAllBriefs();
  const pattern = `%${trimmed}%`;
  return safeSelect<Brief>((c) =>
    c
      .from("briefs")
      .select("*")
      .or(
        `recap.ilike.${pattern},body_markdown.ilike.${pattern},deep_cut_topic.ilike.${pattern}`
      )
      .order("week_of", { ascending: false })
  );
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

// Full metric series across all weeks (used for charts + first-vs-latest deltas).
export async function getMetricSeries(): Promise<Metric[]> {
  return safeSelect<Metric>((c) =>
    c
      .from("metrics")
      .select("*")
      .order("week_of", { ascending: true })
  );
}

export async function getMetricsForWeek(weekOf: string): Promise<Metric[]> {
  return safeSelect<Metric>((c) =>
    c.from("metrics").select("*").eq("week_of", weekOf)
  );
}

// Latest value per metric_key.
export async function getLatestMetrics(): Promise<Record<MetricKey, Metric | null>> {
  const series = await getMetricSeries();
  const latest: Record<string, Metric | null> = {};
  for (const key of METRIC_KEYS) latest[key] = null;
  for (const m of series) {
    // series is ascending by week_of, so the last write wins as latest.
    if (METRIC_KEYS.includes(m.metric_key)) {
      const existing = latest[m.metric_key];
      if (!existing || m.week_of >= existing.week_of) {
        latest[m.metric_key] = m;
      }
    }
  }
  return latest as Record<MetricKey, Metric | null>;
}

// First (week-one) value per metric_key.
export async function getFirstMetrics(): Promise<Record<MetricKey, Metric | null>> {
  const series = await getMetricSeries();
  const first: Record<string, Metric | null> = {};
  for (const key of METRIC_KEYS) first[key] = null;
  for (const m of series) {
    if (METRIC_KEYS.includes(m.metric_key)) {
      const existing = first[m.metric_key];
      if (!existing || m.week_of < existing.week_of) {
        first[m.metric_key] = m;
      }
    }
  }
  return first as Record<MetricKey, Metric | null>;
}

// ---------------------------------------------------------------------------
// Comps
// ---------------------------------------------------------------------------

export async function getComps(): Promise<Comp[]> {
  return safeSelect<Comp>((c) =>
    c.from("comps").select("*").order("week_of", { ascending: true })
  );
}

// ---------------------------------------------------------------------------
// Watchlist
// ---------------------------------------------------------------------------

export async function getWatchlistBoard(): Promise<WatchlistItem[]> {
  return safeSelect<WatchlistItem>((c) =>
    c
      .from("watchlist_items")
      .select("*")
      .order("last_updated_week", { ascending: false })
  );
}

export async function getWatchlistItem(
  slug: string
): Promise<WatchlistItem | null> {
  const rows = await safeSelect<WatchlistItem>((c) =>
    c.from("watchlist_items").select("*").eq("id", slug).limit(1)
  );
  return rows[0] ?? null;
}

export async function getWatchlistHistory(
  slug: string
): Promise<WatchlistUpdate[]> {
  return safeSelect<WatchlistUpdate>((c) =>
    c
      .from("watchlist_updates")
      .select("*")
      .eq("watchlist_item_id", slug)
      .order("week_of", { ascending: true })
  );
}

// ---------------------------------------------------------------------------
// Competitors
// ---------------------------------------------------------------------------

export async function getCompetitors(): Promise<Competitor[]> {
  return safeSelect<Competitor>((c) =>
    c
      .from("competitors")
      .select("*")
      .order("last_seen_week", { ascending: false })
  );
}

export async function getCompetitor(id: number): Promise<Competitor | null> {
  const rows = await safeSelect<Competitor>((c) =>
    c.from("competitors").select("*").eq("id", id).limit(1)
  );
  return rows[0] ?? null;
}

export async function getCompetitorMentions(
  id: number
): Promise<CompetitorMention[]> {
  return safeSelect<CompetitorMention>((c) =>
    c
      .from("competitor_mentions")
      .select("*")
      .eq("competitor_id", id)
      .order("week_of", { ascending: false })
  );
}

// ---------------------------------------------------------------------------
// Changelog
// ---------------------------------------------------------------------------

export async function getChangelogFeed(): Promise<ChangelogEntry[]> {
  return safeSelect<ChangelogEntry>((c) =>
    c
      .from("changelog")
      .select("*")
      .order("week_of", { ascending: false })
      .order("id", { ascending: false })
  );
}

export async function getChangelogForWeek(
  weekOf: string
): Promise<ChangelogEntry[]> {
  return safeSelect<ChangelogEntry>((c) =>
    c
      .from("changelog")
      .select("*")
      .eq("week_of", weekOf)
      .order("id", { ascending: false })
  );
}

// ---------------------------------------------------------------------------
// Aggregate for StatTiles
// ---------------------------------------------------------------------------

export interface StatTileData {
  weeksTracked: number;
  latestMetrics: Record<MetricKey, Metric | null>;
  firstMetrics: Record<MetricKey, Metric | null>;
  lowestMultiple: number | null;
  activeWatchlistCount: number;
  newCompetitorsThisMonth: number;
}

export async function getStatTileData(): Promise<StatTileData> {
  const [weeksTracked, latestMetrics, firstMetrics, comps, watchlist, competitors] =
    await Promise.all([
      getBriefCount(),
      getLatestMetrics(),
      getFirstMetrics(),
      getComps(),
      getWatchlistBoard(),
      getCompetitors(),
    ]);

  let lowestMultiple: number | null = null;
  for (const comp of comps) {
    if (comp.multiple !== null && comp.multiple !== undefined) {
      if (lowestMultiple === null || comp.multiple < lowestMultiple) {
        lowestMultiple = comp.multiple;
      }
    }
  }

  const activeWatchlistCount = watchlist.filter(
    (w) => w.status !== "closed"
  ).length;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const newCompetitorsThisMonth = competitors.filter((comp) => {
    if (!comp.first_seen_week) return false;
    const part = comp.first_seen_week.slice(0, 10);
    const [y, m] = part.split("-").map(Number);
    return y === currentYear && m - 1 === currentMonth;
  }).length;

  return {
    weeksTracked,
    latestMetrics,
    firstMetrics,
    lowestMultiple,
    activeWatchlistCount,
    newCompetitorsThisMonth,
  };
}
