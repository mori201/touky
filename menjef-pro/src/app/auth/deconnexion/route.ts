import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const url = request.nextUrl.clone();
  url.pathname = "/connexion";
  url.search = "";
  const res = NextResponse.redirect(url, { status: 303 });
  res.cookies.delete("mj_org");
  res.cookies.delete("mj_loc");
  return res;
}
