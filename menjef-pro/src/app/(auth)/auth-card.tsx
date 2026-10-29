import type { ReactNode } from "react";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Mënjëf PRO · Espace sécurisé</p>
      <h2 className="mt-2 font-display text-2xl font-extrabold text-fg">{title}</h2>
      <p className="mt-1 text-sm text-fg-muted">{subtitle}</p>
      <div className="mt-6">{children}</div>
    </div>
  );
}
