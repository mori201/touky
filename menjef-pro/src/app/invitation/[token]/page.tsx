import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Logo } from "@/components/logo";
import { Alert, ButtonLink, Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { ORG_COOKIE } from "@/lib/context";
import { ROLES, type Role } from "@/lib/permissions";
import { friendlyError } from "@/lib/actions";

export const metadata: Metadata = { title: "Invitation", robots: { index: false } };

async function accept(fd: FormData) {
  "use server";
  const token = String(fd.get("token") ?? "");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) redirect(`/invitation/${encodeURIComponent(token)}?erreur=${encodeURIComponent(friendlyError(error))}`);
  (await cookies()).set(ORG_COOKIE, data as string, { path: "/", httpOnly: true, sameSite: "lax", secure: true, maxAge: 31536000 });
  redirect("/app");
}

export default async function InvitationPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { token } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: inv }, { data: { user } }] = await Promise.all([supabase.rpc("get_invitation", { p_token: token }), supabase.auth.getUser()]);
  const i = inv as { organization: string; email: string; role: Role; valid: boolean } | null;
  const back = `/invitation/${token}`;

  return (
    <main className="grid min-h-screen place-items-center bg-bg px-4">
      <Card className="w-full max-w-md p-8 text-center">
        <Logo className="justify-center" />
        {!i || !i.valid ? (
          <Alert tone="danger" className="mt-6 text-left">Cette invitation est invalide, expirée ou a déjà été utilisée. Demandez un nouveau lien.</Alert>
        ) : (
          <>
            <h1 className="mt-6 font-display text-2xl font-extrabold">Rejoindre {i.organization}</h1>
            <p className="mt-2 text-sm text-fg-muted">Vous êtes invité(e) en tant que <strong>{ROLES[i.role].label}</strong> avec l&apos;adresse <strong>{i.email}</strong>.</p>
            {sp.erreur && <Alert tone="danger" className="mt-4 text-left">{sp.erreur}</Alert>}
            {!user ? (
              <div className="mt-6 grid gap-2">
                <ButtonLink href={`/inscription?suivant=${encodeURIComponent(back)}`}>Créer mon compte</ButtonLink>
                <ButtonLink href={`/connexion?suivant=${encodeURIComponent(back)}`} variant="outline">J&apos;ai déjà un compte</ButtonLink>
              </div>
            ) : user.email?.toLowerCase() !== i.email.toLowerCase() ? (
              <Alert tone="warning" className="mt-6 text-left">Vous êtes connecté(e) avec {user.email}. Déconnectez-vous puis reconnectez-vous avec {i.email}.</Alert>
            ) : (
              <form action={accept} className="mt-6">
                <input type="hidden" name="token" value={token} />
                <button className="h-12 w-full rounded-lg bg-primary font-semibold text-primary-fg">Accepter l&apos;invitation</button>
              </form>
            )}
          </>
        )}
      </Card>
    </main>
  );
}
