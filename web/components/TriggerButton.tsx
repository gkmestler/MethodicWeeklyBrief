"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Manual "Generate brief now" button. POSTs to /api/trigger (which enqueues a
// row the Mac mini watcher picks up), then polls GET /api/trigger for status.

type Status = "queued" | "running" | "done" | "error";

interface Latest {
  status: Status;
  finished_at: string | null;
  brief_id: number | null;
  message: string | null;
  requested_for_week: string | null;
}

type UiState =
  | "idle"
  | "unconfigured"
  | "pending" // queued or running
  | "done"
  | "error";

const POLL_MS = 4000;

export default function TriggerButton() {
  const [ui, setUi] = useState<UiState>("idle");
  const [note, setNote] = useState<string>("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const applyLatest = useCallback((latest: Latest | null) => {
    if (!latest) {
      setUi("idle");
      setNote("");
      return;
    }
    if (latest.status === "queued" || latest.status === "running") {
      setUi("pending");
      setNote(latest.status === "queued" ? "Queued on Mac mini…" : "Generating…");
    } else if (latest.status === "done") {
      setUi("done");
      setNote("Brief generated.");
    } else {
      setUi("error");
      setNote(latest.message ? `Failed: ${latest.message}` : "Failed.");
    }
  }, []);

  const fetchStatus = useCallback(async (): Promise<UiState> => {
    try {
      const res = await fetch("/api/trigger", { cache: "no-store" });
      const data = await res.json();
      if (data.configured === false) {
        setUi("unconfigured");
        setNote("Trigger not configured");
        return "unconfigured";
      }
      applyLatest(data.latest ?? null);
      return data.latest?.status === "queued" || data.latest?.status === "running"
        ? "pending"
        : (data.latest?.status as UiState) ?? "idle";
    } catch {
      return ui;
    }
  }, [applyLatest, ui]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const state = await fetchStatus();
      if (state !== "pending") stopPolling();
    }, POLL_MS);
  }, [fetchStatus, stopPolling]);

  // Show the last known status on mount; resume polling if a run is in flight.
  useEffect(() => {
    (async () => {
      const state = await fetchStatus();
      if (state === "pending") startPolling();
    })();
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onClick = useCallback(async () => {
    if (ui === "pending" || ui === "unconfigured") return;
    setUi("pending");
    setNote("Queuing…");
    try {
      const res = await fetch("/api/trigger", { method: "POST" });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        setUi("error");
        setNote(data.error ?? "Could not queue.");
        return;
      }
      setNote("Queued on Mac mini…");
      startPolling();
    } catch {
      setUi("error");
      setNote("Could not reach the trigger endpoint.");
    }
  }, [ui, startPolling]);

  const disabled = ui === "pending" || ui === "unconfigured";

  return (
    <div className="flex items-center gap-2">
      {note ? (
        <span
          className={
            "hidden text-xs sm:inline " +
            (ui === "error"
              ? "text-[var(--down)]"
              : ui === "done"
              ? "text-[var(--up)]"
              : "text-gray-500")
          }
        >
          {note}
        </span>
      ) : null}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={
          ui === "unconfigured"
            ? "Set SUPABASE_SERVICE_ROLE_KEY in Vercel to enable manual triggers"
            : "Queue a brief generation on the Mac mini now"
        }
        className={
          "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors " +
          (disabled
            ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
            : "border-gray-950 bg-gray-950 text-white hover:bg-gray-700")
        }
      >
        {ui === "pending" ? (
          <span
            className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-gray-300 border-t-transparent"
            aria-hidden
          />
        ) : null}
        {ui === "pending" ? "Generating…" : "Generate now"}
      </button>
    </div>
  );
}
