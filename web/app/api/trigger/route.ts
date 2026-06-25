import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Manual-trigger bridge. The dashboard cannot reach the Mac mini directly, so a
// POST here enqueues a row in generation_requests; the Mac mini watcher runs it.
//
// Uses the SERVICE ROLE key, SERVER-SIDE ONLY. It must be set in Vercel as
// SUPABASE_SERVICE_ROLE_KEY (NO NEXT_PUBLIC_ prefix) so it never reaches the
// browser. If it is unset, the route returns 503 and the button shows a hint.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function admin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const NOT_CONFIGURED = {
  ok: false,
  error:
    "Trigger not configured. Set SUPABASE_SERVICE_ROLE_KEY (server-only) in the Vercel project.",
};

// Kick the GitHub Actions workflow that runs the Python generator (replaces the
// Mac mini). Needs GITHUB_REPO ("owner/name") and a token with repo/contents
// write set as server-only env vars in Vercel.
async function dispatchGithub(): Promise<{ ok: boolean; error?: string }> {
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!repo || !token) {
    return {
      ok: false,
      error:
        "GitHub trigger not configured. Set GITHUB_REPO and GITHUB_DISPATCH_TOKEN in Vercel.",
    };
  }
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ event_type: "generate-brief" }),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      return { ok: false, error: `GitHub dispatch failed (${res.status}): ${detail}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `GitHub dispatch error: ${(e as Error).message}` };
  }
}

export async function POST(req: NextRequest) {
  const db = admin();
  if (!db) return NextResponse.json(NOT_CONFIGURED, { status: 503 });

  // Optional specific week (YYYY-MM-DD). Otherwise the generator uses this week's Monday.
  let week: string | null = null;
  const body = await req.json().catch(() => ({}));
  if (
    body &&
    typeof body.week_of === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(body.week_of)
  ) {
    week = body.week_of;
  }

  // Don't pile up duplicates if one is already queued or running.
  const { data: pending } = await db
    .from("generation_requests")
    .select("id")
    .in("status", ["queued", "running"])
    .limit(1);
  if (pending && pending.length) {
    return NextResponse.json({ ok: true, alreadyPending: true, id: pending[0].id });
  }

  const { data, error } = await db
    .from("generation_requests")
    .insert({ requested_for_week: week, status: "queued", source: "dashboard" })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Fire the GitHub Actions run that will pick this row up. If it can't be
  // triggered, mark the row failed so the button shows the reason instead of
  // spinning forever waiting for a worker that will never come.
  const dispatch = await dispatchGithub();
  if (!dispatch.ok) {
    await db
      .from("generation_requests")
      .update({
        status: "error",
        message: dispatch.error ?? "Could not trigger GitHub Actions.",
        finished_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    return NextResponse.json({ ok: false, error: dispatch.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}

export async function GET() {
  const db = admin();
  if (!db) return NextResponse.json({ configured: false });

  const { data, error } = await db
    .from("generation_requests")
    .select(
      "id, status, requested_at, finished_at, brief_id, message, requested_for_week"
    )
    .order("requested_at", { ascending: false })
    .limit(1);

  if (error) {
    return NextResponse.json({ configured: true, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ configured: true, latest: data?.[0] ?? null });
}
