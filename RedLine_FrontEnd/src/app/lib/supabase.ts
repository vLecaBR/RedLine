// --- CLIENTE SUPABASE ---
// Sessão real (Fase 3 / RF-07). A anon key é PÚBLICA por design (RNF-02) — nunca a service_role.
// As chaves vêm do .env.local: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // Falha cedo e clara em dev — evita "sessão sempre null" silencioso.
  console.error(
    "[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ausentes. Configure o .env.local."
  );
}

export const supabase = createClient(url ?? "", anonKey ?? "", {
  auth: {
    persistSession: true, // sessão sobrevive ao reload (RF-07)
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/** Access token da sessão atual (ou null se deslogado). Usado pelo authFetch. */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
