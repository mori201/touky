import { Field, Input, Textarea } from "@/components/ui";

export function CustomerFields({ values = {} }: { values?: { id?: string; name?: string; phone?: string | null; email?: string | null; address?: string | null; credit_limit?: number | null; notes?: string | null } }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <Field label="Nom ou raison sociale" htmlFor="c_name" required className="sm:col-span-2"><Input id="c_name" name="name" defaultValue={values.name} required /></Field>
      <Field label="Téléphone" htmlFor="c_phone"><Input id="c_phone" name="phone" type="tel" defaultValue={values.phone ?? ""} /></Field>
      <Field label="E-mail" htmlFor="c_email"><Input id="c_email" name="email" type="email" defaultValue={values.email ?? ""} /></Field>
      <Field label="Adresse" htmlFor="c_address" className="sm:col-span-2"><Input id="c_address" name="address" defaultValue={values.address ?? ""} /></Field>
      <Field label="Plafond de crédit (F CFA)" htmlFor="c_limit" hint="Vide = pas de plafond"><Input id="c_limit" name="credit_limit" inputMode="decimal" defaultValue={values.credit_limit ?? ""} /></Field>
      <Field label="Notes internes" htmlFor="c_notes" className="sm:col-span-2"><Textarea id="c_notes" name="notes" defaultValue={values.notes ?? ""} /></Field>
    </div>
  );
}
