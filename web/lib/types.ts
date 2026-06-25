// TypeScript interfaces mirroring the Postgres schema for the
// Methodic Monday Brief system. Field types match the DB contract exactly.

export type MetricKey =
  | "fed_funds"
  | "sba_7a_effective"
  | "prime"
  | "conventional_acq_rate"
  | "ten_year_treasury";

export type WatchlistStatus = "open" | "updated" | "closed";

export type WatchlistChangeType = "added" | "updated" | "closed";

export type ChangelogChangeType = "quantitative" | "qualitative";

export interface Brief {
  id: number;
  week_of: string; // date (ISO yyyy-mm-dd)
  created_at: string; // timestamptz
  recap: string | null;
  deep_cut_topic: string | null;
  body_markdown: string | null;
  raw_json: unknown | null; // jsonb
}

export interface Metric {
  id: number;
  brief_id: number | null;
  week_of: string; // date
  metric_key: MetricKey;
  value: number | null;
  unit: string | null;
  as_of_date: string | null; // date
  source: string | null;
}

export interface Comp {
  id: number;
  brief_id: number | null;
  week_of: string; // date
  company_name: string | null;
  trade: string | null;
  location: string | null;
  size_basis: string | null;
  size_value: number | null;
  multiple: number | null;
  deal_value: number | null;
  source: string | null;
  notes: string | null;
}

export interface WatchlistItem {
  id: string; // slug
  title: string | null;
  category: string | null;
  status: WatchlistStatus;
  current_summary: string | null;
  created_week: string | null; // date
  last_updated_week: string | null; // date
}

export interface WatchlistUpdate {
  id: number;
  watchlist_item_id: string;
  brief_id: number | null;
  week_of: string; // date
  change_type: WatchlistChangeType;
  update_text: string | null;
}

export interface Competitor {
  id: number;
  name: string;
  type: string | null;
  location: string | null;
  first_seen_week: string | null; // date
  last_seen_week: string | null; // date
  last_action: string | null;
  notes: string | null;
}

export interface CompetitorMention {
  id: number;
  competitor_id: number;
  brief_id: number | null;
  week_of: string; // date
  mention_text: string | null;
}

export interface ChangelogEntry {
  id: number;
  brief_id: number | null;
  week_of: string; // date
  change_type: ChangelogChangeType;
  text: string | null;
}
