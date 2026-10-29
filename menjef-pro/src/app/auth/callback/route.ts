import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

function safe(next: string | null, fallback: string) {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}

// Point d'arrivée des liens envoyés par e-mail (confirmation, réinitialisation)
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safe(url.searchParams.get("next"), "/app");
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const supabase = await createClient();

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }
  const dest = url.clone();
  dest.search = "";
  if (ok) {
    dest.pathname = next;
  } else {
    dest.pathname = "/connexion";
    dest.searchParams.set("erreur", "lien");
  }
  return NextResponse.redirect(dest);
}
