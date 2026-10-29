import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardHeader, PageHeader, StatCard, Table, TD, TH, Badge } from "@/components/ui";
import { getAppContext } from "@/lib/context";
import { formatDate } from "@/lib/format";
import { SECTORS } from "@/lib/constants";

export const metadata: Metadata = { title: "Administration de la plateforme" };

interface Overview {
  organizations: number; users: number; sales_30d: number; deletion_requests: number;
  list: { id: string; name: string; sector: keyof typeof SECTORS; city: string | null; created_at: string; members: number; plan: string; status: string; trial_ends_at: string | null }[];
}

export default async function AdminPage() {
  const ctx = await getAppContext();
  const { data, error } = await ctx.supabase.rpc("platform_overview");
  if (error) redirect("/app/acces-refuse");
  const o = data as Overview;
  return (
    <>
      <PageHeader eyebrow="Mënjëf PRO" title="Administration de la plateforme" description="Vue réservée aux administrateurs du SaaS. Aucune donnée commerciale des clients n'est affichée ici." />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Entreprises" value={String(o.organizations)} />
        <StatCard label="Utilisateurs" value={String(o.users)} tone="success" />
        <StatCard label="Ventes (30 jours)" value={String(o.sales_30d)} tone="neutral" />
        <StatCard label="Demandes de suppression" value={String(o.deletion_requests)} tone={o.deletion_requests ? "danger" : "neutral"} />
      </div>
      <Card>
        <CardHeader title="Entreprises inscrites" />
        <Table>
          <thead><tr><TH>Entreprise</TH><TH>Secteur</TH><TH>Ville</TH><TH>Membres</TH><TH>Abonnement</TH><TH>Inscription</TH></tr></thead>
          <tbody>
            {o.list.map((x) => (
              <tr key={x.id}>
                <TD className="font-semibold">{x.name}</TD>
                <TD>{SECTORS[x.sector]}</TD>
                <TD className="text-fg-muted">{x.city ?? "—"}</TD>
                <TD>{x.members}</TD>
                <TD><Badge tone={x.status === "active" ? "success" : x.status === "trialing" ? "primary" : "danger"}>{x.plan} · {x.status}</Badge>{x.trial_ends_at && x.status === "trialing" && <p className="text-xs text-fg-muted">fin d&apos;essai {formatDate(x.trial_ends_at)}</p>}</TD>
                <TD className="text-fg-muted">{formatDate(x.created_at)}</TD>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
