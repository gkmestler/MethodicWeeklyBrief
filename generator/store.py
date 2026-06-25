"""Supabase reads and validated writes for the brief generator.

Reads the prior edition's structured data back in (the memory layer), and loads
a freshly generated edition. Every record is validated independently: a missing
or malformed field is logged and that record is skipped, never crashing the run.

Re-running a given week replaces that week's brief-scoped rows (metrics, comps,
changelog, watchlist_updates, competitor_mentions via cascade) but preserves the
persistent registries (watchlist_items by slug, competitors by name).
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime, timezone

from supabase import Client, create_client

from generator.config import Config

log = logging.getLogger("methodic.store")


def _to_number(value) -> float | None:
    """Coerce '4.33', '4.33%', '$1,200,000', 4.33 -> float. None if nothing."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        match = re.search(r"-?\d[\d,]*\.?\d*", value)
        if match:
            try:
                return float(match.group(0).replace(",", ""))
            except ValueError:
                return None
    return None


def _to_date(value) -> str | None:
    """Return an ISO date string if value parses as a date, else None."""
    if value is None:
        return None
    if isinstance(value, (date, datetime)):
        return value.date().isoformat() if isinstance(value, datetime) else value.isoformat()
    if isinstance(value, str):
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y"):
            try:
                return datetime.strptime(value.strip(), fmt).date().isoformat()
            except ValueError:
                continue
    return None


