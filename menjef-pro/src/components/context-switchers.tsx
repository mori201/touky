"use client";

import { useRef } from "react";
import { setLocation, setOrganization } from "@/app/app/actions";

export function OrganizationSwitcher({ current, options }: { current: string; options: { id: string; name: string }[] }) {
  const ref = useRef<HTMLFormElement>(null);
  if (options.length < 2) {
    return <span className="truncate text-sm font-bold text-fg">{options.find((o) => o.id === current)?.name}</span>;
  }
  return (
    <form ref={ref} action={setOrganization}>
      <label className="sr-only" htmlFor="org-switch">Entreprise</label>
      <select
        id="org-switch"
        name="organization_id"
        defaultValue={current}
        onChange={() => ref.current?.requestSubmit()}
        className="max-w-[11rem] truncate rounded-lg border border-border bg-surface py-1.5 pl-2 pr-7 text-sm font-bold text-fg"
      >
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </form>
  );
}

export function LocationSwitcher({
  current,
  options,
  restricted,
}: {
  current: string | null;
  options: { id: string; name: string }[];
  restricted: boolean;
}) {
  const ref = useRef<HTMLFormElement>(null);
  if (restricted || options.length < 2) {
    return <span className="hidden truncate rounded-lg bg-muted px-2.5 py-1.5 text-xs font-semibold text-fg-muted sm:inline">{options[0]?.name}</span>;
  }
  return (
    <form ref={ref} action={setLocation}>
      <label className="sr-only" htmlFor="loc-switch">Établissement</label>
      <select
        id="loc-switch"
        name="location_id"
        defaultValue={current ?? ""}
        onChange={() => ref.current?.requestSubmit()}
        className="max-w-[10rem] truncate rounded-lg border border-border bg-surface py-1.5 pl-2 pr-7 text-xs font-semibold text-fg"
      >
        <option value="">Tous les établissements</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </form>
  );
}
