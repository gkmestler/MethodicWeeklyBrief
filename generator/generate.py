"""Entry point for the Methodic Monday Brief generator.

Weekly loop:
  1. Read the most recent edition's structured data from Supabase (the memory).
  2. Build the prompt with that prior context.
  3. Call the Anthropic API with web search to research the week and produce
     structured JSON + markdown.
  4. Validate and load the new edition into Supabase.
  5. Optionally save a local markdown copy and email it.

Run from the repo root:
    python -m generator.generate                  # this week's Monday
    python -m generator.generate --week-of 2026-06-22
    python -m generator.generate --dry-run        # generate, print, do not write

The core is exposed as generate_edition() so the manual-trigger watcher
(generator/watch_triggers.py) can reuse it.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import date, datetime, timedelta

from generator.config import REPO_ROOT, Config, load_config
from generator.emailer import send_brief
from generator.prompt import build_prompt
from generator.research import run_research
from generator.store import Store

LOG_DIR = REPO_ROOT / "logs"
OUT_DIR = REPO_ROOT / "generator" / "out"

log = logging.getLogger("methodic.generate")


def setup_logging() -> None:
    LOG_DIR.mkdir(exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler(LOG_DIR / "generator.log"),
        ],
    )


def most_recent_monday() -> str:
    today = date.today()
    monday = today - timedelta(days=today.weekday())  # Monday == 0
    return monday.isoformat()


def generate_edition(
    cfg: Config,
    store: Store,
    week_of: str,
    *,
    dry_run: bool = False,
    save_local: bool = True,
) -> dict:
    """Research, generate, and (unless dry_run) load one edition.

    Returns a summary dict: week_of, brief_id (None on dry runs), counts, and the
    rendered body_markdown. Raises on a non-recoverable generation failure.
    """
    # 1. Read prior context (the memory layer).
    prior = store.get_prior_context()
    log.info(
        "Prior context: %d metrics, %d open threads, %d competitors",
        len(prior["metrics"]),
        len(prior["watchlist"]),
        len(prior["competitors"]),
    )

    # 2. Build the prompt.
    prompt = build_prompt(
        week_of=week_of,
        prior_metrics=prior["metrics"],
        prior_watchlist=prior["watchlist"],
        prior_competitors=prior["competitors"],
    )

    # 3. Research + generate.
    data, _raw = run_research(cfg, prompt)
    data.setdefault("week_of", week_of)
    body_markdown = data.get("body_markdown", "")

    counts = {
        "metrics": len(data.get("metrics", [])),
        "comps": len(data.get("comps", [])),
        "watchlist": len(data.get("watchlist", [])),
        "competitors": len(data.get("competitors", [])),
        "changelog": len(data.get("changelog", [])),
    }
    log.info("Generated: %s", counts)

    # Save a local copy (useful for inspection / dry runs).
    if save_local or dry_run:
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        (OUT_DIR / f"brief-{week_of}.md").write_text(body_markdown or "")
        (OUT_DIR / f"brief-{week_of}.json").write_text(
            json.dumps(data, indent=2, default=str)
        )
        log.info("Wrote local copy to %s", OUT_DIR)

    if dry_run:
        log.info("Dry run: nothing written to Supabase.")
        return {"week_of": week_of, "brief_id": None, "counts": counts, "body_markdown": body_markdown}

    # 4. Load into Supabase.
    brief_id = store.load_brief(week_of, data)
    log.info("Loaded edition into Supabase (brief_id=%s).", brief_id)

    # 5. Optional email.
    send_brief(cfg, week_of, body_markdown)

    return {"week_of": week_of, "brief_id": brief_id, "counts": counts, "body_markdown": body_markdown}


def _parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Generate the Methodic Monday Brief.")
    p.add_argument(
        "--week-of",
        help="ISO date (YYYY-MM-DD) for the edition. Defaults to this week's Monday.",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Generate and print the brief but do not write to Supabase or email.",
    )
    return p.parse_args(argv)


def validate_week_of(value: str) -> str:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date().isoformat()
    except ValueError:
        raise SystemExit(f"--week-of must be YYYY-MM-DD, got: {value!r}")


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv if argv is not None else sys.argv[1:])
    setup_logging()

    week_of = validate_week_of(args.week_of) if args.week_of else most_recent_monday()
    log.info(
        "=== Methodic Monday Brief — week_of=%s%s ===",
        week_of,
        " (dry run)" if args.dry_run else "",
    )

    cfg = load_config()
    store = Store(cfg)

    result = generate_edition(cfg, store, week_of, dry_run=args.dry_run)

    if args.dry_run:
        print("\n" + "=" * 72 + "\n" + (result["body_markdown"] or "(empty)") + "\n" + "=" * 72)
    else:
        log.info("=== Done. week_of=%s brief_id=%s ===", week_of, result["brief_id"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
