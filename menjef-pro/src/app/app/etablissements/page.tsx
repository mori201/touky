import type { Metadata } from "next";
import { Store } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, Field, Input, PageHeader, Select } from "@/components/ui";
import { ActionForm, Modal, SubmitButton } from "@/components/ui/client";
import { requirePermission } from "@/lib/context";
import { LOCATION_TYPES } from "@/lib/constants";
import { saveLocation, setLocationArchived } from "./actions";

export const metadata: Metadata = { title: "Établissements" };

function LocationFields({ v = {} }: { v?: { id?: string; name?: string; type?: string; city?: string | null; address?: string | null; phone?: string | null } }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {v.id && <input type="hidden" name="id" value={v.id} />}
      <Field label="Nom" htmlFor={`n_${v.id ?? "new"}`} required><Input id={`n_${v.id ?? "new"}`} name="name" defaultValue={v.name} required /></Field>
      <Field label="Type" htmlFor={`t_${v.id ?? "new"}`}><Select id={`t_${v.id ?? "new"}`} name="type" defaultValue={v.type ?? "boutique"}>{Object.entries(LOCATION_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
      <Field label="Ville" htmlFor={`c_${v.id ?? "new"}`}><Input id={`c_${v.id ?? "new"}`} name="city" defaultValue={v.city ?? ""} /></Field>
      <Field label="Téléphone" htmlFor={`p_${v.id ?? "new"}`}><Input id={`p_${v.id ?? "new"}`} name="phone" defaultValue={v.phone ?? ""} /></Field>
      <Field label="Adresse" htmlFor={`a_${v.id ?? "new"}`} className="sm:col-span-2"><Input id={`a_${v.id ?? "new"}`} name="address" defaultValue={v.address ?? ""} /></Field>
    </div>
  );
}

export default async function LocationsPage() {
  const ctx = await requirePermission("locations.manage");
  const { data: all } = await ctx.supabase.from("locations").select("*").eq("organization_id", ctx.org.id).order("created_at");
  return (
    <>
      <PageHeader
        title="Établissements"
        description="Boutiques, magasins, dépôts ou restaurants : chacun a son propre stock et ses caisses."
        actions={
          <Modal trigger="+ Établissement" title="Nouvel établissement">
            <ActionForm action={saveLocation} resetOnSuccess className="space-y-4"><LocationFields /><SubmitButton>Créer</SubmitButton></ActionForm>
          </Modal>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        {(all ?? []).map((l) => (
          <Card key={l.id} className={l.archived_at ? "opacity-70" : ""}>
            <CardHeader
              title={<span className="flex items-center gap-2"><Store size={18} className="text-primary" />{l.name}</span>}
              description={[LOCATION_TYPES[l.type as keyof typeof LOCATION_TYPES], l.city].filter(Boolean).join(" · ")}
              actions={l.archived_at ? <Badge tone="danger">Archivé</Badge> : <Badge tone="success">Actif</Badge>}
            />
            <CardBody>
              <ActionForm action={saveLocation} className="space-y-4">
                <LocationFields v={l} />
                <div className="flex flex-wrap justify-between gap-2">
                  <SubmitButton variant="outline">Enregistrer</SubmitButton>
                </div>
              </ActionForm>
              <ActionForm action={setLocationArchived} className="mt-2">
                <input type="hidden" name="id" value={l.id} />
                <input type="hidden" name="archive" value={String(!l.archived_at)} />
                <SubmitButton size="sm" variant="ghost">{l.archived_at ? "Réactiver" : "Archiver"}</SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>
        ))}
      </div>
    </>
  );
}
