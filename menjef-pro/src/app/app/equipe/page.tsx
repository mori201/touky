import type { Metadata } from "next";
import { Badge, Card, CardBody, CardHeader, Field, Input, PageHeader, Select, Table, TD, TH } from "@/components/ui";
import { ActionForm, ConfirmSubmit, Modal, SubmitButton } from "@/components/ui/client";
import { requirePermission } from "@/lib/context";
import { getMemberNames } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { PERMISSIONS, ROLES, type Role } from "@/lib/permissions";
import { inviteMember, removeMember, revokeInvitation, updateMember } from "./actions";

export const metadata: Metadata = { title: "Équipe" };

export default async function TeamPage() {
  const ctx = await requirePermission("team.manage");
  const [{ data: members }, { data: invitations }, { data: matrix }, names] = await Promise.all([
    ctx.supabase.from("organization_members").select("id, user_id, role, location_id, status, created_at").eq("organization_id", ctx.org.id).order("created_at"),
    ctx.supabase.from("invitations").select("id, email, role, location_id, token, expires_at, created_at").eq("organization_id", ctx.org.id).is("accepted_at", null).is("revoked_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }),
    ctx.supabase.from("role_permissions").select("role, permission"),
    getMemberNames(ctx),
  ]);
  const locName = new Map(ctx.locations.map((l) => [l.id, l.name]));
  const isOwner = ctx.role === "owner";
  const perms = new Map<string, Set<string>>();
  for (const r of matrix ?? []) perms.set(r.role, (perms.get(r.role) ?? new Set()).add(r.permission));
  const roleOptions = (Object.keys(ROLES) as Role[]).filter((r) => r !== "owner" || isOwner);

  return (
    <>
      <PageHeader
        title="Équipe et permissions"
        description="Chaque collaborateur dispose de son propre compte. Les droits sont contrôlés par la base de données, pas seulement par l'interface."
        actions={
          <Modal trigger="+ Inviter" title="Inviter un collaborateur">
            <ActionForm action={inviteMember} resetOnSuccess className="space-y-4">
              <Field label="Adresse e-mail" htmlFor="email" required hint="La personne devra créer son compte avec cette adresse."><Input id="email" name="email" type="email" required /></Field>
              <Field label="Rôle" htmlFor="role">
                <Select id="role" name="role" defaultValue="cashier">{roleOptions.map((r) => <option key={r} value={r}>{ROLES[r].label} — {ROLES[r].description}</option>)}</Select>
              </Field>
              <Field label="Établissement autorisé" htmlFor="location_id">
                <Select id="location_id" name="location_id"><option value="">Tous les établissements</option>{ctx.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select>
              </Field>
              <SubmitButton>Créer l&apos;invitation</SubmitButton>
            </ActionForm>
          </Modal>
        }
      />
      <Card>
        <CardHeader title={`Membres (${members?.length ?? 0})`} />
        <Table>
          <thead><tr><TH>Nom</TH><TH>Rôle</TH><TH>Établissement</TH><TH>Statut</TH><TH>Depuis</TH><TH /></tr></thead>
          <tbody>
            {(members ?? []).map((m) => {
              const self = m.user_id === ctx.user.id;
              const locked = m.role === "owner" && !isOwner;
              return (
                <tr key={m.id}>
                  <TD className="font-semibold">{names.get(m.user_id) ?? "—"}{self && <Badge tone="primary" className="ml-2">Vous</Badge>}</TD>
                  <TD>{ROLES[m.role as Role].label}</TD>
                  <TD className="text-fg-muted">{m.location_id ? locName.get(m.location_id) : "Tous"}</TD>
                  <TD>{m.status === "active" ? <Badge tone="success">Actif</Badge> : <Badge tone="danger">Suspendu</Badge>}</TD>
                  <TD className="text-fg-muted">{formatDate(m.created_at)}</TD>
                  <TD>
                    {!locked && (
                      <div className="flex gap-1">
                        <Modal trigger="Modifier" title={`Modifier ${names.get(m.user_id) ?? "le membre"}`} triggerVariant="ghost" triggerSize="sm">
                          <ActionForm action={updateMember} className="space-y-4">
                            <input type="hidden" name="member_id" value={m.id} />
                            <Field label="Rôle" htmlFor={`r_${m.id}`}><Select id={`r_${m.id}`} name="role" defaultValue={m.role}>{roleOptions.map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}</Select></Field>
                            <Field label="Établissement" htmlFor={`l_${m.id}`}><Select id={`l_${m.id}`} name="location_id" defaultValue={m.location_id ?? ""}><option value="">Tous</option>{ctx.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
                            <Field label="Statut" htmlFor={`s_${m.id}`}><Select id={`s_${m.id}`} name="status" defaultValue={m.status}><option value="active">Actif</option><option value="suspended">Suspendu (accès bloqué)</option></Select></Field>
                            <SubmitButton>Enregistrer</SubmitButton>
                          </ActionForm>
                        </Modal>
                        {!self && (
                          <ActionForm action={removeMember}><input type="hidden" name="member_id" value={m.id} /><ConfirmSubmit message="Retirer ce membre de l'entreprise ? Son historique d'opérations est conservé.">Retirer</ConfirmSubmit></ActionForm>
                        )}
                      </div>
                    )}
                  </TD>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      {(invitations ?? []).length > 0 && (
        <Card className="mt-5">
          <CardHeader title="Invitations en attente" />
          <Table>
            <thead><tr><TH>E-mail</TH><TH>Rôle</TH><TH>Expire le</TH><TH>Lien</TH><TH /></tr></thead>
            <tbody>
              {(invitations ?? []).map((i) => (
                <tr key={i.id}>
                  <TD>{i.email}</TD>
                  <TD>{ROLES[i.role as Role].label}{i.location_id && <span className="text-xs text-fg-muted"> · {locName.get(i.location_id)}</span>}</TD>
                  <TD className="text-fg-muted">{formatDate(i.expires_at)}</TD>
                  <TD><code className="break-all text-xs">/invitation/{i.token}</code></TD>
                  <TD><ActionForm action={revokeInvitation}><input type="hidden" name="id" value={i.id} /><ConfirmSubmit message="Révoquer cette invitation ?" variant="outline">Révoquer</ConfirmSubmit></ActionForm></TD>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <Card className="mt-5">
        <CardHeader title="Matrice des permissions" description="Rôles de départ et permissions associées." />
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full min-w-[820px] text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/60">
                <th className="px-3 py-2 text-left">Permission</th>
                {(Object.keys(ROLES) as Role[]).map((r) => <th key={r} className="px-2 py-2 text-center">{ROLES[r].label}</th>)}
              </tr>
            </thead>
            <tbody>
              {Object.entries(PERMISSIONS).map(([p, label]) => (
                <tr key={p} className="border-b border-border/60">
                  <td className="px-3 py-1.5">{label}</td>
                  {(Object.keys(ROLES) as Role[]).map((r) => <td key={r} className="text-center">{perms.get(r)?.has(p) ? <span className="text-success">●</span> : <span className="text-fg-muted/40">—</span>}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </>
  );
}
