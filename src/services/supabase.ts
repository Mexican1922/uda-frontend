import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// We use Supabase ONLY for Realtime (presence + broadcast) to power
// cross-device playback sync. Auth & data still live in the Django backend.
//
// The anon key is designed to be public (it ships in the client bundle);
// it grants no database access on its own — Realtime channels are namespaced
// by each user's non-guessable sync_token.

const url     = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

if (url && anonKey) {
  client = createClient(url, anonKey, {
    auth: { persistSession: false },           // we don't use Supabase Auth
    realtime: { params: { eventsPerSecond: 5 } },
  });
} else if (import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.info(
    "[supabase] Realtime disabled — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable cross-device sync."
  );
}

/** May be null if env vars are not configured — callers must guard. */
export const supabase = client;
export const isRealtimeEnabled = client !== null;
