"""Manual-trigger watcher (Mac mini).

Polls the generation_requests queue in Supabase. When the dashboard's "Generate
now" button enqueues a request, this claims it, runs the generator, and writes
the result (done / error) back so the dashboard can show status.

Two modes:
    python -m generator.watch_triggers              # process all queued, then exit
    python -m generator.watch_triggers --interval 30  # daemon: poll every 30s

The launchd agent (com.methodic.watcher) runs the once-and-exit mode on a short
StartInterval, which is the simplest robust setup (no long-lived process to babysit).
"""

from __future__ import annotations

import argparse
import logging
import sys
import time

from generator.config import load_config
from generator.generate import generate_edition, most_recent_monday, setup_logging
from generator.store import Store

log = logging.getLogger("methodic.watcher")


def process_queue_once(cfg, store: Store) -> int:
    """Process every currently-queued request. Returns how many were handled."""
    handled = 0
    while True:
        req = store.get_next_queued_request()
        if not req:
            break
        request_id = req["id"]
        if not store.claim_request(request_id):
            # Another worker took it between select and claim; move on.
            continue

        week_of = req.get("requested_for_week") or most_recent_monday()
        log.info("Processing request id=%s for week_of=%s", request_id, week_of)
        try:
            result = generate_edition(cfg, store, week_of)
            counts = result["counts"]
            summary = (
                f"week {week_of}: {counts['metrics']} metrics, {counts['comps']} comps, "
                f"{counts['watchlist']} watchlist, {counts['competitors']} competitors"
            )
            store.complete_request(request_id, result["brief_id"], summary)
            log.info("Request id=%s done (brief_id=%s)", request_id, result["brief_id"])
        except Exception as exc:  # noqa: BLE001 - record failure, keep the watcher alive
            log.exception("Request id=%s failed", request_id)
            store.fail_request(request_id, str(exc))
        handled += 1
    return handled


def _parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Watch the manual-trigger queue.")
    p.add_argument(
        "--interval",
        type=int,
        default=0,
        help="Seconds between polls. 0 (default) = process queued once and exit.",
    )
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv if argv is not None else sys.argv[1:])
    setup_logging()

    cfg = load_config()
    store = Store(cfg)

    if args.interval > 0:
        log.info("Watcher daemon: polling every %ds. Ctrl-C to stop.", args.interval)
        while True:
            try:
                process_queue_once(cfg, store)
            except Exception:  # noqa: BLE001 - never let the daemon die on a transient error
                log.exception("Poll cycle failed; continuing.")
            time.sleep(args.interval)

    handled = process_queue_once(cfg, store)
    if handled:
        log.info("Processed %d request(s).", handled)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
