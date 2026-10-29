import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL, assertSupabaseEnv } from "@/lib/env";

export async function createClient() {
  // cookies() en premier : la page devient dynamique même si la configuration manque
  const cookieStore = await cookies();
  assertSupabaseEnv();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Appel depuis un Server Component : le middleware rafraîchit la session.
        }
      },
    },
  });
}
