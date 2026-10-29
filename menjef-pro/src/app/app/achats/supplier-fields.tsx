import { Field, Input, Textarea } from "@/components/ui";

export function SupplierFields({ values = {} }: { values?: { id?: string; name?: string; contact_name?: string | null; phone?: string | null; email?: string | null; address?: string | null; notes?: string | null } }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <Field label="Nom du fournisseur" htmlFor="s_name" required className="sm:col-span-2"><Input id="s_name" name="name" defaultValue={values.name} required /></Field>
      <Field label="Contact" htmlFor="s_contact"><Input id="s_contact" name="contact_name" defaultValue={values.contact_name ?? ""} /></Field>
      <Field label="Téléphone" htmlFor="s_phone"><Input id="s_phone" name="phone" type="tel" defaultValue={values.phone ?? ""} /></Field>
      <Field label="E-mail" htmlFor="s_email"><Input id="s_email" name="email" type="email" defaultValue={values.email ?? ""} /></Field>
      <Field label="Adresse" htmlFor="s_address"><Input id="s_address" name="address" defaultValue={values.address ?? ""} /></Field>
      <Field label="Notes" htmlFor="s_notes" className="sm:col-span-2"><Textarea id="s_notes" name="notes" defaultValue={values.notes ?? ""} /></Field>
    </div>
  );
}