class Store:
    def __init__(self, cfg: Config):
        self.client: Client = create_client(
            cfg.supabase_url, cfg.supabase_service_role_key
        )

    # ---------------------------------------------------------------- reads

    def get_prior_context(self) -> dict:
        """Return prior metrics, open watchlist threads, and known competitors
        for the most recent brief. Empty lists if this is the first run."""
        latest = (
            self.client.table("briefs")
            .select("id, week_of")
            .order("week_of", desc=True)
            .limit(1)
            .execute()
        )
        if not latest.data:
            log.info("No prior brief found. This is the first edition.")
            return {"metrics": [], "watchlist": [], "competitors": []}

        prior_brief_id = latest.data[0]["id"]
        prior_week = latest.data[0]["week_of"]
        log.info("Prior edition: week_of=%s (brief_id=%s)", prior_week, prior_brief_id)

        metrics = (
            self.client.table("metrics")
            .select("metric_key, value, unit, as_of_date, source")
            .eq("brief_id", prior_brief_id)
            .execute()
        ).data or []

        watchlist = (
            self.client.table("watchlist_items")
            .select("id, title, category, status, current_summary, last_updated_week")
            .neq("status", "closed")
            .execute()
        ).data or []

        competitors = (
            self.client.table("competitors")
            .select("name, type, location, last_action")
            .execute()
        ).data or []

        return {"metrics": metrics, "watchlist": watchlist, "competitors": competitors}

    # ----------------------------------------------------- manual trigger queue

    def get_next_queued_request(self) -> dict | None:
        """Oldest 'queued' manual-trigger request, or None."""
        r = (
            self.client.table("generation_requests")
            .select("*")
            .eq("status", "queued")
            .order("requested_at")
            .limit(1)
            .execute()
        )
        return r.data[0] if r.data else None

    def claim_request(self, request_id: int) -> bool:
        """Atomically move a request queued -> running. Returns True if we won it
        (the filtered update only matches a row still in 'queued')."""
        r = (
            self.client.table("generation_requests")
            .update(
                {"status": "running", "claimed_at": datetime.now(timezone.utc).isoformat()}
            )
            .eq("id", request_id)
            .eq("status", "queued")
            .execute()
        )
        return bool(r.data)

    def complete_request(self, request_id: int, brief_id: int | None, message: str) -> None:
        self.client.table("generation_requests").update(
            {
                "status": "done",
                "brief_id": brief_id,
                "message": message,
                "finished_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("id", request_id).execute()

    def fail_request(self, request_id: int, message: str) -> None:
        self.client.table("generation_requests").update(
            {
                "status": "error",
                "message": message[:1000],
                "finished_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("id", request_id).execute()

    # --------------------------------------------------------------- writes

    def load_brief(self, week_of: str, data: dict) -> int:
        """Persist a generated edition. Returns the new brief_id."""
        # Replace any existing brief for this week (cascade clears brief-scoped rows).
        self.client.table("briefs").delete().eq("week_of", week_of).execute()

        brief_row = {
            "week_of": week_of,
            "recap": data.get("recap"),
            "deep_cut_topic": data.get("deep_cut_topic"),
            "body_markdown": data.get("body_markdown"),
            "raw_json": data,
        }
        inserted = self.client.table("briefs").insert(brief_row).execute()
        brief_id = inserted.data[0]["id"]
        log.info("Inserted brief id=%s for week_of=%s", brief_id, week_of)

        self._load_metrics(brief_id, week_of, data.get("metrics", []))
        self._load_comps(brief_id, week_of, data.get("comps", []))
        self._load_watchlist(brief_id, week_of, data.get("watchlist", []))
        self._load_competitors(brief_id, week_of, data.get("competitors", []))
        self._load_changelog(brief_id, week_of, data.get("changelog", []))

        return brief_id

    def _load_metrics(self, brief_id: int, week_of: str, items: list[dict]) -> None:
        ok = 0
        for i, m in enumerate(items or []):
            key = (m or {}).get("metric_key")
            if not key:
                log.warning("metrics[%d] missing metric_key; skipped", i)
                continue
            try:
                self.client.table("metrics").insert(
                    {
                        "brief_id": brief_id,
                        "week_of": week_of,
                        "metric_key": str(key),
                        "value": _to_number(m.get("value")),
                        "unit": m.get("unit"),
                        "as_of_date": _to_date(m.get("as_of_date")),
                        "source": m.get("source"),
                    }
                ).execute()
                ok += 1
            except Exception as exc:  # noqa: BLE001 - log and skip bad record
                log.warning("metrics[%d] (%s) failed: %s", i, key, exc)
        log.info("Loaded %d/%d metrics", ok, len(items or []))

    def _load_comps(self, brief_id: int, week_of: str, items: list[dict]) -> None:
        ok = 0
        for i, c in enumerate(items or []):
            c = c or {}
            try:
                self.client.table("comps").insert(
                    {
                        "brief_id": brief_id,
                        "week_of": week_of,
                        "company_name": c.get("company_name"),
                        "trade": c.get("trade"),
                        "location": c.get("location"),
                        "size_basis": c.get("size_basis"),
                        "size_value": _to_number(c.get("size_value")),
                        "multiple": _to_number(c.get("multiple")),
                        "deal_value": _to_number(c.get("deal_value")),
                        "source": c.get("source"),
                        "notes": c.get("notes"),
                    }
                ).execute()
                ok += 1
            except Exception as exc:  # noqa: BLE001
                log.warning("comps[%d] failed: %s", i, exc)
        log.info("Loaded %d/%d comps", ok, len(items or []))

    def _load_watchlist(self, brief_id: int, week_of: str, items: list[dict]) -> None:
        ok = 0
        for i, w in enumerate(items or []):
            w = w or {}
            slug = w.get("id")
            title = w.get("title")
            if not slug or not title:
                log.warning("watchlist[%d] missing id/title; skipped", i)
                continue
            try:
                existing = (
                    self.client.table("watchlist_items")
                    .select("id, created_week")
                    .eq("id", slug)
                    .execute()
                ).data
                item_row = {
                    "id": slug,
                    "title": title,
                    "category": w.get("category"),
                    "status": w.get("status") or "open",
                    "current_summary": w.get("current_summary"),
                    "last_updated_week": week_of,
                }
                if existing:
                    self.client.table("watchlist_items").update(item_row).eq(
                        "id", slug
                    ).execute()
                else:
                    item_row["created_week"] = week_of
                    self.client.table("watchlist_items").insert(item_row).execute()

                self.client.table("watchlist_updates").insert(
                    {
                        "watchlist_item_id": slug,
                        "brief_id": brief_id,
                        "week_of": week_of,
                        "change_type": w.get("change_type"),
                        "update_text": w.get("update_text"),
                    }
                ).execute()
                ok += 1
            except Exception as exc:  # noqa: BLE001
                log.warning("watchlist[%d] (%s) failed: %s", i, slug, exc)
        log.info("Loaded %d/%d watchlist threads", ok, len(items or []))

    def _load_competitors(self, brief_id: int, week_of: str, items: list[dict]) -> None:
        ok = 0
        for i, comp in enumerate(items or []):
            comp = comp or {}
            name = comp.get("name")
            if not name:
                log.warning("competitors[%d] missing name; skipped", i)
                continue
            try:
                existing = (
                    self.client.table("competitors")
                    .select("id, first_seen_week")
                    .eq("name", name)
                    .execute()
                ).data
                comp_row = {
                    "name": name,
                    "type": comp.get("type"),
                    "location": comp.get("location"),
                    "last_action": comp.get("last_action"),
                    "last_seen_week": week_of,
                }
                if existing:
                    competitor_id = existing[0]["id"]
                    self.client.table("competitors").update(comp_row).eq(
                        "id", competitor_id
                    ).execute()
                else:
                    comp_row["first_seen_week"] = week_of
                    inserted = (
                        self.client.table("competitors").insert(comp_row).execute()
                    )
                    competitor_id = inserted.data[0]["id"]

                self.client.table("competitor_mentions").insert(
                    {
                        "competitor_id": competitor_id,
                        "brief_id": brief_id,
                        "week_of": week_of,
                        "mention_text": comp.get("mention_text"),
                    }
                ).execute()
                ok += 1
            except Exception as exc:  # noqa: BLE001
                log.warning("competitors[%d] (%s) failed: %s", i, name, exc)
        log.info("Loaded %d/%d competitors", ok, len(items or []))

    def _load_changelog(self, brief_id: int, week_of: str, items: list[dict]) -> None:
        ok = 0
        for i, ch in enumerate(items or []):
            ch = ch or {}
            try:
                self.client.table("changelog").insert(
                    {
                        "brief_id": brief_id,
                        "week_of": week_of,
                        "change_type": ch.get("change_type"),
                        "text": ch.get("text"),
                    }
                ).execute()
                ok += 1
            except Exception as exc:  # noqa: BLE001
                log.warning("changelog[%d] failed: %s", i, exc)
        log.info("Loaded %d/%d changelog entries", ok, len(items or []))
