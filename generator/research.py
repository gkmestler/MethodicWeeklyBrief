"""Calls the Anthropic API with the web search tool and returns parsed JSON.

The generator MUST use live web search; rates and comps from model memory are
not acceptable. The model interleaves web_search tool calls with text; we
concatenate the final text blocks and extract the single JSON object.
"""

from __future__ import annotations

import json
import logging

import anthropic

from generator.config import Config

log = logging.getLogger("methodic.research")


def run_research(cfg: Config, prompt: str) -> tuple[dict, str]:
    """Run the generation call with web search enabled.

    Returns (parsed_json, raw_text). Raises on a non-recoverable parse failure.
    """
    client = anthropic.Anthropic(api_key=cfg.anthropic_api_key)

    log.info("Calling %s with web search (max %d searches)...", cfg.model, cfg.max_web_searches)
    response = client.messages.create(
        model=cfg.model,
        max_tokens=cfg.max_tokens,
        tools=[
            {
                "type": "web_search_20250305",
                "name": "web_search",
                "max_uses": cfg.max_web_searches,
            }
        ],
        messages=[{"role": "user", "content": prompt}],
    )

    text = _collect_text(response)
    if not text.strip():
        raise RuntimeError("Model returned no text content; cannot parse a brief.")

    data = _extract_json(text)
    return data, text


def _collect_text(response: anthropic.types.Message) -> str:
    """Concatenate all assistant text blocks (skipping tool-use / search-result
    blocks). The JSON object lives in the final text the model emits."""
    parts: list[str] = []
    for block in response.content:
        if getattr(block, "type", None) == "text":
            parts.append(block.text)
    return "\n".join(parts)


def _extract_json(text: str) -> dict:
    """Robustly pull the single JSON object out of the model's text.

    Handles accidental ```json fences and any stray preamble by slicing from the
    first '{' to the last matching '}'.
    """
    cleaned = text.strip()

    # Strip code fences if the model added them despite instructions.
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        # Drop a leading language tag like "json\n".
        first_newline = cleaned.find("\n")
        if first_newline != -1 and cleaned[:first_newline].strip().lower() in ("json", ""):
            cleaned = cleaned[first_newline + 1 :]

    # Try a direct parse first.
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Fall back to the outermost {...} span.
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("Could not locate a JSON object in the model output.")
    span = cleaned[start : end + 1]
    return json.loads(span)
