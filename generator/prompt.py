"""Builds the generation prompt from prior Supabase context.

The template is Appendix A of the Master Prompt. Bracketed slots are filled
from the most recent edition before the API call so the model can produce a
real recap and changelog.
"""

from __future__ import annotations

import json

PROMPT_TEMPLATE = """You are producing the Methodic Monday Brief for the week of {week_of}.

Methodic Ventures buys essential service businesses (landscaping focus right now)
in New England, $500K to $1.5M EBITDA at 3 to 4x multiples. The reader is the
founder. Be direct. No fluff. No em-dashes.

Use web search for every number. Do not state any rate, comp, or fact from memory.
Every numeric claim carries a source.

PRIOR EDITION CONTEXT (for recap and changelog, may be empty on first run):
- Prior metrics: {prior_metrics_json}
- Open watchlist threads: {prior_watchlist_json}
- Known competitors: {prior_competitors_json}

Produce the brief covering, in order: dashboard numbers (fed funds plus FOMC dates,
SBA 7a effective rate, prime, conventional acquisition loan rate, 10-year Treasury),
last week recap, what changed (quantitative and qualitative), capital and financing,
landscaping industry, Massachusetts and New England, competitive landscape, thesis
radar (AI plus skilled labor), general signal (3 to 5 filtered items), watchlist,
and one rotating deep cut. End each substantive section with one line: "So what for
Methodic." If this is the first edition, mark recap and changelog as baseline.

Return a single JSON object with these keys:
- week_of
- recap (string)
- deep_cut_topic (string)
- body_markdown (the full human-readable brief)
- metrics (array of {{metric_key, value, unit, as_of_date, source}})
  metric_key must use these stable keys for the five core numbers:
  fed_funds, sba_7a_effective, prime, conventional_acq_rate, ten_year_treasury
- comps (array of {{company_name, trade, location, size_basis, size_value, multiple, deal_value, source, notes}})
- changelog (array of {{change_type: "quantitative"|"qualitative", text}})
- watchlist (array of {{id (stable slug), title, category, status: "open"|"updated"|"closed", current_summary, change_type: "added"|"updated"|"closed", update_text}})
- competitors (array of {{name, type, location, last_action, mention_text}})

Output only the JSON. No preamble, no markdown fences.
"""


def build_prompt(
    week_of: str,
    prior_metrics: list[dict],
    prior_watchlist: list[dict],
    prior_competitors: list[dict],
) -> str:
    """Fill the template. Empty lists render as [] so the model knows it is the
    first edition and should establish a baseline."""

    def dump(value: list[dict]) -> str:
        return json.dumps(value, default=str) if value else "[]"

    return PROMPT_TEMPLATE.format(
        week_of=week_of,
        prior_metrics_json=dump(prior_metrics),
        prior_watchlist_json=dump(prior_watchlist),
        prior_competitors_json=dump(prior_competitors),
    )
