import { createClient } from "@supabase/supabase-js";

function getUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
}

export function getSupabaseBrowser() {
  const url = getUrl();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !anon) throw new Error("Supabase não configurado (NEXT_PUBLIC_*)");
  return createClient(url, anon, {
    realtime: { params: { eventsPerSecond: 10 } },
  });
}

export function getSupabaseServer() {
  const url = getUrl();
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !service) throw new Error("Supabase server não configurado (SERVICE_ROLE)");
  return createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
