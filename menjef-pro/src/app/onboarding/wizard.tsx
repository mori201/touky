"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/client";
import { Button, Field, Input, Select } from "@/components/ui";
import { LOCATION_TYPES, SECTORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { createOrganization } from "./actions";

const STEPS = ["Vous", "Entreprise", "Coordonnées", "Établissement"];

export function CreateOrganizationWizard({ fullName, phone }: { fullName: string; phone: string }) {
  const [step, setStep] = useState(0);
  return (
    <ActionForm action={createOrganization}>
      <ol className="mb-6 grid grid-cols-4 gap-2" aria-label="Étapes">
        {STEPS.map((s, i) => (
          <li key={s} className="text-center">
            <span className={cn("mx-auto block h-1.5 rounded-full", i <= step ? "bg-primary" : "bg-border")} />
            <span className={cn("mt-1.5 block text-[0.7rem] font-semibold", i === step ? "text-primary" : "text-fg-muted")}>
              {i + 1}. {s}
            </span>
          </li>
        ))}
      </ol>

      {/* Toutes les étapes restent dans le DOM pour être envoyées ensemble */}
      <div className={cn("space-y-4", step !== 0 && "hidden")}>
        <h2 className="font-display text-xl font-bold">Informations du responsable</h2>
        <Field label="Votre nom complet" htmlFor="full_name" required>
          <Input id="full_name" name="full_name" defaultValue={fullName} required />
        </Field>
        <Field label="Votre téléphone" htmlFor="phone">
          <Input id="phone" name="phone" type="tel" defaultValue={phone} placeholder="+221 77 000 00 00" />
        </Field>
      </div>

      <div className={cn("space-y-4", step !== 1 && "hidden")}>
        <h2 className="font-display text-xl font-bold">Votre entreprise</h2>
        <Field label="Nom de l'entreprise" htmlFor="name" required>
          <Input id="name" name="name" required placeholder="Ex. : Boutique Keur Awa" />
        </Field>
        <Field label="Secteur d'activité" htmlFor="sector" required hint="Il adapte les libellés et suggestions, toutes les fonctions restent disponibles.">
          <Select id="sector" name="sector" defaultValue="boutique">
            {Object.entries(SECTORS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
      </div>

      <div className={cn("grid gap-4 sm:grid-cols-2", step !== 2 && "hidden")}>
        <h2 className="font-display text-xl font-bold sm:col-span-2">Coordonnées et informations commerciales</h2>
        <Field label="Téléphone de l'entreprise" htmlFor="org_phone"><Input id="org_phone" name="org_phone" type="tel" /></Field>
        <Field label="E-mail de l'entreprise" htmlFor="org_email"><Input id="org_email" name="org_email" type="email" /></Field>
        <Field label="Ville" htmlFor="city"><Input id="city" name="city" placeholder="Dakar" /></Field>
        <Field label="Adresse" htmlFor="address"><Input id="address" name="address" placeholder="Quartier, rue" /></Field>
        <Field label="NINEA" htmlFor="ninea" hint="Facultatif"><Input id="ninea" name="ninea" /></Field>
        <Field label="RCCM" htmlFor="rccm" hint="Facultatif"><Input id="rccm" name="rccm" /></Field>
      </div>

      <div className={cn("space-y-4", step !== 3 && "hidden")}>
        <h2 className="font-display text-xl font-bold">Premier établissement</h2>
        <Field label="Nom de l'établissement" htmlFor="location_name" required>
          <Input id="location_name" name="location_name" defaultValue="Boutique principale" required />
        </Field>
        <Field label="Type" htmlFor="location_type">
          <Select id="location_type" name="location_type" defaultValue="boutique">
            {Object.entries(LOCATION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <p className="text-sm text-fg-muted">
          Une caisse en espèces et des comptes Wave et Orange Money seront créés automatiquement.
        </p>
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          ← Précédent
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={() => setStep((s) => s + 1)}>Continuer →</Button>
        ) : (
          <SubmitButton pendingText="Création…">Créer mon entreprise</SubmitButton>
        )}
      </div>
    </ActionForm>
  );
}
