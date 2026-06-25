import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Server-side Supabase client factory. Uses the ANON key only — RLS on the
// Supabase side grants anon read access. Never import the service role key here.
//
// We read env vars lazily inside the factory so that a missing configuration
// surfaces as a clear runtime message rather than a build-time crash. Queries
// in queries.ts catch errors and fall back to empty data so pages still render.

let cached: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // Not configured yet (e.g. first build before env vars are set).
    return null;
  }

  cached = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cached;
}
